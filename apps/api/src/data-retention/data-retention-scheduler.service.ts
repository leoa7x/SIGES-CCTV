import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { dataRetentionDays, dataRetentionIntervalMs } from "./data-retention.constants";

export type RetentionCounts = {
  telemetrySnapshots: number;
  telemetryAssetSamples: number;
  deviceStateLogs: number;
  centerDiscoveredDevices: number;
  nodeDiscoveredDevices: number;
};

// Purely operational, high-cardinality telemetry noise gets pruned here.
// Business/audit records (Incident, LogbookEntry, NetworkTelemetryAlert,
// discovery Job rows themselves) are NEVER touched by this job — those are
// records an operator may need to look back on, not raw per-scan exhaust.
@Injectable()
export class DataRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataRetentionScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const intervalMs = dataRetentionIntervalMs();
    this.logger.log(`Data retention sweep enabled every ${intervalMs}ms (retain ${dataRetentionDays()} days)`);
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCycle(now = new Date()): Promise<RetentionCounts | null> {
    if (this.running) return null;
    this.running = true;

    try {
      const counts = await this.pruneStale(now);
      this.logger.log(
        `Retention sweep removed ${counts.telemetrySnapshots} telemetry snapshots, ` +
          `${counts.telemetryAssetSamples} telemetry asset samples, ${counts.deviceStateLogs} device state logs, ` +
          `${counts.centerDiscoveredDevices} center-discovered devices, ${counts.nodeDiscoveredDevices} node-discovered devices`,
      );
      return counts;
    } catch (error) {
      this.logger.error(`Retention sweep failed: ${error instanceof Error ? error.message : error}`);
      return null;
    } finally {
      this.running = false;
    }
  }

  async pruneStale(now = new Date()): Promise<RetentionCounts> {
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - dataRetentionDays());

    const staleSnapshots = await this.prisma.networkTelemetrySnapshot.findMany({
      where: { capturedAt: { lt: cutoff } },
      select: { id: true },
    });
    const staleSnapshotIds = staleSnapshots.map((snapshot) => snapshot.id);

    if (staleSnapshotIds.length > 0) {
      // Alerts outlive their originating snapshot — decouple the pointer
      // instead of blocking the snapshot delete on a required-looking FK.
      await this.prisma.networkTelemetryAlert.updateMany({
        where: { snapshotId: { in: staleSnapshotIds } },
        data: { snapshotId: null },
      });
    }

    const telemetryAssetSamples = await this.prisma.networkTelemetryAssetSample.deleteMany({
      where: { snapshotId: { in: staleSnapshotIds } },
    });
    const telemetrySnapshots = await this.prisma.networkTelemetrySnapshot.deleteMany({
      where: { capturedAt: { lt: cutoff } },
    });
    const deviceStateLogs = await this.prisma.deviceStateLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const centerDiscoveredDevices = await this.prisma.centerDiscoveredDevice.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    const nodeDiscoveredDevices = await this.prisma.nodeDiscoveredDevice.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return {
      telemetrySnapshots: telemetrySnapshots.count,
      telemetryAssetSamples: telemetryAssetSamples.count,
      deviceStateLogs: deviceStateLogs.count,
      centerDiscoveredDevices: centerDiscoveredDevices.count,
      nodeDiscoveredDevices: nodeDiscoveredDevices.count,
    };
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityState, NetworkTelemetryAlertSeverity, NodeState, OperationalAlertKind } from "@prisma/client";

import {
  AUTO_MANAGED_STATES,
  heartbeatConcurrency,
  heartbeatFailureThreshold,
  heartbeatIntervalMs,
} from "../heartbeat/heartbeat.constants";
import { mapWithConcurrency } from "../heartbeat/heartbeat-concurrency";
import { HeartbeatProbeService } from "../heartbeat/heartbeat-probe.service";
import { OperationalAlertsService } from "../heartbeat/operational-alerts.service";
import { isValidIp } from "../node-discovery/node-discovery.utils";
import { PrismaService } from "../prisma/prisma.service";

type CenterRow = {
  id: string;
  name: string;
  primaryIp: string | null;
  heartbeatFailureCount: number;
  centerAssets: Array<{ id: string; name: string; ip: string | null; heartbeatFailureCount: number }>;
};

@Injectable()
export class CenterHeartbeatScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CenterHeartbeatScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly probe: HeartbeatProbeService,
    private readonly alerts: OperationalAlertsService,
  ) {}

  onModuleInit() {
    const intervalMs = heartbeatIntervalMs();
    this.logger.log(`CMC heartbeat enabled every ${intervalMs}ms`);
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runCycle() {
    if (this.running) return;
    this.running = true;

    try {
      const centers: CenterRow[] = await this.prisma.monitoringCenter.findMany({
        where: {
          state: EntityState.ACTIVE,
          primaryIp: { not: null },
          // MAINTENANCE/DEGRADED are a human call — heartbeat must never touch them.
          operativeState: { in: AUTO_MANAGED_STATES },
        },
        select: {
          id: true,
          name: true,
          primaryIp: true,
          heartbeatFailureCount: true,
          centerAssets: {
            where: { ip: { not: null }, operativeState: { in: AUTO_MANAGED_STATES } },
            select: { id: true, name: true, ip: true, heartbeatFailureCount: true },
          },
        },
      });

      const concurrency = heartbeatConcurrency();

      // Two flat, independently bounded-concurrency passes instead of a
      // nested per-center loop — probing one IP at a time would never fit
      // inside a 15s cycle once there are hundreds of centers/assets.
      await mapWithConcurrency(centers, concurrency, (center) => this.checkCenter(center));

      const assetTasks = centers.flatMap((center) =>
        center.centerAssets.map((asset) => ({ centerId: center.id, asset })),
      );
      await mapWithConcurrency(assetTasks, concurrency, (task) => this.checkCenterAsset(task.centerId, task.asset));
    } catch (error) {
      this.logger.error(`CMC heartbeat cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async checkCenter(center: CenterRow): Promise<void> {
    try {
      if (!center.primaryIp || !isValidIp(center.primaryIp)) return;

      const result = await this.probe.probeIp(center.primaryIp);
      const nextFailureCount = result.reachable ? 0 : center.heartbeatFailureCount + 1;
      const nextState = !result.reachable && nextFailureCount >= heartbeatFailureThreshold()
        ? NodeState.OFFLINE
        : NodeState.ONLINE;

      await this.prisma.monitoringCenter.update({
        where: { id: center.id },
        data: {
          heartbeatFailureCount: nextFailureCount,
          lastHeartbeatAttemptAt: result.checkedAt,
          lastHeartbeatAt: result.reachable ? result.checkedAt : undefined,
          operativeState: nextState,
        },
      });

      if (nextState === NodeState.OFFLINE) {
        await this.alerts.ensureAlert({
          scope: "center",
          monitoringCenterId: center.id,
          kind: OperationalAlertKind.CENTER_UNREACHABLE,
          severity: NetworkTelemetryAlertSeverity.CRITICAL,
          title: `CMC sin respuesta ${center.name}`,
          detail: `El CMC ${center.name} (${center.primaryIp}) no respondió al heartbeat.`,
          checkedAt: result.checkedAt,
        });
      } else {
        await this.alerts.resolveAlerts({ scope: "center", monitoringCenterId: center.id }, OperationalAlertKind.CENTER_UNREACHABLE);
      }
    } catch (error) {
      this.logger.warn(`CMC heartbeat check failed for center ${center.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async checkCenterAsset(
    centerId: string,
    asset: { id: string; name: string; ip: string | null; heartbeatFailureCount: number },
  ): Promise<void> {
    try {
      if (!asset.ip || !isValidIp(asset.ip)) return;

      const assetResult = await this.probe.probeIp(asset.ip);
      const assetFailureCount = assetResult.reachable ? 0 : asset.heartbeatFailureCount + 1;
      const assetState = !assetResult.reachable && assetFailureCount >= heartbeatFailureThreshold()
        ? NodeState.OFFLINE
        : NodeState.ONLINE;

      await this.prisma.centerAsset.update({
        where: { id: asset.id },
        data: {
          heartbeatFailureCount: assetFailureCount,
          lastHeartbeatAttemptAt: assetResult.checkedAt,
          lastHeartbeatAt: assetResult.reachable ? assetResult.checkedAt : undefined,
          operativeState: assetState,
        },
      });

      if (assetState === NodeState.OFFLINE) {
        await this.alerts.ensureAlert({
          scope: "center-asset",
          monitoringCenterId: centerId,
          centerAssetId: asset.id,
          kind: OperationalAlertKind.CENTER_ASSET_UNREACHABLE,
          severity: NetworkTelemetryAlertSeverity.WARNING,
          title: `Activo del CMC sin respuesta ${asset.name}`,
          detail: `El activo ${asset.name} (${asset.ip}) no respondió al heartbeat.`,
          checkedAt: assetResult.checkedAt,
        });
      } else {
        await this.alerts.resolveAlerts(
          { scope: "center-asset", monitoringCenterId: centerId, centerAssetId: asset.id },
          OperationalAlertKind.CENTER_ASSET_UNREACHABLE,
        );
      }
    } catch (error) {
      this.logger.warn(`CMC heartbeat check failed for asset ${asset.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

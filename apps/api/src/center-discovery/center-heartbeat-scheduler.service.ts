import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityState, NetworkTelemetryAlertSeverity, NodeState, OperationalAlertKind } from "@prisma/client";

import { heartbeatFailureThreshold, heartbeatIntervalMs } from "../heartbeat/heartbeat.constants";
import { HeartbeatProbeService } from "../heartbeat/heartbeat-probe.service";
import { OperationalAlertsService } from "../heartbeat/operational-alerts.service";
import { PrismaService } from "../prisma/prisma.service";

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
      const centers = await this.prisma.monitoringCenter.findMany({
        where: { state: EntityState.ACTIVE, primaryIp: { not: null } },
        select: {
          id: true,
          name: true,
          primaryIp: true,
          operativeState: true,
          heartbeatFailureCount: true,
          centerAssets: {
            where: { ip: { not: null } },
            select: { id: true, name: true, ip: true, operativeState: true, heartbeatFailureCount: true },
          },
        },
      });

      for (const center of centers) {
        if (!center.primaryIp) continue;
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

        for (const asset of center.centerAssets) {
          if (!asset.ip) continue;
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
              monitoringCenterId: center.id,
              centerAssetId: asset.id,
              kind: OperationalAlertKind.CENTER_ASSET_UNREACHABLE,
              severity: NetworkTelemetryAlertSeverity.WARNING,
              title: `Activo del CMC sin respuesta ${asset.name}`,
              detail: `El activo ${asset.name} (${asset.ip}) no respondió al heartbeat.`,
              checkedAt: assetResult.checkedAt,
            });
          } else {
            await this.alerts.resolveAlerts({ scope: "center-asset", monitoringCenterId: center.id, centerAssetId: asset.id }, OperationalAlertKind.CENTER_ASSET_UNREACHABLE);
          }
        }
      }
    } catch (error) {
      this.logger.error(`CMC heartbeat cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}

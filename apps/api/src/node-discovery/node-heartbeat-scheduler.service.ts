import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NetworkTelemetryAlertSeverity, NodeState, OperationalAlertKind } from "@prisma/client";

import { heartbeatFailureThreshold, heartbeatIntervalMs } from "../heartbeat/heartbeat.constants";
import { HeartbeatProbeService } from "../heartbeat/heartbeat-probe.service";
import { OperationalAlertsService } from "../heartbeat/operational-alerts.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NodeHeartbeatScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NodeHeartbeatScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly probe: HeartbeatProbeService,
    private readonly alerts: OperationalAlertsService,
  ) {}

  onModuleInit() {
    const intervalMs = heartbeatIntervalMs();
    this.logger.log(`Node heartbeat enabled every ${intervalMs}ms`);
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
      const nodes = await this.prisma.node.findMany({
        where: { primaryIp: { not: null } },
        select: {
          id: true,
          code: true,
          name: true,
          primaryIp: true,
          operativeState: true,
          heartbeatFailureCount: true,
          assets: {
            where: { ip: { not: null } },
            select: { id: true, name: true, ip: true, operativeState: true, heartbeatFailureCount: true },
          },
          route: { select: { monitoringCenterId: true } },
        },
      });

      for (const node of nodes) {
        if (!node.primaryIp) continue;
        const result = await this.probe.probeIp(node.primaryIp);
        const nextFailureCount = result.reachable ? 0 : node.heartbeatFailureCount + 1;
        const nextState = !result.reachable && nextFailureCount >= heartbeatFailureThreshold()
          ? NodeState.OFFLINE
          : NodeState.ONLINE;

        await this.prisma.node.update({
          where: { id: node.id },
          data: {
            heartbeatFailureCount: nextFailureCount,
            lastHeartbeatAttemptAt: result.checkedAt,
            lastHeartbeatAt: result.reachable ? result.checkedAt : undefined,
            operativeState: nextState,
          },
        });

        if (nextState === NodeState.OFFLINE) {
          await this.alerts.ensureAlert({
            scope: "node",
            nodeId: node.id,
            kind: OperationalAlertKind.NODE_UNREACHABLE,
            severity: NetworkTelemetryAlertSeverity.CRITICAL,
            title: `Nodo sin respuesta ${node.code}`,
            detail: `El nodo ${node.name} (${node.primaryIp}) no respondió al heartbeat.`,
            checkedAt: result.checkedAt,
          });
        } else {
          await this.alerts.resolveAlerts({ scope: "node", nodeId: node.id }, OperationalAlertKind.NODE_UNREACHABLE);
        }

        for (const asset of node.assets) {
          if (!asset.ip) continue;
          const assetResult = await this.probe.probeIp(asset.ip);
          const assetFailureCount = assetResult.reachable ? 0 : asset.heartbeatFailureCount + 1;
          const assetState = !assetResult.reachable && assetFailureCount >= heartbeatFailureThreshold()
            ? NodeState.OFFLINE
            : NodeState.ONLINE;

          await this.prisma.nodeAsset.update({
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
              scope: "node-asset",
              nodeId: node.id,
              nodeAssetId: asset.id,
              kind: OperationalAlertKind.NODE_ASSET_UNREACHABLE,
              severity: NetworkTelemetryAlertSeverity.WARNING,
              title: `Activo de nodo sin respuesta ${asset.name}`,
              detail: `El activo ${asset.name} (${asset.ip}) no respondió al heartbeat.`,
              checkedAt: assetResult.checkedAt,
            });
          } else {
            await this.alerts.resolveAlerts({ scope: "node-asset", nodeId: node.id, nodeAssetId: asset.id }, OperationalAlertKind.NODE_ASSET_UNREACHABLE);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Node heartbeat cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { NetworkTelemetryAlertSeverity, NodeState, OperationalAlertKind } from "@prisma/client";

import {
  AUTO_MANAGED_STATES,
  heartbeatConcurrency,
  heartbeatFailureThreshold,
  heartbeatIntervalMs,
} from "../heartbeat/heartbeat.constants";
import { mapWithConcurrency } from "../heartbeat/heartbeat-concurrency";
import { HeartbeatProbeService } from "../heartbeat/heartbeat-probe.service";
import { OperationalAlertsService } from "../heartbeat/operational-alerts.service";
import { isValidIp } from "./node-discovery.utils";
import { PrismaService } from "../prisma/prisma.service";

type NodeRow = {
  id: string;
  code: string;
  name: string;
  primaryIp: string | null;
  heartbeatFailureCount: number;
  assets: Array<{ id: string; name: string; ip: string | null; heartbeatFailureCount: number }>;
};

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
      const nodes: NodeRow[] = await this.prisma.node.findMany({
        where: {
          primaryIp: { not: null },
          // MAINTENANCE/DEGRADED are a human call — heartbeat must never touch them.
          operativeState: { in: AUTO_MANAGED_STATES },
        },
        select: {
          id: true,
          code: true,
          name: true,
          primaryIp: true,
          heartbeatFailureCount: true,
          assets: {
            where: { ip: { not: null }, operativeState: { in: AUTO_MANAGED_STATES } },
            select: { id: true, name: true, ip: true, heartbeatFailureCount: true },
          },
        },
      });

      const concurrency = heartbeatConcurrency();

      // Two flat, independently bounded-concurrency passes instead of a
      // nested per-node loop — probing one IP at a time would never fit
      // inside a 15s cycle once there are hundreds of nodes/assets.
      await mapWithConcurrency(nodes, concurrency, (node) => this.checkNode(node));

      const assetTasks = nodes.flatMap((node) => node.assets.map((asset) => ({ nodeId: node.id, asset })));
      await mapWithConcurrency(assetTasks, concurrency, (task) => this.checkNodeAsset(task.nodeId, task.asset));
    } catch (error) {
      this.logger.error(`Node heartbeat cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }

  private async checkNode(node: NodeRow): Promise<void> {
    try {
      if (!node.primaryIp || !isValidIp(node.primaryIp)) return;

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
    } catch (error) {
      this.logger.warn(`Node heartbeat check failed for node ${node.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async checkNodeAsset(
    nodeId: string,
    asset: { id: string; name: string; ip: string | null; heartbeatFailureCount: number },
  ): Promise<void> {
    try {
      if (!asset.ip || !isValidIp(asset.ip)) return;

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
          nodeId,
          nodeAssetId: asset.id,
          kind: OperationalAlertKind.NODE_ASSET_UNREACHABLE,
          severity: NetworkTelemetryAlertSeverity.WARNING,
          title: `Activo de nodo sin respuesta ${asset.name}`,
          detail: `El activo ${asset.name} (${asset.ip}) no respondió al heartbeat.`,
          checkedAt: assetResult.checkedAt,
        });
      } else {
        await this.alerts.resolveAlerts(
          { scope: "node-asset", nodeId, nodeAssetId: asset.id },
          OperationalAlertKind.NODE_ASSET_UNREACHABLE,
        );
      }
    } catch (error) {
      this.logger.warn(`Node heartbeat check failed for asset ${asset.id}: ${error instanceof Error ? error.message : error}`);
    }
  }
}

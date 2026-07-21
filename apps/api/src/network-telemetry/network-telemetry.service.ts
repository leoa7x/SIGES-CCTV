import { Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import {
  NetworkTelemetryAlertKind,
  NetworkTelemetryAlertSeverity,
  NetworkTelemetryClassificationSource,
  OperationalAlert,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  deriveNodeSilentAlert,
  deriveSilentAssetAlerts,
  TELEMETRY_SILENCE_WINDOW_MS,
} from "./network-telemetry.alerts";
import { correlateObservedHost } from "./network-telemetry-correlation";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";
import type { NtopngObservedHost } from "./network-telemetry.types";

function isMatchingToken(expected: string, received: string): boolean {
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);
  return expectedBuf.length === receivedBuf.length && timingSafeEqual(expectedBuf, receivedBuf);
}

@Injectable()
export class NetworkTelemetryService {
  constructor(private prisma: PrismaService) {}

  async ingestWithCollectorAuth(authorization: string | undefined, dto: IngestNetworkTelemetryDto) {
    const expected = process.env.NETWORK_TELEMETRY_INGEST_TOKEN;
    const received = authorization?.replace(/^Bearer\s+/i, "");
    if (!expected || !received || !isMatchingToken(expected, received)) {
      throw new UnauthorizedException("Invalid collector token");
    }
    return this.ingestSnapshot(dto);
  }

  async getNodeSummary(nodeId: string) {
    const context = await this.getNodeContext(nodeId);
    if (!context) {
      return {
        snapshotId: null,
        capturedAt: null,
        totalBytesIn: "0",
        totalBytesOut: "0",
        activeHosts: 0,
        activeFlows: 0,
        alertCount: 0,
        topProtocols: [],
        topDestinations: [],
      };
    }

    const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
      where: { nodeId },
      orderBy: { capturedAt: "desc" },
    });
    await this.deriveSilentAlerts(nodeId, snapshot?.capturedAt ?? null);
    const alertCount = await this.countNodeMonitorAlerts(nodeId, context.centerId);
    return {
      snapshotId: snapshot?.id ?? null,
      capturedAt: snapshot?.capturedAt ?? null,
      totalBytesIn: snapshot?.totalBytesIn?.toString() ?? "0",
      totalBytesOut: snapshot?.totalBytesOut?.toString() ?? "0",
      activeHosts: snapshot?.activeHosts ?? 0,
      activeFlows: snapshot?.activeFlows ?? 0,
      alertCount,
      topProtocols: snapshot?.topProtocolsJson ?? [],
      topDestinations: snapshot?.topDestinationsJson ?? [],
    };
  }

  async getNodeTimeseries(nodeId: string) {
    const snapshots = await this.prisma.networkTelemetrySnapshot.findMany({
      where: { nodeId },
      orderBy: { capturedAt: "asc" },
      take: 60,
      select: {
        capturedAt: true,
        totalBytesIn: true,
        totalBytesOut: true,
        activeHosts: true,
        activeFlows: true,
      },
    });
    return snapshots.map((snapshot) => ({
      ...snapshot,
      totalBytesIn: snapshot.totalBytesIn.toString(),
      totalBytesOut: snapshot.totalBytesOut.toString(),
    }));
  }

  async getNodeAssets(nodeId: string) {
    const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
      where: { nodeId },
      orderBy: { capturedAt: "desc" },
    });
    if (!snapshot) return [];
    const assets = await this.prisma.networkTelemetryAssetSample.findMany({
      where: { snapshotId: snapshot.id },
      include: { nodeAsset: true },
      orderBy: [{ bytesOut: "desc" }, { bytesIn: "desc" }],
    });
    return assets.map((asset) => ({
      ...asset,
      bytesIn: asset.bytesIn.toString(),
      bytesOut: asset.bytesOut.toString(),
    }));
  }

  async getNodeAlerts(nodeId: string) {
    const context = await this.getNodeContext(nodeId);
    if (!context) return [];

    const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
      where: { nodeId },
      orderBy: { capturedAt: "desc" },
    });
    await this.deriveSilentAlerts(nodeId, snapshot?.capturedAt ?? null);
    const [telemetryAlerts, operationalAlerts] = await Promise.all([
      this.prisma.networkTelemetryAlert.findMany({
        where: { nodeId, isActive: true },
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      }),
      this.prisma.operationalAlert.findMany({
        where: {
          isActive: true,
          OR: [
            { nodeId },
            { monitoringCenterId: context.centerId },
          ],
        },
        orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
      }),
    ]);

    return [...telemetryAlerts, ...operationalAlerts]
      .map((alert) => this.serializeAlert(alert))
      .sort((left, right) => this.compareAlerts(left.severity, right.severity, left.lastSeenAt, right.lastSeenAt));
  }

  getCenterOfficialAssets(centerId: string) {
    return this.prisma.centerAsset.findMany({
      where: { centerId },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
    });
  }

  async getCenterAlerts(centerId: string) {
    const alerts = await this.prisma.operationalAlert.findMany({
      where: { monitoringCenterId: centerId, isActive: true },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
    });
    return alerts.map((alert) => this.serializeAlert(alert));
  }

  async ingestSnapshot(dto: IngestNetworkTelemetryDto) {
    const node = await this.prisma.node.findUniqueOrThrow({ where: { id: dto.nodeId } });
    const capturedAt = new Date(dto.capturedAt);

    return this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.networkTelemetrySnapshot.create({
        data: {
          nodeId: node.id,
          collectorId: dto.collectorId,
          capturedAt,
          windowSeconds: dto.windowSeconds,
          totalBytesIn: BigInt(dto.totals.bytesIn),
          totalBytesOut: BigInt(dto.totals.bytesOut),
          activeHosts: dto.totals.activeHosts,
          activeFlows: dto.totals.activeFlows,
          topProtocolsJson: dto.protocols as unknown as Prisma.InputJsonValue,
          topDestinationsJson: dto.destinations as unknown as Prisma.InputJsonValue,
        },
      });

      const rows = [];
      for (const asset of dto.assets) {
        rows.push(await this.correlateAssetSample(transaction, dto.nodeId, snapshot.id, capturedAt, asset));
      }

      if (rows.length > 0) {
        await transaction.networkTelemetryAssetSample.createMany({ data: rows });
      }

      const alerts = this.deriveSnapshotAlerts(dto, rows);
      for (const alert of alerts) {
        await transaction.networkTelemetryAlert.upsert(alert);
      }
      await this.resolveInactiveUnmatchedTrafficAlerts(transaction, dto, rows);

      return { snapshotId: snapshot.id, samplesStored: rows.length, alertsUpserted: alerts.length };
    });
  }

  correlateTelemetryOwner(host: NtopngObservedHost) {
    return correlateObservedHost(host, {
      findNodeAssetByMac: async () => host.mac
        ? this.prisma.nodeAsset.findFirst({ where: { mac: host.mac } })
        : null,
      findCenterAssetByMac: async () => host.mac
        ? this.prisma.centerAsset.findFirst({ where: { mac: host.mac } })
        : null,
      findNodeAssetByIp: async () => host.ip
        ? this.prisma.nodeAsset.findFirst({ where: { ip: host.ip } })
        : null,
      findCenterAssetByIp: async () => host.ip
        ? this.prisma.centerAsset.findFirst({ where: { ip: host.ip } })
        : null,
      findNodeByPrimaryIp: async () => host.ip
        ? this.prisma.node.findFirst({ where: { primaryIp: host.ip }, select: { id: true } })
        : null,
      findCenterByPrimaryIp: async () => host.ip
        ? this.prisma.monitoringCenter.findFirst({ where: { primaryIp: host.ip }, select: { id: true } })
        : null,
    });
  }

  private async correlateAssetSample(
    prisma: Prisma.TransactionClient,
    nodeId: string,
    snapshotId: string,
    capturedAt: Date,
    asset: IngestNetworkTelemetryDto["assets"][number],
  ) {
    let officialNodeAsset: { id: string; nodeId: string } | null = null;
    const owner = await correlateObservedHost(asset, {
      findNodeAssetByMac: async () => {
        const match = asset.mac
          ? await prisma.nodeAsset.findFirst({ where: { mac: asset.mac } })
          : null;
        officialNodeAsset = match ? { ...match, nodeId: match.nodeId ?? nodeId } : null;
        return officialNodeAsset;
      },
      findCenterAssetByMac: async () => asset.mac
        ? prisma.centerAsset.findFirst({ where: { mac: asset.mac } })
        : null,
      findNodeAssetByIp: async () => {
        const match = asset.ip
          ? await prisma.nodeAsset.findFirst({ where: { ip: asset.ip } })
          : null;
        officialNodeAsset = match ? { ...match, nodeId: match.nodeId ?? nodeId } : null;
        return officialNodeAsset;
      },
      findCenterAssetByIp: async () => asset.ip
        ? prisma.centerAsset.findFirst({ where: { ip: asset.ip } })
        : null,
      findNodeByPrimaryIp: async () => asset.ip
        ? prisma.node.findFirst({ where: { primaryIp: asset.ip }, select: { id: true } })
        : null,
      findCenterByPrimaryIp: async () => asset.ip
        ? prisma.monitoringCenter.findFirst({ where: { primaryIp: asset.ip }, select: { id: true } })
        : null,
    });

    const isLocalNodeOwner = owner.kind === "node" && owner.nodeId === nodeId;
    const nodeAsset: { id: string; nodeId: string } | null = isLocalNodeOwner ? officialNodeAsset : null;

    const discoveryCutoff = new Date(capturedAt.getTime() - 24 * 60 * 60 * 1000);
    const canUseDiscovery = owner.kind === "unmatched" && owner.reason === "NO_MATCH";
    const discoveryByMac = canUseDiscovery && asset.mac
      ? await prisma.nodeDiscoveredDevice.findFirst({
        where: { mac: asset.mac, createdAt: { gte: discoveryCutoff }, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
      : null;

    const discoveryByIp = canUseDiscovery && !discoveryByMac && asset.ip
      ? await prisma.nodeDiscoveredDevice.findFirst({
        where: { ip: asset.ip, createdAt: { gte: discoveryCutoff }, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
      : null;

    return {
      snapshotId,
      nodeId,
      nodeAssetId: (nodeAsset as { id: string } | null)?.id ?? null,
      ip: asset.ip ?? null,
      mac: asset.mac ?? null,
      hostname: asset.hostname ?? null,
      bytesIn: BigInt(asset.bytesIn),
      bytesOut: BigInt(asset.bytesOut),
      flowCount: asset.flowCount,
      lastSeenAt: new Date(asset.lastSeenAt),
      classificationSource: nodeAsset || isLocalNodeOwner
        ? NetworkTelemetryClassificationSource.OFFICIAL
        : discoveryByMac || discoveryByIp
          ? NetworkTelemetryClassificationSource.DISCOVERY
          : NetworkTelemetryClassificationSource.UNMATCHED,
    };
  }

  private deriveSnapshotAlerts(
    dto: IngestNetworkTelemetryDto,
    rows: Array<{
      ip: string | null;
      mac: string | null;
      classificationSource: NetworkTelemetryClassificationSource;
    }>,
  ) {
    return rows
      .filter((row) => row.classificationSource === NetworkTelemetryClassificationSource.UNMATCHED)
      .map((row) => ({
        where: {
          nodeId_kind_title: {
            nodeId: dto.nodeId,
            kind: NetworkTelemetryAlertKind.UNMATCHED_TRAFFIC,
            title: `Tráfico no correlacionado ${row.ip ?? row.mac ?? "desconocido"}`,
          },
        },
        create: {
          nodeId: dto.nodeId,
          kind: NetworkTelemetryAlertKind.UNMATCHED_TRAFFIC,
          severity: NetworkTelemetryAlertSeverity.INFO,
          title: `Tráfico no correlacionado ${row.ip ?? row.mac ?? "desconocido"}`,
          detail: "Se detectó tráfico de un host sin correlación con activos oficiales ni discovery reciente.",
          firstSeenAt: new Date(dto.capturedAt),
          lastSeenAt: new Date(dto.capturedAt),
          isActive: true,
        },
        update: {
          lastSeenAt: new Date(dto.capturedAt),
          isActive: true,
          resolvedAt: null,
        },
      }));
  }

  private resolveInactiveUnmatchedTrafficAlerts(
    prisma: Prisma.TransactionClient,
    dto: IngestNetworkTelemetryDto,
    rows: Array<{
      ip: string | null;
      mac: string | null;
      classificationSource: NetworkTelemetryClassificationSource;
    }>,
  ) {
    const activeTitles = rows
      .filter((row) => row.classificationSource === NetworkTelemetryClassificationSource.UNMATCHED)
      .map((row) => `Tráfico no correlacionado ${row.ip ?? row.mac ?? "desconocido"}`);

    return prisma.networkTelemetryAlert.updateMany({
      where: {
        nodeId: dto.nodeId,
        kind: NetworkTelemetryAlertKind.UNMATCHED_TRAFFIC,
        isActive: true,
        ...(activeTitles.length > 0 ? { title: { notIn: activeTitles } } : {}),
      },
      data: {
        isActive: false,
        resolvedAt: new Date(dto.capturedAt),
      },
    });
  }

  private async nodeExists(nodeId: string) {
    return (await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true },
    })) !== null;
  }

  private getNodeContext(nodeId: string) {
    return this.prisma.node.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        route: { select: { monitoringCenterId: true } },
      },
    }).then((node) => node ? {
      nodeId: node.id,
      centerId: "route" in node && node.route ? node.route.monitoringCenterId : "",
    } : null);
  }

  private async countNodeMonitorAlerts(nodeId: string, centerId: string) {
    const [telemetryAlertCount, operationalAlertCount] = await Promise.all([
      this.prisma.networkTelemetryAlert.count({
        where: { nodeId, isActive: true },
      }),
      this.prisma.operationalAlert.count({
        where: {
          isActive: true,
          OR: [
            { nodeId },
            { monitoringCenterId: centerId },
          ],
        },
      }),
    ]);
    return telemetryAlertCount + operationalAlertCount;
  }

  private serializeAlert(
    alert: {
      id: string;
      kind: string;
      severity: NetworkTelemetryAlertSeverity;
      title: string;
      detail: string;
      lastSeenAt: Date;
      createdAt: Date;
      resolvedAt: Date | null;
      isActive: boolean;
    },
  ) {
    return {
      id: alert.id,
      kind: alert.kind,
      severity: alert.severity,
      title: alert.title,
      detail: alert.detail,
      lastSeenAt: alert.lastSeenAt,
      createdAt: alert.createdAt,
      resolvedAt: alert.resolvedAt,
      isActive: alert.isActive,
    };
  }

  private compareAlerts(
    leftSeverity: NetworkTelemetryAlertSeverity,
    rightSeverity: NetworkTelemetryAlertSeverity,
    leftLastSeenAt: Date,
    rightLastSeenAt: Date,
  ) {
    const severityRank = { CRITICAL: 3, WARNING: 2, INFO: 1 };
    const leftRank = severityRank[leftSeverity] ?? 0;
    const rightRank = severityRank[rightSeverity] ?? 0;
    if (leftRank !== rightRank) return rightRank - leftRank;
    return rightLastSeenAt.getTime() - leftLastSeenAt.getTime();
  }

  private async deriveSilentAlerts(nodeId: string, latestCapturedAt: Date | null) {
    const now = new Date();
    const nodeSilentAlert = deriveNodeSilentAlert(nodeId, latestCapturedAt, now);
    if (nodeSilentAlert) {
      await this.prisma.networkTelemetryAlert.upsert(nodeSilentAlert);
    } else {
      await this.prisma.networkTelemetryAlert.updateMany({
        where: {
          nodeId,
          kind: NetworkTelemetryAlertKind.NODE_SILENT,
          isActive: true,
        },
        data: {
          isActive: false,
          resolvedAt: now,
        },
      });
    }

    const cutoff = new Date(now.getTime() - TELEMETRY_SILENCE_WINDOW_MS);
    const [assets, recentSamples] = await Promise.all([
      this.prisma.nodeAsset.findMany({
        where: { nodeId },
        select: { id: true, name: true },
      }),
      this.prisma.networkTelemetryAssetSample.findMany({
        where: {
          nodeId,
          nodeAssetId: { not: null },
          snapshot: { capturedAt: { gte: cutoff } },
        },
        select: { nodeAssetId: true },
      }),
    ]);
    const visibleAssetIds = new Set(
      recentSamples.flatMap((sample) => sample.nodeAssetId ? [sample.nodeAssetId] : []),
    );
    const currentAssetIds = assets.map((asset) => asset.id);

    if (visibleAssetIds.size > 0) {
      await this.prisma.networkTelemetryAlert.updateMany({
        where: {
          nodeId,
          nodeAssetId: { in: [...visibleAssetIds] },
          kind: NetworkTelemetryAlertKind.ASSET_SILENT,
          isActive: true,
        },
        data: {
          isActive: false,
          resolvedAt: now,
        },
      });
    }

    await this.prisma.networkTelemetryAlert.updateMany({
      where: {
        nodeId,
        nodeAssetId: { notIn: currentAssetIds },
        kind: NetworkTelemetryAlertKind.ASSET_SILENT,
        isActive: true,
      },
      data: {
        isActive: false,
        resolvedAt: now,
      },
    });

    for (const alert of deriveSilentAssetAlerts(nodeId, assets, visibleAssetIds, now)) {
      await this.prisma.networkTelemetryAlert.upsert(alert);
    }
  }
}

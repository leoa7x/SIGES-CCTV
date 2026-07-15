import { Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import {
  NetworkTelemetryAlertKind,
  NetworkTelemetryAlertSeverity,
  NetworkTelemetryClassificationSource,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import {
  deriveNodeSilentAlert,
  deriveSilentAssetAlerts,
  TELEMETRY_SILENCE_WINDOW_MS,
} from "./network-telemetry.alerts";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";

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
    if (!await this.nodeExists(nodeId)) {
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
    const alertCount = await this.prisma.networkTelemetryAlert.count({
      where: { nodeId, isActive: true },
    });
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
    if (!await this.nodeExists(nodeId)) return [];

    const snapshot = await this.prisma.networkTelemetrySnapshot.findFirst({
      where: { nodeId },
      orderBy: { capturedAt: "desc" },
    });
    await this.deriveSilentAlerts(nodeId, snapshot?.capturedAt ?? null);
    return this.prisma.networkTelemetryAlert.findMany({
      where: { nodeId, isActive: true },
      orderBy: [{ severity: "desc" }, { lastSeenAt: "desc" }],
    });
  }

  getCenterOfficialAssets(centerId: string) {
    return this.prisma.centerAsset.findMany({
      where: { centerId },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
    });
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

      return { snapshotId: snapshot.id, samplesStored: rows.length, alertsUpserted: alerts.length };
    });
  }

  private async correlateAssetSample(
    prisma: Prisma.TransactionClient,
    nodeId: string,
    snapshotId: string,
    capturedAt: Date,
    asset: IngestNetworkTelemetryDto["assets"][number],
  ) {
    const officialByMac = asset.mac
      ? await prisma.nodeAsset.findFirst({ where: { nodeId, mac: asset.mac } })
      : null;

    const officialByIp = !officialByMac && asset.ip
      ? await prisma.nodeAsset.findFirst({ where: { nodeId, ip: asset.ip } })
      : null;

    const discoveryCutoff = new Date(capturedAt.getTime() - 24 * 60 * 60 * 1000);
    const discoveryByMac = !officialByMac && !officialByIp && asset.mac
      ? await prisma.nodeDiscoveredDevice.findFirst({
        where: { mac: asset.mac, createdAt: { gte: discoveryCutoff }, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
      : null;

    const discoveryByIp = !officialByMac && !officialByIp && !discoveryByMac && asset.ip
      ? await prisma.nodeDiscoveredDevice.findFirst({
        where: { ip: asset.ip, createdAt: { gte: discoveryCutoff }, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
      : null;

    return {
      snapshotId,
      nodeId,
      nodeAssetId: officialByMac?.id ?? officialByIp?.id ?? null,
      ip: asset.ip ?? null,
      mac: asset.mac ?? null,
      hostname: asset.hostname ?? null,
      bytesIn: BigInt(asset.bytesIn),
      bytesOut: BigInt(asset.bytesOut),
      flowCount: asset.flowCount,
      lastSeenAt: new Date(asset.lastSeenAt),
      classificationSource: officialByMac || officialByIp
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

  private async nodeExists(nodeId: string) {
    return (await this.prisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true },
    })) !== null;
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

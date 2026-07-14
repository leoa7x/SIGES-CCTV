import { Injectable } from "@nestjs/common";
import {
  NetworkTelemetryAlertKind,
  NetworkTelemetryAlertSeverity,
  NetworkTelemetryClassificationSource,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";

@Injectable()
export class NetworkTelemetryService {
  constructor(private prisma: PrismaService) {}

  async ingestSnapshot(dto: IngestNetworkTelemetryDto) {
    const node = await this.prisma.node.findUniqueOrThrow({ where: { id: dto.nodeId } });

    const snapshot = await this.prisma.networkTelemetrySnapshot.create({
      data: {
        nodeId: node.id,
        collectorId: dto.collectorId,
        capturedAt: new Date(dto.capturedAt),
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
      rows.push(await this.correlateAssetSample(dto.nodeId, snapshot.id, asset));
    }

    if (rows.length > 0) {
      await this.prisma.networkTelemetryAssetSample.createMany({ data: rows });
    }

    const alerts = this.deriveSnapshotAlerts(dto, rows);
    for (const alert of alerts) {
      await this.prisma.networkTelemetryAlert.upsert(alert);
    }

    return { snapshotId: snapshot.id, samplesStored: rows.length, alertsUpserted: alerts.length };
  }

  private async correlateAssetSample(
    nodeId: string,
    snapshotId: string,
    asset: IngestNetworkTelemetryDto["assets"][number],
  ) {
    const officialByMac = asset.mac
      ? await this.prisma.nodeAsset.findFirst({ where: { nodeId, mac: asset.mac } })
      : null;

    const officialByIp = !officialByMac && asset.ip
      ? await this.prisma.nodeAsset.findFirst({ where: { nodeId, ip: asset.ip } })
      : null;

    const discoveryByMac = !officialByMac && !officialByIp && asset.mac
      ? await this.prisma.nodeDiscoveredDevice.findFirst({
        where: { mac: asset.mac, nodeDiscoveryJob: { nodeId } },
        orderBy: { createdAt: "desc" },
      })
      : null;

    const discoveryByIp = !officialByMac && !officialByIp && !discoveryByMac && asset.ip
      ? await this.prisma.nodeDiscoveredDevice.findFirst({
        where: { ip: asset.ip, nodeDiscoveryJob: { nodeId } },
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
}

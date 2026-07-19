import { Injectable } from "@nestjs/common";
import {
  NetworkTelemetryAlertSeverity,
  OperationalAlertKind,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

type AlertTarget =
  | { scope: "node"; nodeId: string }
  | { scope: "center"; monitoringCenterId: string }
  | { scope: "node-asset"; nodeId: string; nodeAssetId: string }
  | { scope: "center-asset"; monitoringCenterId: string; centerAssetId: string };

type EnsureAlertInput = AlertTarget & {
  kind: OperationalAlertKind;
  severity: NetworkTelemetryAlertSeverity;
  title: string;
  detail: string;
  checkedAt: Date;
  metadataJson?: Prisma.InputJsonValue;
};

@Injectable()
export class OperationalAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAlert(input: EnsureAlertInput) {
    const scopeKey = this.scopeKey(input);
    await this.prisma.operationalAlert.upsert({
      where: { scopeKey },
      create: {
        scopeKey,
        nodeId: "nodeId" in input ? input.nodeId : null,
        monitoringCenterId: "monitoringCenterId" in input ? input.monitoringCenterId : null,
        nodeAssetId: "nodeAssetId" in input ? input.nodeAssetId : null,
        centerAssetId: "centerAssetId" in input ? input.centerAssetId : null,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        detail: input.detail,
        metadataJson: input.metadataJson,
        firstSeenAt: input.checkedAt,
        lastSeenAt: input.checkedAt,
        isActive: true,
      },
      update: {
        severity: input.severity,
        detail: input.detail,
        metadataJson: input.metadataJson,
        lastSeenAt: input.checkedAt,
        isActive: true,
        resolvedAt: null,
      },
    });
  }

  async resolveAlerts(target: AlertTarget, kind: OperationalAlertKind) {
    await this.prisma.operationalAlert.updateMany({
      where: {
        isActive: true,
        kind,
        ...(target.scope === "node" ? { nodeId: target.nodeId } : {}),
        ...(target.scope === "center" ? { monitoringCenterId: target.monitoringCenterId } : {}),
        ...(target.scope === "node-asset" ? { nodeAssetId: target.nodeAssetId } : {}),
        ...(target.scope === "center-asset" ? { centerAssetId: target.centerAssetId } : {}),
      },
      data: {
        isActive: false,
        resolvedAt: new Date(),
      },
    });
  }

  private scopeKey(target: AlertTarget & { kind: OperationalAlertKind; title: string }) {
    if (target.scope === "node") return `node:${target.nodeId}:${target.kind}:${target.title}`;
    if (target.scope === "center") return `center:${target.monitoringCenterId}:${target.kind}:${target.title}`;
    if (target.scope === "node-asset") return `node-asset:${target.nodeAssetId}:${target.kind}:${target.title}`;
    return `center-asset:${target.centerAssetId}:${target.kind}:${target.title}`;
  }
}

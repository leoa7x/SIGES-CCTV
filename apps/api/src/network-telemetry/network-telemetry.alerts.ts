import {
  NetworkTelemetryAlertKind,
  NetworkTelemetryAlertSeverity,
} from "@prisma/client";

export const TELEMETRY_SILENCE_WINDOW_MS = 120_000;

type OfficialAsset = {
  id: string;
  name: string;
};

function toUpsertAlert(create: {
  nodeId: string;
  nodeAssetId?: string;
  kind: NetworkTelemetryAlertKind;
  severity: NetworkTelemetryAlertSeverity;
  title: string;
  detail: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
}) {
  return {
    where: {
      nodeId_kind_title: {
        nodeId: create.nodeId,
        kind: create.kind,
        title: create.title,
      },
    },
    create,
    update: {
      lastSeenAt: create.lastSeenAt,
      isActive: true,
      resolvedAt: null,
    },
  };
}

export function deriveNodeSilentAlert(nodeId: string, latestCapturedAt: Date | null, now: Date) {
  if (latestCapturedAt && now.getTime() - latestCapturedAt.getTime() <= TELEMETRY_SILENCE_WINDOW_MS) {
    return null;
  }

  return toUpsertAlert({
    nodeId,
    kind: NetworkTelemetryAlertKind.NODE_SILENT,
    severity: NetworkTelemetryAlertSeverity.CRITICAL,
    title: "Nodo sin snapshots recientes",
    detail: "No se recibió telemetría reciente para el nodo dentro de la ventana esperada.",
    firstSeenAt: now,
    lastSeenAt: now,
    isActive: true,
  });
}

export function deriveSilentAssetAlerts(
  nodeId: string,
  assets: OfficialAsset[],
  visibleAssetIds: Set<string>,
  now: Date,
) {
  return assets
    .filter((asset) => !visibleAssetIds.has(asset.id))
    .map((asset) => toUpsertAlert({
      nodeId,
      nodeAssetId: asset.id,
      kind: NetworkTelemetryAlertKind.ASSET_SILENT,
      severity: NetworkTelemetryAlertSeverity.WARNING,
      title: `Activo sin telemetría reciente ${asset.id}`,
      detail: "El activo oficial no tuvo muestras de telemetría dentro de la ventana esperada.",
      firstSeenAt: now,
      lastSeenAt: now,
      isActive: true,
    }));
}

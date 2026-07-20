export type TelemetryOwner = {
  kind: "node" | "center" | "unmatched";
  nodeId?: string;
  centerId?: string;
  reason?: string;
};

type ObservedHost = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn?: number;
  bytesOut?: number;
  flowCount?: number;
  lastSeenAt?: string;
};

type CorrelationDeps = {
  findNodeAssetByMac: () => Promise<{ id: string; nodeId: string } | null>;
  findCenterAssetByMac: () => Promise<{ id: string; centerId: string } | null>;
  findNodeAssetByIp: () => Promise<{ id: string; nodeId: string } | null>;
  findCenterAssetByIp: () => Promise<{ id: string; centerId: string } | null>;
  findNodeByPrimaryIp: () => Promise<{ id: string } | null>;
  findCenterByPrimaryIp: () => Promise<{ id: string } | null>;
};

function resolveCandidates(
  node: { id: string; nodeId?: string } | null,
  center: { id: string; centerId?: string } | null,
  kind: "asset" | "primary IP",
): TelemetryOwner | null {
  if (node && center) return { kind: "unmatched", reason: `AMBIGUOUS_MATCH_${kind.toUpperCase().replace(" ", "_")}` };
  if (node) return { kind: "node", nodeId: node.nodeId ?? node.id };
  if (center) return { kind: "center", centerId: center.centerId ?? center.id };
  return null;
}

export async function correlateObservedHost(
  host: ObservedHost,
  deps: CorrelationDeps,
): Promise<TelemetryOwner> {
  if (host.mac) {
    const result = resolveCandidates(
      await deps.findNodeAssetByMac(),
      await deps.findCenterAssetByMac(),
      "asset",
    );
    if (result) return result;
  }

  if (host.ip) {
    const result = resolveCandidates(
      await deps.findNodeAssetByIp(),
      await deps.findCenterAssetByIp(),
      "asset",
    );
    if (result) return result;

    const primaryResult = resolveCandidates(
      await deps.findNodeByPrimaryIp(),
      await deps.findCenterByPrimaryIp(),
      "primary IP",
    );
    if (primaryResult) return primaryResult;
  }

  return { kind: "unmatched", reason: "NO_MATCH" };
}

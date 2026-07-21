import type { TelemetryOwner } from "./network-telemetry-correlation";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";
import { NtopngObservedHost, NtopngCollectorDependencies } from "./network-telemetry.types";

export class NtopngCollectorService {
  constructor(private readonly deps: NtopngCollectorDependencies) {}

  async buildSnapshots(capturedAt: string, hosts: NtopngObservedHost[]): Promise<IngestNetworkTelemetryDto[]> {
    const groups = new Map<string, NtopngObservedHost[]>();
    const unmatchedByCenter = new Map<string, Array<{ ip?: string; mac?: string; hostname?: string }>>();

    for (const host of hosts) {
      const owner: TelemetryOwner = await this.deps.correlateHost(host);
      if (owner.kind === "unmatched") {
        if (owner.centerId) {
          const list = unmatchedByCenter.get(owner.centerId) ?? [];
          list.push({ ip: host.ip, mac: host.mac, hostname: host.hostname });
          unmatchedByCenter.set(owner.centerId, list);
        }
        continue;
      }
      if (owner.kind !== "node" || !owner.nodeId) continue;
      const list = groups.get(owner.nodeId) ?? [];
      list.push(host);
      groups.set(owner.nodeId, list);
    }

    if (this.deps.externalDiscovery) {
      for (const [centerId, devices] of unmatchedByCenter.entries()) {
        await this.deps.externalDiscovery.upsertScanFindings(centerId, null, null, devices, "NTOPNG");
      }
    }

    return [...groups.entries()].map(([nodeId, nodeHosts]) => ({
      nodeId,
      collectorId: "ntopng-local",
      capturedAt,
      windowSeconds: this.deps.intervalSeconds ?? 60,
      totals: {
        bytesIn: nodeHosts.reduce((sum, host) => sum + host.bytesIn, 0),
        bytesOut: nodeHosts.reduce((sum, host) => sum + host.bytesOut, 0),
        activeHosts: nodeHosts.length,
        activeFlows: nodeHosts.reduce((sum, host) => sum + host.flowCount, 0),
      },
      protocols: this.aggregateProtocols(nodeHosts),
      destinations: [],
      assets: nodeHosts,
    }));
  }

  private aggregateProtocols(hosts: NtopngObservedHost[]) {
    const totals = new Map<string, { name: string; bytes: number; flowCount: number }>();

    for (const host of hosts) {
      for (const protocol of host.protocols ?? []) {
        const current = totals.get(protocol.name) ?? { name: protocol.name, bytes: 0, flowCount: 0 };
        current.bytes += protocol.bytes;
        current.flowCount += protocol.flowCount;
        totals.set(protocol.name, current);
      }
    }

    return [...totals.values()]
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8);
  }
}

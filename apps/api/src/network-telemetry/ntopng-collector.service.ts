import type { TelemetryOwner } from "./network-telemetry-correlation";
import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";
import { NtopngObservedHost, NtopngCollectorDependencies } from "./network-telemetry.types";

export class NtopngCollectorService {
  constructor(private readonly deps: NtopngCollectorDependencies) {}

  async buildSnapshots(capturedAt: string, hosts: NtopngObservedHost[]): Promise<IngestNetworkTelemetryDto[]> {
    const groups = new Map<string, NtopngObservedHost[]>();

    for (const host of hosts) {
      const owner: TelemetryOwner = await this.deps.correlateHost(host);
      if (owner.kind !== "node" || !owner.nodeId) continue;
      const list = groups.get(owner.nodeId) ?? [];
      list.push(host);
      groups.set(owner.nodeId, list);
    }

    return [...groups.entries()].map(([nodeId, nodeHosts]) => ({
      nodeId,
      collectorId: "ntopng-local",
      capturedAt,
      windowSeconds: 60,
      totals: {
        bytesIn: nodeHosts.reduce((sum, host) => sum + host.bytesIn, 0),
        bytesOut: nodeHosts.reduce((sum, host) => sum + host.bytesOut, 0),
        activeHosts: nodeHosts.length,
        activeFlows: nodeHosts.reduce((sum, host) => sum + host.flowCount, 0),
      },
      protocols: [],
      destinations: [],
      assets: nodeHosts,
    }));
  }
}

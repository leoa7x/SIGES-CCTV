import { PrismaService } from "../src/prisma/prisma.service";
import { ExternalDiscoveryService } from "../src/external-discovery/external-discovery.service";
import { NetworkTelemetryService } from "../src/network-telemetry/network-telemetry.service";
import { NtopngCollectorService } from "../src/network-telemetry/ntopng-collector.service";
import { NtopngClient } from "../src/network-telemetry/ntopng-client";

type CollectorPayload = {
  nodeId: string;
  collectorId: string;
  capturedAt: string;
  windowSeconds: number;
  totals: { bytesIn: number; bytesOut: number; activeHosts: number; activeFlows: number };
  protocols: unknown[];
  destinations: unknown[];
  assets: unknown[];
};

export async function runCollectorCycle(deps: {
  fetchHosts: () => Promise<any[]>;
  buildSnapshots: (capturedAt: string, hosts: any[]) => Promise<CollectorPayload[]>;
  postSnapshot: (payload: CollectorPayload) => Promise<void>;
}) {
  const capturedAt = new Date().toISOString();
  const hosts = await deps.fetchHosts();
  const payloads = await deps.buildSnapshots(capturedAt, hosts);
  for (const payload of payloads) {
    await deps.postSnapshot(payload);
  }
}

async function main() {
  const ntopngBaseUrl = process.env.NTOPNG_BASE_URL?.trim();
  const ntopngUsername = process.env.NTOPNG_USERNAME?.trim();
  const ntopngPassword = process.env.NTOPNG_PASSWORD?.trim();
  const ingestBaseUrl = process.env.NETWORK_TELEMETRY_INGEST_URL?.trim();
  const ingestToken = process.env.NETWORK_TELEMETRY_INGEST_TOKEN?.trim();
  const intervalSeconds = Number(process.env.NTOPNG_COLLECTION_INTERVAL_SECONDS?.trim() ?? "60");

  if (!ntopngBaseUrl || !ntopngUsername || !ntopngPassword) {
    throw new Error("NTOPNG_BASE_URL, NTOPNG_USERNAME, and NTOPNG_PASSWORD are required");
  }
  if (!ingestBaseUrl || !ingestToken) {
    throw new Error("NETWORK_TELEMETRY_INGEST_URL and NETWORK_TELEMETRY_INGEST_TOKEN are required");
  }
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error("NTOPNG_COLLECTION_INTERVAL_SECONDS must be a positive number");
  }

  const prisma = new PrismaService();
  const telemetryService = new NetworkTelemetryService(prisma);
  const externalDiscoveryService = new ExternalDiscoveryService(prisma);

  try {
    await prisma.$connect();
    const [nodes, nodeAssets, centers, centerAssets] = await Promise.all([
      prisma.node.findMany({ select: { primaryIp: true } }),
      prisma.nodeAsset.findMany({ select: { ip: true } }),
      prisma.monitoringCenter.findMany({ select: { primaryIp: true } }),
      prisma.centerAsset.findMany({ select: { ip: true } }),
    ]);
    const seedHosts = [
      ...nodes.map((item) => item.primaryIp),
      ...nodeAssets.map((item) => item.ip),
      ...centers.map((item) => item.primaryIp),
      ...centerAssets.map((item) => item.ip),
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

    const ntopngClient = new NtopngClient({
      baseUrl: ntopngBaseUrl,
      username: ntopngUsername,
      password: ntopngPassword,
      seedHosts,
    });
    const collector = new NtopngCollectorService({
      correlateHost: (host) => telemetryService.correlateTelemetryOwner(host),
      intervalSeconds,
      externalDiscovery: externalDiscoveryService,
    });

    await runCollectorCycle({
      fetchHosts: () => ntopngClient.fetchObservedHosts(),
      buildSnapshots: (capturedAt, hosts) => collector.buildSnapshots(capturedAt, hosts),
      postSnapshot: async (payload) => {
        const response = await fetch(`${ingestBaseUrl}/network-telemetry/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ingestToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(`ingest failed with ${response.status}`);
        }
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}

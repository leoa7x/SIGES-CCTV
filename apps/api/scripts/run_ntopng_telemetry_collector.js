/*
 * Production runner for the ntopng collector.
 *
 * The TypeScript source runner is useful from a developer checkout. The API
 * image contains compiled application modules, so this CommonJS entry point
 * keeps the collector runnable without copying TypeScript source or a compiler
 * into a production container.
 */
const { PrismaService } = require("../dist/prisma/prisma.service");
const { ExternalDiscoveryService } = require("../dist/external-discovery/external-discovery.service");
const { NetworkTelemetryService } = require("../dist/network-telemetry/network-telemetry.service");
const { NtopngCollectorService } = require("../dist/network-telemetry/ntopng-collector.service");
const { NtopngClient } = require("../dist/network-telemetry/ntopng-client");

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
  try {
    await prisma.$connect();
    const [nodes, nodeAssets, centers, centerAssets] = await Promise.all([
      prisma.node.findMany({ select: { primaryIp: true } }),
      prisma.nodeAsset.findMany({ select: { ip: true } }),
      prisma.monitoringCenter.findMany({ select: { primaryIp: true } }),
      prisma.centerAsset.findMany({ select: { ip: true } }),
    ]);
    const seedHosts = [...nodes, ...nodeAssets, ...centers, ...centerAssets]
      .map((item) => item.primaryIp ?? item.ip)
      .filter((value) => typeof value === "string" && value.trim().length > 0);
    const telemetry = new NetworkTelemetryService(prisma);
    const collector = new NtopngCollectorService({
      correlateHost: (host) => telemetry.correlateTelemetryOwner(host),
      intervalSeconds,
      externalDiscovery: new ExternalDiscoveryService(prisma),
    });
    const ntopng = new NtopngClient({
      baseUrl: ntopngBaseUrl,
      username: ntopngUsername,
      password: ntopngPassword,
      seedHosts,
    });
    const capturedAt = new Date().toISOString();
    const payloads = await collector.buildSnapshots(capturedAt, await ntopng.fetchObservedHosts());
    for (const payload of payloads) {
      const response = await fetch(`${ingestBaseUrl}/network-telemetry/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ingestToken}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`ingest failed with ${response.status}`);
    }
    console.log(`Telemetry cycle completed: ${payloads.length} snapshot(s)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

const { PrismaService } = require("../dist/prisma/prisma.service");

const forbiddenValues = new Set([
  "dev_secret_change_me",
  "change_this_to_a_random_256bit_secret_in_production",
  "change_this_refresh_secret_too",
  "change_me_for_camera_stream_credentials",
  "change-me",
  "change-me-in-production",
  "siges_pass_change_me",
  "siges_minio_change_me",
  "admin1234!",
  "admin",
]);
const required = [
  "JWT_SECRET", "JWT_REFRESH_SECRET", "CAMERA_SECRET_KEY", "MONITOR_API_TOKEN",
  "NETWORK_TELEMETRY_INGEST_TOKEN", "LAN_DISCOVERY_AGENT_TOKEN", "POSTGRES_PASSWORD", "MINIO_PASSWORD",
  "GRAFANA_ADMIN_PASSWORD", "REDPANDA_BROKERS", "CORS_ORIGIN", "NEXT_PUBLIC_API_URL",
  "LAN_ORANGUTAN_CMD", "NTOPNG_BASE_URL", "NTOPNG_USERNAME", "NTOPNG_PASSWORD",
];

async function main() {
  const errors = [];
  if (process.env.NODE_ENV !== "production") errors.push("NODE_ENV must be production");
  if (process.env.SIGES_STRICT_PRODUCTION !== "true") errors.push("SIGES_STRICT_PRODUCTION must be true");
  if (process.env.DISCOVERY_ALLOW_MOCK === "true") errors.push("DISCOVERY_ALLOW_MOCK=true is forbidden");
  for (const name of required) {
    const value = process.env[name]?.trim();
    if (!value) errors.push(`${name} is required`);
    else if (forbiddenValues.has(value.toLowerCase())) errors.push(`${name} still has a development placeholder`);
  }
  const isSingleHost = process.env.SIGES_SINGLE_HOST === "true";
  for (const name of ["CORS_ORIGIN", "NEXT_PUBLIC_API_URL", "MINIO_PUBLIC_URL"]) {
    if (!isSingleHost && process.env[name]?.includes("localhost")) {
      errors.push(`${name} must not point to localhost outside single-host mode`);
    }
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const [demoCenter, demoProject, totalCenters, totalNodes] = await Promise.all([
      prisma.monitoringCenter.count({ where: { id: "demo-center-001" } }),
      prisma.project.count({ where: { id: "demo-project-001" } }),
      prisma.monitoringCenter.count(),
      prisma.node.count(),
    ]);
    if (demoCenter || demoProject) errors.push("demo entities are still present in the database");
    if (!totalCenters || !totalNodes) errors.push("production inventory needs at least one CMC and one node");
  } finally {
    await prisma.$disconnect();
  }

  if (errors.length) {
    console.error("Production readiness failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Production readiness passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

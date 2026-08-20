#!/usr/bin/env node

/*
 * Applies the reviewed Puerto Gaitán manifest to an empty SIGES database.
 * It deliberately does not import stream passwords or enable previews: those
 * are commissioned later through the API once the final CAMERA_SECRET_KEY is
 * installed on the production server.
 */

const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const apply = process.argv.includes("--apply");
const manifestPath = path.resolve(process.cwd(), "import-staging/puerto-gaitan-preflight.json");

function cameraBrand(model) {
  if (!model) return null;
  if (/^(DH-|DHI-)/i.test(model)) return "Dahua";
  if (/^(XNO|XNP)/i.test(model)) return "Hanwha Vision";
  if (/^BN/i.test(model)) return "Bolide";
  return null;
}

function assetType(asset) {
  return asset.assetType === "NETWORK_SWITCH" ? "SWITCH" : "OTHER";
}

async function main() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}. Run prepare_puerto_gaitan_import.py first.`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.summary.cameras !== 121 || manifest.summary.nodes !== 48) {
    throw new Error("Manifest does not have the approved 48 nodes / 121 cameras inventory");
  }
  if (manifest.exceptions.some((item) => item.type === "UNEXPECTED_CAMERA_COUNT" || item.type === "MISSING_POSTS")) {
    throw new Error("Manifest contains structural errors; review it before importing");
  }

  const summary = {
    city: "Puerto Gaitán, Meta",
    project: manifest.project.name,
    center: manifest.monitoringCenter.name,
    route: "RUTA-PRINCIPAL-PUERTO-GAITAN (HYBRID, provisional)",
    nodes: manifest.nodes.length,
    switches: manifest.summary.switches,
    cameras: manifest.cameras.length,
    offlineCameras: manifest.summary.knownOfflineCameras,
    nodeAssets: manifest.assets.filter((asset) => asset.scope === "NODE").length,
    centerAssets: manifest.assets.filter((asset) => asset.scope === "CMC").length,
    streamCredentialsImported: false,
    previewEnabled: false,
  };
  if (!apply) {
    console.log(JSON.stringify({ mode: "DRY_RUN", ...summary }, null, 2));
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await Promise.all([
      prisma.city.count(), prisma.project.count(), prisma.monitoringCenter.count(),
      prisma.route.count(), prisma.node.count(), prisma.camera.count(),
    ]);
    if (existing.some(Boolean)) {
      throw new Error("Target database is not empty. This importer refuses to merge or replace existing inventory.");
    }

    await prisma.$transaction(async (tx) => {
      const city = await tx.city.create({
        data: { name: "Puerto Gaitán", department: "Meta", lat: manifest.monitoringCenter.lat, lng: manifest.monitoringCenter.lng },
      });
      const project = await tx.project.create({
        data: {
          name: manifest.project.name,
          client: manifest.project.client,
          contract: "1445 DE 2024",
          startDate: new Date(`${manifest.project.startDate}T00:00:00.000Z`),
          cityId: city.id,
        },
      });
      const center = await tx.monitoringCenter.create({
        data: { ...manifest.monitoringCenter, projectId: project.id, operativeState: "ONLINE" },
      });
      // The inventory only establishes ownership. Physical fibre topology can
      // be added later without changing the node/camera records.
      const route = await tx.route.create({
        data: { identifier: "RUTA-PRINCIPAL-PUERTO-GAITAN", type: "HYBRID", monitoringCenterId: center.id },
      });
      const nodesByCode = new Map();
      for (const item of manifest.nodes) {
        const node = await tx.node.create({
          data: {
            code: item.code, name: item.name, lat: item.lat, lng: item.lng,
            ip: item.switch?.ip ?? null, primaryIp: item.switch?.ip ?? null,
            nodeType: "SWITCH", hasPole: true, routeId: route.id, operativeState: "ONLINE",
          },
        });
        nodesByCode.set(item.code, node.id);
        if (item.switch) {
          await tx.nodeAsset.create({
            data: {
              nodeId: node.id, assetType: "SWITCH", name: `Switch — ${item.name}`,
              ip: item.switch.ip, source: "MANUAL", operativeState: "ONLINE",
            },
          });
        }
      }
      for (const item of manifest.cameras) {
        await tx.camera.create({
          data: {
            code: item.code, name: item.name, ip: item.ip, nodeId: nodesByCode.get(item.nodeCode),
            brand: cameraBrand(item.model), model: item.model,
            state: item.operativeState === "OFFLINE" ? "OFFLINE" : "ONLINE",
            streamTransport: "TCP", previewEnabled: false,
          },
        });
      }
      for (const item of manifest.assets) {
        const notes = item.assetType === "IP_SPEAKER" ? "Altavoz IP; no es cámara." : "Lector biométrico del CMC; no es cámara.";
        const data = {
          assetType: assetType(item), name: item.name, ip: item.ip,
          model: item.model ?? null, source: "MANUAL", notes,
          operativeState: "ONLINE",
        };
        if (item.scope === "CMC") await tx.centerAsset.create({ data: { ...data, centerId: center.id } });
        else await tx.nodeAsset.create({ data: { ...data, nodeId: nodesByCode.get(`PG-POSTE-${String(item.post).padStart(3, "0")}`) } });
      }
    }, { timeout: 60_000 });
    console.log(JSON.stringify({ mode: "APPLIED", ...summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

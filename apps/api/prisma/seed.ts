import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for db:seed");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        name: "Administrador SIGES",
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Admin user created: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  // Demo city + project structure
  const city = await prisma.city.upsert({
    where: { id: "demo-city-001" },
    update: {},
    create: { id: "demo-city-001", name: "Bogotá D.C.", department: "Cundinamarca" },
  });

  const project = await prisma.project.upsert({
    where: { id: "demo-project-001" },
    update: {},
    create: { id: "demo-project-001", name: "Red CCTV Norte", client: "Secretaría de Seguridad", contract: "CNT-2024-001", startDate: new Date("2024-01-15"), cityId: city.id },
  });

  const center = await prisma.monitoringCenter.upsert({
    where: { id: "demo-center-001" },
    update: {},
    create: { id: "demo-center-001", name: "CMC Central", address: "Carrera 7 No. 32-16", projectId: project.id },
  });

  const route = await prisma.route.upsert({
    where: { id: "demo-route-001" },
    update: {},
    create: { id: "demo-route-001", identifier: "RUTA-001", type: "FIBER", monitoringCenterId: center.id },
  });

  const node = await prisma.node.upsert({
    where: { code: "NOD-001" },
    update: {
      name: "Nodo Plaza Bolívar",
      lat: 4.5981,
      lng: -74.0758,
      address: "Plaza de Bolívar, Bogotá",
      ip: "192.168.1.10",
      primaryIp: "192.168.1.10",
      scanSubnetCidr: "192.168.1.0/24",
      hasPole: true,
      routeId: route.id,
    },
    create: {
      code: "NOD-001",
      name: "Nodo Plaza Bolívar",
      lat: 4.5981,
      lng: -74.0758,
      address: "Plaza de Bolívar, Bogotá",
      ip: "192.168.1.10",
      primaryIp: "192.168.1.10",
      scanSubnetCidr: "192.168.1.0/24",
      routeId: route.id,
      hasPole: true,
    },
  });

  await prisma.analyticsCatalog.upsert({
    where: { code: "LPR" },
    update: { name: "LPR", scope: "BOTH" },
    create: { code: "LPR", name: "LPR", scope: "BOTH" },
  });
  await prisma.analyticsCatalog.upsert({
    where: { code: "RECONOCIMIENTO_FACIAL" },
    update: { name: "Reconocimiento facial", scope: "BOTH" },
    create: { code: "RECONOCIMIENTO_FACIAL", name: "Reconocimiento facial", scope: "BOTH" },
  });
  await prisma.analyticsCatalog.upsert({
    where: { code: "CONTEO_PERSONAS" },
    update: { name: "Conteo de personas", scope: "BOTH" },
    create: { code: "CONTEO_PERSONAS", name: "Conteo de personas", scope: "BOTH" },
  });
  await prisma.analyticsCatalog.upsert({
    where: { code: "INTRUSION" },
    update: { name: "Intrusión", scope: "BOTH" },
    create: { code: "INTRUSION", name: "Intrusión", scope: "BOTH" },
  });
  await prisma.analyticsCatalog.upsert({
    where: { code: "CRUCE_LINEA" },
    update: { name: "Cruce de línea", scope: "BOTH" },
    create: { code: "CRUCE_LINEA", name: "Cruce de línea", scope: "BOTH" },
  });
  await prisma.analyticsCatalog.upsert({
    where: { code: "LOITERING" },
    update: { name: "Loitering", scope: "BOTH" },
    create: { code: "LOITERING", name: "Loitering", scope: "BOTH" },
  });
  const otherAnalytics = await prisma.analyticsCatalog.upsert({
    where: { code: "OTHER" },
    update: { name: "Otra", scope: "BOTH", isCustom: true },
    create: { code: "OTHER", name: "Otra", scope: "BOTH", isCustom: true },
  });

  const trunkPoint = await prisma.fiberPoint.upsert({
    where: { id: "demo-fiber-point-node-001" },
    update: {
      name: node.name,
      latitude: node.lat,
      longitude: node.lng,
      nodeId: node.id,
      routeId: route.id,
      kind: "NODE",
    },
    create: {
      id: "demo-fiber-point-node-001",
      routeId: route.id,
      kind: "NODE",
      name: node.name,
      latitude: node.lat,
      longitude: node.lng,
      nodeId: node.id,
    },
  });

  const splice = await prisma.spliceClosure.upsert({
    where: { id: "demo-splice-001" },
    update: {
      routeId: route.id,
      code: "EMP-001",
      name: "Empalme Carrera 8",
      closureType: "MUFLA",
      latitude: 4.5991,
      longitude: -74.0744,
      trayCount: 2,
      fiberCapacity: 24,
    },
    create: {
      id: "demo-splice-001",
      routeId: route.id,
      code: "EMP-001",
      name: "Empalme Carrera 8",
      closureType: "MUFLA",
      latitude: 4.5991,
      longitude: -74.0744,
      trayCount: 2,
      fiberCapacity: 24,
    },
  });

  const splicePoint = await prisma.fiberPoint.upsert({
    where: { id: "demo-fiber-point-splice-001" },
    update: {
      routeId: route.id,
      kind: "SPLICE",
      name: splice.name,
      latitude: splice.latitude,
      longitude: splice.longitude,
      spliceId: splice.id,
    },
    create: {
      id: "demo-fiber-point-splice-001",
      routeId: route.id,
      kind: "SPLICE",
      name: splice.name,
      latitude: splice.latitude,
      longitude: splice.longitude,
      spliceId: splice.id,
    },
  });

  const cable = await prisma.fiberCable.upsert({
    where: { id: "demo-fiber-cable-001" },
    update: {
      routeId: route.id,
      code: "CAB-TRONCAL-001",
      kind: "TRONCAL",
      fiberCount: 24,
      originPointId: trunkPoint.id,
      destinationPointId: splicePoint.id,
    },
    create: {
      id: "demo-fiber-cable-001",
      routeId: route.id,
      code: "CAB-TRONCAL-001",
      kind: "TRONCAL",
      fiberCount: 24,
      originPointId: trunkPoint.id,
      destinationPointId: splicePoint.id,
    },
  });

  await prisma.spliceCableLeg.upsert({
    where: { id: "demo-splice-leg-in-001" },
    update: {
      spliceId: splice.id,
      fiberCableId: cable.id,
      direction: "IN",
      fiberCount: 24,
    },
    create: {
      id: "demo-splice-leg-in-001",
      spliceId: splice.id,
      fiberCableId: cable.id,
      direction: "IN",
      fiberCount: 24,
    },
  });

  await prisma.camera.upsert({
    where: { code: "CAM-001" },
    update: {},
    create: { code: "CAM-001", name: "Cámara Norte - Plaza Bolívar", ip: "192.168.1.101", brand: "Hikvision", model: "DS-2CD2143G2-I", resolution: "4MP", nodeId: node.id },
  });

  const cameraAsset = await prisma.nodeAsset.upsert({
    where: { mac: "00:11:22:33:44:55" },
    update: {
      nodeId: node.id,
      assetType: "CAMARA_PTZ",
      name: "PTZ Plaza Bolívar Norte",
      ip: "192.168.1.101",
      vendor: "Hikvision",
      model: "DS-2CD2143G2-I",
      hostname: "cam-norte",
      source: "DISCOVERY_ENRICHED",
    },
    create: {
      nodeId: node.id,
      assetType: "CAMARA_PTZ",
      name: "PTZ Plaza Bolívar Norte",
      ip: "192.168.1.101",
      mac: "00:11:22:33:44:55",
      vendor: "Hikvision",
      model: "DS-2CD2143G2-I",
      hostname: "cam-norte",
      source: "DISCOVERY_ENRICHED",
    },
  });

  await prisma.nodeAnalyticsAssignment.upsert({
    where: {
      nodeId_analyticsCatalogId_customLabel: {
        nodeId: node.id,
        analyticsCatalogId: otherAnalytics.id,
        customLabel: "Detección de aglomeraciones",
      },
    },
    update: { isEnabled: true },
    create: {
      nodeId: node.id,
      analyticsCatalogId: otherAnalytics.id,
      customLabel: "Detección de aglomeraciones",
      isEnabled: true,
    },
  });

  await prisma.nodeAssetAnalyticsAssignment.upsert({
    where: {
      nodeAssetId_analyticsCatalogId_customLabel: {
        nodeAssetId: cameraAsset.id,
        analyticsCatalogId: otherAnalytics.id,
        customLabel: "Seguimiento PTZ inteligente",
      },
    },
    update: { isEnabled: true },
    create: {
      nodeAssetId: cameraAsset.id,
      analyticsCatalogId: otherAnalytics.id,
      customLabel: "Seguimiento PTZ inteligente",
      isEnabled: true,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

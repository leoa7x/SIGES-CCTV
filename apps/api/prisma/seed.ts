import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@sigescctv.co";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!";

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
    update: {},
    create: { code: "NOD-001", name: "Nodo Plaza Bolívar", lat: 4.5981, lng: -74.0758, address: "Plaza de Bolívar, Bogotá", routeId: route.id },
  });

  await prisma.camera.upsert({
    where: { code: "CAM-001" },
    update: {},
    create: { code: "CAM-001", name: "Cámara Norte - Plaza Bolívar", ip: "192.168.1.101", brand: "Hikvision", model: "DS-2CD2143G2-I", resolution: "4MP", nodeId: node.id },
  });

  console.log("Seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

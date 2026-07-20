import assert from "node:assert/strict";
import test from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { ConflictException } from "@nestjs/common";
import { getMetadataStorage, validate } from "class-validator";

import { CreateCenterDto, MonitoringCentersService, UpdateCenterDto } from "./monitoring-centers.service";

test("findOne includes CMC discovery backlog for admin detail", async () => {
  let includeArgs: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async (args: Record<string, unknown>) => {
        includeArgs = args;
        return { id: "center-1" };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  await service.findOne("center-1");

  assert.deepEqual(includeArgs, {
    where: { id: "center-1" },
    include: {
      project: { include: { city: true } },
      routes: { include: { _count: { select: { nodes: true } } } },
      centerAssets: { orderBy: [{ assetType: "asc" }, { name: "asc" }] },
      discoveryJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          discoveredDevices: {
            orderBy: { createdAt: "desc" },
            include: { matchedAsset: { select: { id: true, name: true, assetType: true } } },
          },
        },
      },
    },
  });
});

test("update persists CMC scan target fields", async () => {
  let updatedData: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
        return { id: "center-1", ...data };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  await service.update("center-1", {
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
  } as any);

  assert.deepEqual(updatedData, {
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
  });
});

test("create retains and persists CMC scan target fields", async () => {
  let createdData: Record<string, unknown> | null = null;
  const prisma = {
    project: { findUnique: async () => null },
    monitoringCenter: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        return { id: "center-1", ...data };
      },
    },
  };

  const validationProperties = getMetadataStorage()
    .getTargetValidationMetadatas(CreateCenterDto, "", false, false)
    .map((metadata) => metadata.propertyName);
  assert.ok(validationProperties.includes("primaryIp"));
  assert.ok(validationProperties.includes("scanSubnetCidr"));

  const dto = await new ValidationPipe({ whitelist: true, transform: true }).transform({
    name: "CMC Central",
    projectId: "project-1",
    lat: 4.14,
    lng: -73.62,
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
  }, { type: "body", metatype: CreateCenterDto });

  const service = new MonitoringCentersService(prisma as any);
  await service.create(dto);

  assert.deepEqual(createdData, {
    name: "CMC Central",
    address: undefined,
    phone: undefined,
    contactName: undefined,
    lat: 4.14,
    lng: -73.62,
    primaryIp: "10.10.0.1",
    scanSubnetCidr: "10.10.0.0/24",
    project: { connect: { id: "project-1" } },
  });
});

test("CMC scan targets require IPv4 and CIDR formats on create and update", async () => {
  const createDto = Object.assign(new CreateCenterDto(), {
    name: "CMC Central",
    projectId: "project-1",
    primaryIp: "not-an-ip",
    scanSubnetCidr: "10.10.0.0/99",
  });
  const updateDto = Object.assign(new UpdateCenterDto(), {
    primaryIp: "not-an-ip",
    scanSubnetCidr: "10.10.0.0/99",
  });

  const createErrors = await validate(createDto);
  const updateErrors = await validate(updateDto);

  assert.deepEqual(createErrors.map((error) => error.property).sort(), ["primaryIp", "scanSubnetCidr"]);
  assert.deepEqual(updateErrors.map((error) => error.property).sort(), ["primaryIp", "scanSubnetCidr"]);
});

test("create accepts a CMC without discovery targets", async () => {
  const dto = Object.assign(new CreateCenterDto(), {
    name: "CMC Central",
    projectId: "project-1",
  });

  assert.deepEqual(await validate(dto), []);
});

test("update geocodes the CMC when coordinates are omitted and the project city is available", async () => {
  let updatedData: Record<string, unknown> | null = null;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        name: "CMC Villavicencio",
        address: "Cra 1 # 2-3",
        project: { city: { name: "Villavicencio" } },
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
        return { id: "center-1", ...data };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  (service as any).geocode = async () => ({ lat: 4.142, lng: -73.6266 });

  await service.update("center-1", {
    name: "CMC Villavicencio",
    address: "Cra 1 # 2-3",
    lat: undefined,
    lng: undefined,
  });

  assert.deepEqual(updatedData, {
    name: "CMC Villavicencio",
    address: "Cra 1 # 2-3",
    lat: 4.142,
    lng: -73.6266,
  });
});

test("remove rejects deleting a CMC with dependent routes, assets, discoveries, or incidents", async () => {
  let deleted = false;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        name: "CMC Central",
        _count: {
          routes: 2,
          centerAssets: 3,
          discoveryJobs: 1,
          incidents: 4,
          externalFindings: 0,
          operationalAlerts: 0,
        },
      }),
      delete: async () => {
        deleted = true;
        return { id: "center-1" };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);

  await assert.rejects(
    () => service.remove("center-1"),
    (error: unknown) => error instanceof ConflictException
      && error.message === "No se puede eliminar el CMC CMC Central porque todavía tiene dependencias asociadas. Registros pendientes: 2 rutas, 3 equipos, 1 escaneo, 4 incidentes, 0 hallazgos externos y 0 alertas operacionales.",
  );

  assert.equal(deleted, false);
});

test("remove rejects deleting a CMC with only pending external findings or operational alerts", async () => {
  let deleted = false;

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        name: "CMC Central",
        _count: {
          routes: 0,
          centerAssets: 0,
          discoveryJobs: 0,
          incidents: 0,
          externalFindings: 1,
          operationalAlerts: 2,
        },
      }),
      delete: async () => {
        deleted = true;
        return { id: "center-1" };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);

  await assert.rejects(
    () => service.remove("center-1"),
    (error: unknown) => error instanceof ConflictException,
  );

  assert.equal(deleted, false);
});

test("remove deletes a CMC when it has no dependent records", async () => {
  let deletedId = "";

  const prisma = {
    monitoringCenter: {
      findUniqueOrThrow: async () => ({
        id: "center-1",
        name: "CMC Central",
        _count: {
          routes: 0,
          centerAssets: 0,
          discoveryJobs: 0,
          incidents: 0,
          externalFindings: 0,
          operationalAlerts: 0,
        },
      }),
      delete: async ({ where }: { where: { id: string } }) => {
        deletedId = where.id;
        return { id: where.id };
      },
    },
  };

  const service = new MonitoringCentersService(prisma as any);
  const result = await service.remove("center-1");

  assert.equal(deletedId, "center-1");
  assert.deepEqual(result, { ok: true });
});

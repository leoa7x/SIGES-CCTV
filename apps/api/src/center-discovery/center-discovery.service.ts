import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { NodeAssetType, NodeDiscoveredDeviceStatus, NodeDiscoveryStatus, Prisma } from "@prisma/client";

import { CenterAssetsService } from "../center-assets/center-assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { deriveSubnetFromIp, isValidCidr, isValidIp, normalizeCenterDiscoveredDevices } from "./center-discovery.utils";

const execFileAsync = promisify(execFile);

export class ConfirmCenterDiscoveredDeviceDto {
  @IsOptional() @IsEnum(NodeAssetType) assetType?: NodeAssetType;
  @IsOptional() @IsString() name?: string;
}

@Injectable()
export class CenterDiscoveryService {
  constructor(
    private prisma: PrismaService,
    private centerAssetsService: CenterAssetsService,
  ) {}

  async runForCenter(centerId: string, requestedByUserId?: string) {
    const center = await this.prisma.monitoringCenter.findUniqueOrThrow({
      where: { id: centerId },
      select: { id: true, primaryIp: true, scanSubnetCidr: true },
    });
    const targetSubnetCidr = center.scanSubnetCidr || deriveSubnetFromIp(center.primaryIp || "");
    const job = await this.prisma.centerDiscoveryJob.create({
      data: {
        centerId,
        requestedByUserId,
        status: NodeDiscoveryStatus.RUNNING,
        targetIp: center.primaryIp,
        targetSubnetCidr,
        startedAt: new Date(),
      },
    });

    try {
      const rawDevices = await this.executeDiscovery(targetSubnetCidr, center.primaryIp || undefined);
      const normalized = normalizeCenterDiscoveredDevices(rawDevices);
      if (normalized.length > 0) {
        await this.prisma.centerDiscoveredDevice.createMany({
          data: normalized.map((device) => ({
            centerDiscoveryJobId: job.id,
            ...device,
            rawPayload: device.rawPayload as Prisma.InputJsonValue,
          })),
        });
      }
      await this.prisma.centerDiscoveryJob.update({
        where: { id: job.id },
        data: {
          status: NodeDiscoveryStatus.COMPLETED,
          rawSummary: { source: "whosthere", discoveredCount: normalized.length },
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.centerDiscoveryJob.update({
        where: { id: job.id },
        data: {
          status: NodeDiscoveryStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Discovery failed",
          finishedAt: new Date(),
        },
      });
      throw error;
    }

    return this.prisma.centerDiscoveryJob.findUniqueOrThrow({
      where: { id: job.id },
      include: {
        discoveredDevices: {
          include: { matchedAsset: { select: { id: true, name: true, assetType: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async confirmDevice(deviceId: string, dto: ConfirmCenterDiscoveredDeviceDto) {
    const device = await this.prisma.centerDiscoveredDevice.findUniqueOrThrow({
      where: { id: deviceId },
      include: { centerDiscoveryJob: { select: { centerId: true } } },
    });
    const centerId = device.centerDiscoveryJob.centerId;
    const existing = await this.prisma.centerAsset.findFirst({
      where: {
        centerId,
        OR: [
          ...(device.mac ? [{ mac: device.mac }] : []),
          ...(device.ip ? [{ ip: device.ip }] : []),
        ],
      },
      select: { id: true },
    });
    const payload = {
      assetType: dto.assetType ?? device.candidateType ?? NodeAssetType.SWITCH,
      name: dto.name?.trim() || device.name || device.hostname || "Equipo CMC",
      ip: device.ip ?? undefined,
      mac: device.mac ?? undefined,
      vendor: device.vendor ?? undefined,
      model: device.model ?? undefined,
      hostname: device.hostname ?? undefined,
    };
    const asset = existing
      ? await this.centerAssetsService.update(existing.id, payload)
      : await this.centerAssetsService.create({ centerId, ...payload });

    await this.prisma.centerDiscoveredDevice.update({
      where: { id: deviceId },
      data: {
        matchedAssetId: asset.id,
        status: existing ? NodeDiscoveredDeviceStatus.MERGED : NodeDiscoveredDeviceStatus.CONFIRMED,
      },
    });
    return asset;
  }

  async dismissDevice(deviceId: string) {
    await this.prisma.centerDiscoveredDevice.update({
      where: { id: deviceId },
      data: { status: NodeDiscoveredDeviceStatus.DISMISSED },
    });
    return { ok: true };
  }

  private async executeDiscovery(targetSubnetCidr: string, targetIp?: string) {
    if (!isValidCidr(targetSubnetCidr)) {
      throw new Error(`Subred de escaneo invalida: ${targetSubnetCidr}`);
    }
    if (targetIp && !isValidIp(targetIp)) {
      throw new Error(`IP de escaneo invalida: ${targetIp}`);
    }
    const { stdout } = await execFileAsync("python3", ["scripts/run_whosthere_scan.py", targetSubnetCidr, targetIp ?? ""], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as { success?: boolean; error?: string; devices?: unknown };
    if (parsed.success === false) {
      throw new Error(parsed.error || "WhosThere scan failed");
    }
    if (!Array.isArray(parsed.devices)) {
      throw new Error("WhosThere debe devolver JSON con arreglo de devices");
    }
    return parsed.devices as Record<string, unknown>[];
  }
}

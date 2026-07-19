import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { NodeAssetSource, NodeAssetType, NodeDiscoveredDeviceStatus, NodeDiscoveryStatus, NodeState, Prisma } from "@prisma/client";

import { CenterAssetsService } from "../center-assets/center-assets.service";
import { normalizeDiscoveryCommandTemplate } from "../common/discovery-command";
import { ExternalDiscoveryService } from "../external-discovery/external-discovery.service";
import type { NormalizedDiscoveredDevice } from "../node-discovery/node-discovery.utils";
import { PrismaService } from "../prisma/prisma.service";
import { deriveSubnetFromIp, isIpWithinCidr, isValidCidr, isValidIp, normalizeCenterDiscoveredDevices, normalizeMacAddress } from "./center-discovery.utils";

const execFileAsync = promisify(execFile);

// How long a known asset can go unseen by a scan before it's marked OFFLINE.
// Deliberately independent of the scheduler's own interval so a single missed
// scan (network blip, transient probe failure) doesn't flip an asset's state —
// it takes roughly two missed cycles at the default 5-minute interval.
const CENTER_ASSET_STALE_MS = Number(process.env.CENTER_ASSET_STALE_MS) || 10 * 60 * 1000;

// Only these two states are automation-owned. MAINTENANCE/DEGRADED reflect a
// human judgment call (a technician flagged the device, or is working on it)
// and must not be silently overwritten by a reachability probe.
const AUTO_MANAGED_STATES: NodeState[] = [NodeState.ONLINE, NodeState.OFFLINE];

export class ConfirmCenterDiscoveredDeviceDto {
  @IsOptional() @IsEnum(NodeAssetType) assetType?: NodeAssetType;
  @IsOptional() @IsString() name?: string;
}

@Injectable()
export class CenterDiscoveryService {
  constructor(
    private prisma: PrismaService,
    private centerAssetsService: CenterAssetsService,
    private externalDiscoveryService: ExternalDiscoveryService = { upsertScanFindings: async () => undefined } as unknown as ExternalDiscoveryService,
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
      const inRangeDevices = targetSubnetCidr
        ? normalized.filter((device) => !device.ip || isIpWithinCidr(device.ip, targetSubnetCidr))
        : normalized;
      const externalDevices = targetSubnetCidr
        ? normalized.filter((device) => device.ip && !isIpWithinCidr(device.ip, targetSubnetCidr))
        : [];

      await this.reconcileCenterAssets(centerId, inRangeDevices);
      if (inRangeDevices.length > 0) {
        await this.prisma.centerDiscoveredDevice.createMany({
          data: inRangeDevices.map((device) => ({
            centerDiscoveryJobId: job.id,
            ...device,
            rawPayload: device.rawPayload as Prisma.InputJsonValue,
          })),
        });
      }
      if (externalDevices.length > 0) {
        await this.externalDiscoveryService.upsertScanFindings(
          centerId,
          targetSubnetCidr || null,
          center.primaryIp || null,
          externalDevices.map((device) => ({
            ip: device.ip,
            mac: device.mac,
            vendor: device.vendor,
            model: device.model,
            hostname: device.hostname,
            candidateType: device.candidateType,
            discoveryConfidence: device.discoveryConfidence,
          })),
          "SCAN",
        );
      }
      await this.prisma.centerDiscoveryJob.update({
        where: { id: job.id },
        data: {
          status: NodeDiscoveryStatus.COMPLETED,
          rawSummary: {
            source: process.env.LAN_ORANGUTAN_CMD ? "orangutan" : "mock",
            discoveredCount: inRangeDevices.length,
            externalCount: externalDevices.length,
          },
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
    const existingByMac = device.mac
      ? await this.prisma.centerAsset.findFirst({
          where: { centerId, mac: device.mac },
          select: { id: true },
        })
      : null;
    const existing = existingByMac || (device.ip
      ? await this.prisma.centerAsset.findFirst({
          where: { centerId, ip: device.ip },
          select: { id: true },
        })
      : null);
    const payload = {
      assetType: dto.assetType ?? device.candidateType ?? NodeAssetType.SWITCH,
      name: dto.name?.trim() || device.name || device.hostname || "Equipo CMC",
      ip: device.ip ?? undefined,
      mac: device.mac ?? undefined,
      vendor: device.vendor ?? undefined,
      model: device.model ?? undefined,
      hostname: device.hostname ?? undefined,
      source: device.vendor || device.model ? NodeAssetSource.DISCOVERY_ENRICHED : NodeAssetSource.DISCOVERY,
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

  /**
   * Turns a scan into a live health signal for already-confirmed equipment:
   * assets seen in this scan get ONLINE + a fresh lastSeenAt; assets that
   * keep missing scans past CENTER_ASSET_STALE_MS get flipped to OFFLINE.
   * Without this, `operativeState` is whatever an operator last typed by
   * hand and never reflects reality again.
   */
  protected async reconcileCenterAssets(centerId: string, discovered: NormalizedDiscoveredDevice[]) {
    const assets = await this.prisma.centerAsset.findMany({
      where: {
        centerId,
        operativeState: { in: AUTO_MANAGED_STATES },
        OR: [{ ip: { not: null } }, { mac: { not: null } }],
      },
      select: { id: true, ip: true, mac: true, operativeState: true, lastSeenAt: true },
    });
    if (assets.length === 0) return;

    const seenMacs = new Set(discovered.map((device) => normalizeMacAddress(device.mac)).filter(Boolean));
    const seenIps = new Set(discovered.map((device) => device.ip).filter((ip): ip is string => Boolean(ip)));
    const now = new Date();

    const updates = assets.map((asset) => {
      const isSeen = (Boolean(asset.mac) && seenMacs.has(normalizeMacAddress(asset.mac))) || (Boolean(asset.ip) && seenIps.has(asset.ip!));

      if (isSeen) {
        return this.prisma.centerAsset.update({
          where: { id: asset.id },
          data: { lastSeenAt: now, ...(asset.operativeState !== NodeState.ONLINE ? { operativeState: NodeState.ONLINE } : {}) },
        });
      }

      const isStale = !asset.lastSeenAt || now.getTime() - asset.lastSeenAt.getTime() > CENTER_ASSET_STALE_MS;
      if (isStale && asset.operativeState !== NodeState.OFFLINE) {
        return this.prisma.centerAsset.update({ where: { id: asset.id }, data: { operativeState: NodeState.OFFLINE } });
      }
      return null;
    });

    await Promise.all(updates.filter(Boolean));
  }

  protected async executeDiscovery(targetSubnetCidr: string, targetIp?: string) {
    const commandTemplate = process.env.LAN_ORANGUTAN_CMD?.trim()
      ? normalizeDiscoveryCommandTemplate(process.env.LAN_ORANGUTAN_CMD.trim())
      : undefined;
    if (!commandTemplate) {
      if (process.env.DISCOVERY_ALLOW_MOCK === "true") {
        return this.buildMockResults(targetSubnetCidr, targetIp);
      }
      throw new Error("LAN_ORANGUTAN_CMD no está configurado para discovery real.");
    }

    if (!isValidCidr(targetSubnetCidr)) {
      throw new Error(`Subred de escaneo invalida: ${targetSubnetCidr}`);
    }
    if (targetIp && !isValidIp(targetIp)) {
      throw new Error(`IP de escaneo invalida: ${targetIp}`);
    }

    const [command, ...templateArgs] = commandTemplate.split(/\s+/).filter(Boolean);
    const args = templateArgs.map((arg) =>
      arg.replaceAll("{target}", targetSubnetCidr).replaceAll("{ip}", targetIp ?? ""),
    );

    const { stdout } = await execFileAsync(command, args, {
      env: {
        ...process.env,
        CENTER_DISCOVERY_TARGET: targetSubnetCidr,
        CENTER_DISCOVERY_IP: targetIp ?? "",
      },
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed)) {
      return parsed as Record<string, unknown>[];
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { devices?: unknown }).devices)) {
      const result = parsed as { success?: boolean; error?: string; devices: Record<string, unknown>[] };
      if (result.success === false) {
        throw new Error(result.error || "LAN-Orangutan scan failed");
      }
      return result.devices;
    }
    throw new Error("LAN-Orangutan debe devolver JSON con arreglo de devices");
  }

  protected buildMockResults(targetSubnetCidr: string, targetIp?: string) {
    const prefix = targetSubnetCidr.split("/")[0].split(".").slice(0, 3).join(".");
    return [
      {
        ip: `${prefix}.10`,
        mac: "AA:00:00:00:10:10",
        vendor: "Cisco",
        hostname: "core-cmc",
        model: "CBS250-24P-4G",
        type: "switch",
        confidence: 82,
        target: targetSubnetCidr,
        primaryIp: targetIp ?? "",
      },
    ] satisfies Record<string, unknown>[];
  }
}

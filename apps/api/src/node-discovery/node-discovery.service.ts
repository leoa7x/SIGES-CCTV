import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { Prisma, NodeDiscoveredDeviceStatus, NodeDiscoveryStatus, NodeAssetType } from "@prisma/client";
import { normalizeDiscoveryCommandTemplate } from "../common/discovery-command";
import { PrismaService } from "../prisma/prisma.service";
import { NodeAssetsService } from "../node-assets/node-assets.service";
import { deriveSubnetFromIp, isValidCidr, isValidIp, normalizeDiscoveredDevices } from "./node-discovery.utils";

const execFileAsync = promisify(execFile);

export class ConfirmDiscoveredDeviceDto {
  @IsOptional() @IsEnum(NodeAssetType) assetType?: NodeAssetType;
  @IsOptional() @IsString() name?: string;
}

@Injectable()
export class NodeDiscoveryService {
  constructor(
    private prisma: PrismaService,
    private nodeAssetsService: NodeAssetsService,
  ) {}

  async runForNode(nodeId: string, requestedByUserId?: string) {
    const node = await this.prisma.node.findUniqueOrThrow({
      where: { id: nodeId },
      select: {
        id: true,
        primaryIp: true,
        scanSubnetCidr: true,
      },
    });

    const targetSubnetCidr = node.scanSubnetCidr || deriveSubnetFromIp(node.primaryIp || "");
    const job = await this.prisma.nodeDiscoveryJob.create({
      data: {
        nodeId,
        requestedByUserId,
        status: NodeDiscoveryStatus.RUNNING,
        targetIp: node.primaryIp,
        targetSubnetCidr,
        startedAt: new Date(),
      },
    });

    try {
      const rawDevices = await this.executeDiscovery(targetSubnetCidr, node.primaryIp || undefined);
      const normalized = normalizeDiscoveredDevices(rawDevices);

      if (normalized.length > 0) {
        await this.prisma.nodeDiscoveredDevice.createMany({
          data: normalized.map((device) => ({
            nodeDiscoveryJobId: job.id,
            candidateType: device.candidateType,
            name: device.name,
            ip: device.ip,
            mac: device.mac,
            vendor: device.vendor,
            model: device.model,
            hostname: device.hostname,
            discoveryConfidence: device.discoveryConfidence,
            rawPayload: device.rawPayload as Prisma.InputJsonValue,
          })),
        });
      }

      await this.prisma.nodeDiscoveryJob.update({
        where: { id: job.id },
        data: {
          status: NodeDiscoveryStatus.COMPLETED,
          rawSummary: {
            source: process.env.LAN_ORANGUTAN_CMD ? "orangutan" : "mock",
            discoveredCount: normalized.length,
          },
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.nodeDiscoveryJob.update({
        where: { id: job.id },
        data: {
          status: NodeDiscoveryStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : "Discovery failed",
          finishedAt: new Date(),
        },
      });
      throw error;
    }

    return this.prisma.nodeDiscoveryJob.findUniqueOrThrow({
      where: { id: job.id },
      include: {
        discoveredDevices: {
          include: { matchedAsset: { select: { id: true, name: true, assetType: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async confirmDevice(deviceId: string, dto: ConfirmDiscoveredDeviceDto) {
    const device = await this.prisma.nodeDiscoveredDevice.findUniqueOrThrow({
      where: { id: deviceId },
      include: {
        nodeDiscoveryJob: {
          select: {
            nodeId: true,
          },
        },
      },
    });

    const nodeId = device.nodeDiscoveryJob.nodeId;
    const assetType = dto.assetType ?? device.candidateType ?? NodeAssetType.SWITCH;
    const name = dto.name?.trim() || device.name || device.hostname || assetType;

    const existing = await this.prisma.nodeAsset.findFirst({
      where: {
        nodeId,
        OR: [
          ...(device.mac ? [{ mac: device.mac }] : []),
          ...(device.ip ? [{ ip: device.ip }] : []),
        ],
      },
      select: { id: true },
    });

    const asset = existing
      ? await this.nodeAssetsService.update(existing.id, {
          assetType,
          name,
          ip: device.ip ?? undefined,
          mac: device.mac ?? undefined,
          vendor: device.vendor ?? undefined,
          model: device.model ?? undefined,
          hostname: device.hostname ?? undefined,
        })
      : await this.nodeAssetsService.create({
          nodeId,
          assetType,
          name,
          ip: device.ip ?? undefined,
          mac: device.mac ?? undefined,
          vendor: device.vendor ?? undefined,
          model: device.model ?? undefined,
          hostname: device.hostname ?? undefined,
          source: device.vendor || device.model ? "DISCOVERY_ENRICHED" : "DISCOVERY",
        });

    await this.prisma.nodeDiscoveredDevice.update({
      where: { id: deviceId },
      data: {
        matchedAssetId: asset.id,
        status: existing ? NodeDiscoveredDeviceStatus.MERGED : NodeDiscoveredDeviceStatus.CONFIRMED,
      },
    });

    return asset;
  }

  async dismissDevice(deviceId: string) {
    await this.prisma.nodeDiscoveredDevice.update({
      where: { id: deviceId },
      data: { status: NodeDiscoveredDeviceStatus.DISMISSED },
    });
    return { ok: true };
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
      throw new Error(`Subred de escaneo inválida: ${targetSubnetCidr}`);
    }
    if (targetIp && !isValidIp(targetIp)) {
      throw new Error(`IP de escaneo inválida: ${targetIp}`);
    }

    // Split the operator-configured template into argv tokens and substitute placeholders
    // per-argument, then run via execFile (no shell) so scan input can never break out
    // into shell metacharacters, regardless of the CIDR/IP validation above.
    const [command, ...templateArgs] = commandTemplate.split(/\s+/).filter(Boolean);
    const args = templateArgs.map((arg) =>
      arg.replaceAll("{target}", targetSubnetCidr).replaceAll("{ip}", targetIp ?? ""),
    );

    const { stdout } = await execFileAsync(command, args, {
      env: {
        ...process.env,
        NODE_DISCOVERY_TARGET: targetSubnetCidr,
        NODE_DISCOVERY_IP: targetIp ?? "",
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
        ip: `${prefix}.101`,
        mac: "AA:BB:CC:11:22:33",
        vendor: "Hikvision",
        hostname: "cam-descubierta-1",
        model: "DS-2DE2A404IW-DE3",
        type: "camera_ptz",
        confidence: 91,
        target: targetIp ?? targetSubnetCidr,
      },
      {
        ip: `${prefix}.2`,
        mac: "00:24:01:AA:BB:CC",
        vendor: "MikroTik",
        hostname: "switch-descubierto-1",
        model: "CSS610-8G-2S+IN",
        type: "switch",
        confidence: 77,
        target: targetIp ?? targetSubnetCidr,
      },
    ] satisfies Record<string, unknown>[];
  }
}

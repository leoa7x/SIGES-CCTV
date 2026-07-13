import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { NodeAssetSource, NodeAssetType, NodeState } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const CAMERA_ASSET_TYPES = new Set<NodeAssetType>([
  NodeAssetType.CAMARA_PTZ,
  NodeAssetType.CAMARA_FIJA,
]);

export class CreateNodeAssetDto {
  @IsString() @IsNotEmpty() nodeId!: string;
  @IsEnum(NodeAssetType) assetType!: NodeAssetType;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsEnum(NodeAssetSource) source?: NodeAssetSource;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateNodeAssetDto {
  @IsOptional() @IsEnum(NodeAssetType) assetType?: NodeAssetType;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class NodeAssetsService {
  constructor(private prisma: PrismaService) {}

  findAll(nodeId?: string) {
    return this.prisma.nodeAsset.findMany({
      where: nodeId ? { nodeId } : undefined,
      include: {
        node: { select: { id: true, code: true, name: true } },
        analyticsAssignments: { include: { analyticsCatalog: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
    });
  }

  async create(dto: CreateNodeAssetDto) {
    const { nodeId, ...rest } = dto;
    const asset = await this.prisma.nodeAsset.create({
      data: {
        ...rest,
        node: { connect: { id: nodeId } },
        lastSeenAt: new Date(),
      },
      include: {
        node: true,
        analyticsAssignments: { include: { analyticsCatalog: true } },
      },
    });

    await this.syncCameraAsset(asset);
    return this.prisma.nodeAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: {
        node: { select: { id: true, code: true, name: true } },
        analyticsAssignments: { include: { analyticsCatalog: true }, orderBy: { createdAt: "asc" } },
      },
    });
  }

  async update(id: string, dto: UpdateNodeAssetDto) {
    const asset = await this.prisma.nodeAsset.update({
      where: { id },
      data: {
        ...dto,
        lastSeenAt: new Date(),
      } as Parameters<typeof this.prisma.nodeAsset.update>[0]["data"],
      include: {
        node: true,
        analyticsAssignments: { include: { analyticsCatalog: true } },
      },
    });

    await this.syncCameraAsset(asset);
    return this.prisma.nodeAsset.findUniqueOrThrow({
      where: { id: asset.id },
      include: {
        node: { select: { id: true, code: true, name: true } },
        analyticsAssignments: { include: { analyticsCatalog: true }, orderBy: { createdAt: "asc" } },
      },
    });
  }

  async remove(id: string) {
    const asset = await this.prisma.nodeAsset.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        nodeId: true,
        name: true,
        ip: true,
        model: true,
        assetType: true,
      },
    });

    await this.deleteCameraLinksForAsset(asset);

    await this.prisma.$transaction([
      this.prisma.nodeAssetAnalyticsAssignment.deleteMany({ where: { nodeAssetId: id } }),
      this.prisma.nodeDiscoveredDevice.deleteMany({ where: { matchedAssetId: id } }),
      this.prisma.nodeAsset.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  private async syncCameraAsset(asset: {
    id: string;
    nodeId: string;
    assetType: NodeAssetType;
    name: string;
    ip: string | null;
    vendor: string | null;
    model: string | null;
  }) {
    if (!CAMERA_ASSET_TYPES.has(asset.assetType)) {
      return;
    }

    const existing = asset.ip
      ? await this.prisma.camera.findFirst({ where: { ip: asset.ip } })
      : null;

    if (existing) {
      await this.prisma.camera.update({
        where: { id: existing.id },
        data: {
          name: asset.name,
          brand: asset.vendor ?? existing.brand,
          model: asset.model ?? existing.model,
          nodeId: asset.nodeId,
          hasAnalytics: true,
        },
      });
      return;
    }

    const code = `AUTO-${asset.assetType === NodeAssetType.CAMARA_PTZ ? "PTZ" : "FIX"}-${asset.id.slice(0, 8).toUpperCase()}`;
    await this.prisma.camera.create({
      data: {
        code,
        name: asset.name,
        ip: asset.ip,
        brand: asset.vendor,
        model: asset.model,
        nodeId: asset.nodeId,
        hasAnalytics: true,
      },
    });
  }

  private async deleteCameraLinksForAsset(asset: {
    nodeId: string;
    name: string;
    ip: string | null;
    model: string | null;
    assetType: NodeAssetType;
  }) {
    if (!CAMERA_ASSET_TYPES.has(asset.assetType)) {
      return;
    }

    const cameras = await this.prisma.camera.findMany({
      where: {
        nodeId: asset.nodeId,
        OR: [
          ...(asset.ip ? [{ ip: asset.ip }] : []),
          { name: asset.name, ...(asset.model ? { model: asset.model } : {}) },
        ],
      },
      select: { id: true },
    });

    if (cameras.length === 0) {
      return;
    }

    const cameraIds = cameras.map((camera) => camera.id);
    await this.prisma.$transaction([
      this.prisma.incident.deleteMany({ where: { cameraId: { in: cameraIds } } }),
      this.prisma.camera.deleteMany({ where: { id: { in: cameraIds } } }),
    ]);
  }
}

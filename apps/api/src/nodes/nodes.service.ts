import { Injectable } from "@nestjs/common";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { NodeAssetType, NodeState, NodeType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateNodeDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsString() address?: string;
  @IsString() @IsNotEmpty() primaryIp!: string;
  @IsOptional() @IsString() scanSubnetCidr?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsEnum(NodeType) nodeType?: NodeType;
  @IsOptional() @IsString() snmpCommunity?: string;
  @IsString() @IsNotEmpty() routeId!: string;
  @IsOptional() @IsBoolean() hasPole?: boolean;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() primaryIp?: string;
  @IsOptional() @IsString() scanSubnetCidr?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsEnum(NodeType) nodeType?: NodeType;
  @IsOptional() @IsString() snmpCommunity?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsBoolean() hasPole?: boolean;
}

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.node.findMany({
      where: routeId ? { routeId } : undefined,
      include: {
        route: { include: { center: { include: { project: { include: { city: true } } } } } },
        _count: { select: { cameras: true, assets: true, discoveryJobs: true, analyticsAssignments: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.node.findUniqueOrThrow({
      where: { id },
      include: {
        route: { include: { center: { include: { project: { include: { city: true } } } } } },
        cameras: true,
        incidents: { where: { status: { not: "CLOSED" } }, orderBy: { createdAt: "desc" }, take: 10 },
        assets: {
          include: {
            analyticsAssignments: {
              include: { analyticsCatalog: true },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: [{ assetType: "asc" }, { name: "asc" }],
        },
        discoveryJobs: {
          include: {
            discoveredDevices: {
              include: { matchedAsset: { select: { id: true, name: true, assetType: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        analyticsAssignments: {
          include: { analyticsCatalog: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  create(dto: CreateNodeDto) {
    const { routeId, primaryIp, ...rest } = dto;
    return this.prisma.node.create({
      data: {
        ...rest,
        ip: primaryIp,
        primaryIp,
        route: { connect: { id: routeId } },
      },
    });
  }

  update(id: string, dto: UpdateNodeDto) {
    const data = {
      ...dto,
      ...(dto.primaryIp ? { ip: dto.primaryIp, primaryIp: dto.primaryIp } : {}),
    } as Parameters<typeof this.prisma.node.update>[0]["data"];
    return this.prisma.node.update({ where: { id }, data });
  }

  findGeoJson() {
    return this.prisma.node.findMany({
      where: { NOT: { lat: 0, lng: 0 } },
      select: { id: true, code: true, name: true, lat: true, lng: true, operativeState: true },
    });
  }

  async remove(id: string) {
    const node = await this.prisma.node.findUniqueOrThrow({
      where: { id },
      include: {
        cameras: { select: { id: true } },
        assets: { select: { id: true } },
        discoveryJobs: { select: { id: true } },
        fiberPoints: { select: { id: true } },
      },
    });

    const cameraIds = node.cameras.map((camera) => camera.id);
    const assetIds = node.assets.map((asset) => asset.id);
    const discoveryJobIds = node.discoveryJobs.map((job) => job.id);
    const pointIds = node.fiberPoints.map((point) => point.id);

    await this.deleteFiberTopologyForNodePoints(pointIds);

    await this.prisma.$transaction([
      this.prisma.incident.deleteMany({
        where: {
          OR: [
            { nodeId: id },
            ...(cameraIds.length ? [{ cameraId: { in: cameraIds } }] : []),
          ],
        },
      }),
      this.prisma.logbookEntry.deleteMany({ where: { nodeId: id } }),
      this.prisma.nodeAnalyticsAssignment.deleteMany({ where: { nodeId: id } }),
      ...(assetIds.length
        ? [
            this.prisma.nodeAssetAnalyticsAssignment.deleteMany({ where: { nodeAssetId: { in: assetIds } } }),
            this.prisma.nodeDiscoveredDevice.deleteMany({ where: { matchedAssetId: { in: assetIds } } }),
          ]
        : []),
      ...(discoveryJobIds.length
        ? [this.prisma.nodeDiscoveredDevice.deleteMany({ where: { nodeDiscoveryJobId: { in: discoveryJobIds } } })]
        : []),
      this.prisma.nodeDiscoveryJob.deleteMany({ where: { nodeId: id } }),
      this.prisma.camera.deleteMany({ where: { nodeId: id } }),
      this.prisma.nodeAsset.deleteMany({ where: { nodeId: id } }),
      this.prisma.fiberSegment.deleteMany({ where: { OR: [{ nodeAId: id }, { nodeBId: id }] } }),
      this.prisma.fiberPoint.deleteMany({ where: { nodeId: id } }),
      this.prisma.node.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  private async deleteFiberTopologyForNodePoints(pointIds: string[]) {
    if (pointIds.length === 0) {
      return;
    }

    const cables = await this.prisma.fiberCable.findMany({
      where: {
        OR: [
          { originPointId: { in: pointIds } },
          { destinationPointId: { in: pointIds } },
        ],
      },
      select: { id: true },
    });

    const cableIds = cables.map((cable) => cable.id);
    if (cableIds.length === 0) {
      return;
    }

    const spliceLegs = await this.prisma.spliceCableLeg.findMany({
      where: { fiberCableId: { in: cableIds } },
      select: { id: true, spliceId: true },
    });

    const legIds = spliceLegs.map((leg) => leg.id);
    const spliceIds = [...new Set(spliceLegs.map((leg) => leg.spliceId))];

    await this.prisma.$transaction([
      ...(spliceIds.length
        ? [
            this.prisma.spliceBlockInput.deleteMany({
              where: {
                OR: [
                  { spliceId: { in: spliceIds } },
                  ...(legIds.length ? [{ fromLegId: { in: legIds } }, { toLegId: { in: legIds } }] : []),
                ],
              },
            }),
            this.prisma.spliceFiberConnection.deleteMany({
              where: {
                OR: [
                  { spliceId: { in: spliceIds } },
                  ...(legIds.length ? [{ fromLegId: { in: legIds } }, { toLegId: { in: legIds } }] : []),
                ],
              },
            }),
          ]
        : []),
      ...(legIds.length ? [this.prisma.spliceCableLeg.deleteMany({ where: { id: { in: legIds } } })] : []),
      this.prisma.fiberCable.updateMany({
        where: { parentCableId: { in: cableIds } },
        data: { parentCableId: null },
      }),
      this.prisma.fiberCable.deleteMany({ where: { id: { in: cableIds } } }),
    ]);
  }
}

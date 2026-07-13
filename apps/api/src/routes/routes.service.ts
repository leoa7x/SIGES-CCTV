import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { RouteType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateRouteDto {
  @IsString() @IsNotEmpty() identifier!: string;
  @IsEnum(RouteType) type!: RouteType;
  @IsString() @IsNotEmpty() monitoringCenterId!: string;
}

export class UpdateRouteDto {
  @IsOptional() @IsString() identifier?: string;
  @IsOptional() @IsEnum(RouteType) type?: RouteType;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class RoutesService {
  constructor(private prisma: PrismaService) {}

  findAll(centerId?: string) {
    return this.prisma.route.findMany({
      where: centerId ? { monitoringCenterId: centerId } : undefined,
      include: { center: true, _count: { select: { nodes: true, fiberCables: true, spliceClosures: true } } },
      orderBy: { identifier: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.route.findUniqueOrThrow({
      where: { id },
      include: {
        center: true,
        nodes: { include: { _count: { select: { cameras: true } } } },
        fiberPoints: {
          include: {
            node: { select: { id: true, code: true, name: true, lat: true, lng: true } },
            splice: { select: { id: true, code: true, name: true, closureType: true, documentStatus: true } },
          },
          orderBy: { name: "asc" },
        },
        fiberCables: {
          include: {
            originPoint: true,
            destinationPoint: true,
            parentCable: { select: { id: true, code: true, kind: true } },
            childCables: { select: { id: true, code: true, kind: true, documentStatus: true } },
            sourceSplice: { select: { id: true, code: true, name: true } },
            spliceLegs: { select: { id: true, direction: true, fiberCount: true, reservedFiberCount: true } },
          },
          orderBy: [{ kind: "asc" }, { code: "asc" }],
        },
        spliceClosures: {
          include: {
            point: true,
            cableLegs: {
              include: {
                fiberCable: { select: { id: true, code: true, kind: true, fiberCount: true } },
              },
            },
            blockInputs: true,
            connections: true,
          },
          orderBy: { code: "asc" },
        },
      },
    });
  }

  create(dto: CreateRouteDto) {
    const { monitoringCenterId, ...rest } = dto;
    return this.prisma.route.create({ data: { ...rest, center: { connect: { id: monitoringCenterId } } } });
  }

  update(id: string, dto: UpdateRouteDto) {
    return this.prisma.route.update({ where: { id }, data: dto as Parameters<typeof this.prisma.route.update>[0]["data"] });
  }
}

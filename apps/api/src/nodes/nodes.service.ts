import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { NodeState } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateNodeDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() lat!: number;
  @IsNumber() lng!: number;
  @IsOptional() @IsString() address?: string;
  @IsString() @IsNotEmpty() routeId!: string;
}

export class UpdateNodeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
}

@Injectable()
export class NodesService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.node.findMany({
      where: routeId ? { routeId } : undefined,
      include: {
        route: { include: { center: { include: { project: { include: { city: true } } } } } },
        _count: { select: { cameras: true } },
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
      },
    });
  }

  create(dto: CreateNodeDto) {
    const { routeId, ...rest } = dto;
    return this.prisma.node.create({ data: { ...rest, route: { connect: { id: routeId } } } });
  }

  update(id: string, dto: UpdateNodeDto) {
    return this.prisma.node.update({ where: { id }, data: dto as Parameters<typeof this.prisma.node.update>[0]["data"] });
  }

  findGeoJson() {
    return this.prisma.node.findMany({
      select: { id: true, code: true, name: true, lat: true, lng: true, operativeState: true },
    });
  }
}

import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf } from "class-validator";
import { FiberPointKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateFiberPointDto {
  @IsString() @IsNotEmpty() routeId!: string;
  @IsEnum(FiberPointKind) kind!: FiberPointKind;
  @IsString() @IsNotEmpty() name!: string;
  @IsNumber() latitude!: number;
  @IsNumber() longitude!: number;
  @ValidateIf((dto: CreateFiberPointDto) => dto.kind === FiberPointKind.NODE)
  @IsString() @IsNotEmpty() nodeId?: string;
  @ValidateIf((dto: CreateFiberPointDto) => dto.kind === FiberPointKind.SPLICE)
  @IsString() @IsNotEmpty() spliceId?: string;
}

export class UpdateFiberPointDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

@Injectable()
export class FiberPointsService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.fiberPoint.findMany({
      where: routeId ? { routeId } : undefined,
      include: {
        node: { select: { id: true, code: true, name: true, lat: true, lng: true } },
        splice: { select: { id: true, code: true, name: true, closureType: true, documentStatus: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  create(dto: CreateFiberPointDto) {
    const { routeId, nodeId, spliceId, ...rest } = dto;
    return this.prisma.fiberPoint.create({
      data: {
        ...rest,
        route: { connect: { id: routeId } },
        node: nodeId ? { connect: { id: nodeId } } : undefined,
        splice: spliceId ? { connect: { id: spliceId } } : undefined,
      },
      include: {
        node: { select: { id: true, code: true, name: true, lat: true, lng: true } },
        splice: { select: { id: true, code: true, name: true, closureType: true, documentStatus: true } },
      },
    });
  }

  update(id: string, dto: UpdateFiberPointDto) {
    return this.prisma.fiberPoint.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.fiberPoint.update>[0]["data"],
    });
  }
}

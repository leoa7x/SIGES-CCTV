import { Injectable } from "@nestjs/common";
import { FiberCableKind } from "@prisma/client";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateFiberCableDto {
  @IsString() @IsNotEmpty() routeId!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsEnum(FiberCableKind) kind!: FiberCableKind;
  @IsInt() @Min(1) fiberCount!: number;
  @IsString() @IsNotEmpty() originPointId!: string;
  @IsString() @IsNotEmpty() destinationPointId!: string;
  @IsOptional() @IsString() parentCableId?: string;
  @IsOptional() @IsString() sourceSpliceId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateFiberCableDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsInt() @Min(1) fiberCount?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() documentStatus?: string;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class FiberCablesService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.fiberCable.findMany({
      where: routeId ? { routeId } : undefined,
      include: {
        originPoint: true,
        destinationPoint: true,
        parentCable: { select: { id: true, code: true, kind: true } },
        sourceSplice: { select: { id: true, code: true, name: true } },
        childCables: { select: { id: true, code: true, kind: true, documentStatus: true } },
      },
      orderBy: [{ kind: "asc" }, { code: "asc" }],
    });
  }

  create(dto: CreateFiberCableDto) {
    const { routeId, originPointId, destinationPointId, parentCableId, sourceSpliceId, ...rest } = dto;
    return this.prisma.fiberCable.create({
      data: {
        ...rest,
        route: { connect: { id: routeId } },
        originPoint: { connect: { id: originPointId } },
        destinationPoint: { connect: { id: destinationPointId } },
        parentCable: parentCableId ? { connect: { id: parentCableId } } : undefined,
        sourceSplice: sourceSpliceId ? { connect: { id: sourceSpliceId } } : undefined,
      },
      include: {
        originPoint: true,
        destinationPoint: true,
        parentCable: { select: { id: true, code: true, kind: true } },
        sourceSplice: { select: { id: true, code: true, name: true } },
      },
    });
  }

  update(id: string, dto: UpdateFiberCableDto) {
    return this.prisma.fiberCable.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.fiberCable.update>[0]["data"],
    });
  }
}

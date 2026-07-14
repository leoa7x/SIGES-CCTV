import { ConflictException, Injectable } from "@nestjs/common";
import { FiberConnectionBlockKind, SpliceLegDirection } from "@prisma/client";
import { IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { expandBlockInput } from "./expand-blocks";

export class CreateSpliceDto {
  @IsString() @IsNotEmpty() routeId!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() closureType!: string;
  @IsNumber() latitude!: number;
  @IsNumber() longitude!: number;
  @IsInt() @Min(1) trayCount!: number;
  @IsInt() @Min(1) fiberCapacity!: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateSpliceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() closureType?: string;
  @IsOptional() @IsInt() @Min(1) trayCount?: number;
  @IsOptional() @IsInt() @Min(1) fiberCapacity?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() documentStatus?: string;
}

export class CreateSpliceCableLegDto {
  @IsString() @IsNotEmpty() fiberCableId!: string;
  @IsEnum(SpliceLegDirection) direction!: SpliceLegDirection;
  @IsOptional() @IsString() bufferLabel?: string;
  @IsInt() @Min(1) fiberCount!: number;
  @IsOptional() @IsInt() @Min(0) reservedFiberCount?: number;
  @IsOptional() @IsString() notes?: string;
}

export class CreateSpliceBlockInputDto {
  @IsString() @IsNotEmpty() fromLegId!: string;
  @IsInt() @Min(1) fromFiberStart!: number;
  @IsInt() @Min(1) fromFiberEnd!: number;
  @IsString() @IsNotEmpty() toLegId!: string;
  @IsInt() @Min(1) toFiberStart!: number;
  @IsInt() @Min(1) toFiberEnd!: number;
  @IsEnum(FiberConnectionBlockKind) blockKind!: FiberConnectionBlockKind;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class SplicesService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.spliceClosure.findMany({
      where: routeId ? { routeId } : undefined,
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
    });
  }

  create(dto: CreateSpliceDto) {
    const { routeId, ...rest } = dto;
    return this.prisma.spliceClosure.create({
      data: {
        ...rest,
        route: { connect: { id: routeId } },
      },
    });
  }

  update(id: string, dto: UpdateSpliceDto) {
    return this.prisma.spliceClosure.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.spliceClosure.update>[0]["data"],
    });
  }

  async remove(id: string) {
    const splice = await this.prisma.spliceClosure.findUniqueOrThrow({
      where: { id },
      include: {
        point: { select: { id: true } },
        _count: { select: { sourceCables: true, cableLegs: true, blockInputs: true, connections: true } },
      },
    });

    if (splice._count.sourceCables > 0 || splice._count.cableLegs > 0 || splice._count.blockInputs > 0 || splice._count.connections > 0) {
      throw new ConflictException(`No se puede eliminar el empalme ${splice.code} porque todavía tiene cables o fusiones asociadas.`);
    }

    await this.prisma.$transaction([
      ...(splice.point ? [this.prisma.fiberPoint.delete({ where: { id: splice.point.id } })] : []),
      this.prisma.spliceClosure.delete({ where: { id } }),
    ]);

    return { ok: true };
  }

  addLeg(spliceId: string, dto: CreateSpliceCableLegDto) {
    const { fiberCableId, ...rest } = dto;
    return this.prisma.spliceCableLeg.create({
      data: {
        ...rest,
        splice: { connect: { id: spliceId } },
        fiberCable: { connect: { id: fiberCableId } },
      },
      include: {
        fiberCable: { select: { id: true, code: true, kind: true, fiberCount: true } },
      },
    });
  }

  addBlockInput(spliceId: string, dto: CreateSpliceBlockInputDto) {
    const { fromLegId, toLegId, ...rest } = dto;
    return this.prisma.spliceBlockInput.create({
      data: {
        ...rest,
        splice: { connect: { id: spliceId } },
        fromLeg: { connect: { id: fromLegId } },
        toLeg: { connect: { id: toLegId } },
      },
    });
  }

  async expandBlocks(spliceId: string) {
    const blocks = await this.prisma.spliceBlockInput.findMany({
      where: { spliceId },
      orderBy: { createdAt: "asc" },
    });

    const expanded = blocks.flatMap((block) =>
      expandBlockInput({
        fromLegId: block.fromLegId,
        fromFiberStart: block.fromFiberStart,
        fromFiberEnd: block.fromFiberEnd,
        toLegId: block.toLegId,
        toFiberStart: block.toFiberStart,
        toFiberEnd: block.toFiberEnd,
        blockKind: block.blockKind,
      }),
    );

    await this.prisma.$transaction([
      this.prisma.spliceFiberConnection.deleteMany({ where: { spliceId } }),
      this.prisma.spliceFiberConnection.createMany({
        data: expanded.map((item) => ({
          spliceId,
          fromLegId: item.fromLegId,
          fromFiberNumber: item.fromFiberNumber,
          toLegId: item.toLegId,
          toFiberNumber: item.toFiberNumber,
          connectionKind: item.connectionKind,
        })),
      }),
      this.prisma.spliceClosure.update({
        where: { id: spliceId },
        data: { documentStatus: expanded.length > 0 ? "PARTIAL" : "DRAFT" },
      }),
    ]);

    return this.prisma.spliceClosure.findUniqueOrThrow({
      where: { id: spliceId },
      include: {
        cableLegs: { include: { fiberCable: { select: { id: true, code: true, kind: true } } } },
        blockInputs: true,
        connections: { orderBy: [{ fromLegId: "asc" }, { fromFiberNumber: "asc" }] },
      },
    });
  }
}

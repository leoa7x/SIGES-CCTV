import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { FiberState } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateFiberSegmentDto {
  @IsString() @IsNotEmpty() nodeAId!: string;
  @IsString() @IsNotEmpty() nodeBId!: string;
  @IsOptional() waypoints?: number[][];
  @IsOptional() @IsNumber() lengthM?: number;
}

export class UpdateFiberSegmentDto {
  @IsOptional() waypoints?: number[][];
  @IsOptional() @IsEnum(FiberState) state?: FiberState;
  @IsOptional() @IsNumber() lengthM?: number;
}

@Injectable()
export class FiberSegmentsService {
  constructor(private prisma: PrismaService) {}

  findAll(routeId?: string) {
    return this.prisma.fiberSegment.findMany({
      include: {
        nodeA: { select: { id: true, code: true, name: true, lat: true, lng: true } },
        nodeB: { select: { id: true, code: true, name: true, lat: true, lng: true } },
      },
    });
  }

  async findAllGeoJson() {
    const segments = await this.prisma.fiberSegment.findMany({
      include: {
        nodeA: { select: { id: true, code: true, lat: true, lng: true, operativeState: true } },
        nodeB: { select: { id: true, code: true, lat: true, lng: true, operativeState: true } },
      },
    });
    return {
      segments: segments.map((s) => ({
        id: s.id,
        state: s.state,
        nodeA: {
          id: s.nodeA.id,
          code: s.nodeA.code,
          lat: s.nodeA.lat,
          lng: s.nodeA.lng,
          operativeState: s.nodeA.operativeState,
        },
        nodeB: {
          id: s.nodeB.id,
          code: s.nodeB.code,
          lat: s.nodeB.lat,
          lng: s.nodeB.lng,
          operativeState: s.nodeB.operativeState,
        },
        waypoints: s.waypoints as number[][],
      })),
    };
  }

  findOne(id: string) {
    return this.prisma.fiberSegment.findUniqueOrThrow({
      where: { id },
      include: {
        nodeA: true,
        nodeB: true,
      },
    });
  }

  create(dto: CreateFiberSegmentDto) {
    const { nodeAId, nodeBId, waypoints, lengthM } = dto;
    return this.prisma.fiberSegment.create({
      data: {
        nodeA: { connect: { id: nodeAId } },
        nodeB: { connect: { id: nodeBId } },
        waypoints: waypoints ?? [],
        lengthM,
      },
      include: {
        nodeA: { select: { id: true, code: true, name: true } },
        nodeB: { select: { id: true, code: true, name: true } },
      },
    });
  }

  update(id: string, dto: UpdateFiberSegmentDto) {
    return this.prisma.fiberSegment.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.fiberSegment.update>[0]["data"],
    });
  }

  remove(id: string) {
    return this.prisma.fiberSegment.delete({ where: { id } });
  }
}

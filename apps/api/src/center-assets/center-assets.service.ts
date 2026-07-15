import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { NodeAssetSource, NodeAssetType, NodeState } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

export class CreateCenterAssetDto {
  @IsString() @IsNotEmpty() centerId!: string;
  @IsEnum(NodeAssetType) assetType!: NodeAssetType;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCenterAssetDto {
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
export class CenterAssetsService {
  constructor(private prisma: PrismaService) {}

  findAll(centerId?: string) {
    return this.prisma.centerAsset.findMany({
      where: centerId ? { centerId } : undefined,
      include: {
        center: { select: { id: true, name: true } },
      },
      orderBy: [{ assetType: "asc" }, { name: "asc" }],
    });
  }

  create(dto: CreateCenterAssetDto) {
    const { centerId, ...rest } = dto;
    return this.prisma.centerAsset.create({
      data: {
        ...rest,
        source: NodeAssetSource.MANUAL,
        center: { connect: { id: centerId } },
        lastSeenAt: new Date(),
      },
      include: {
        center: { select: { id: true, name: true } },
      },
    });
  }

  update(id: string, dto: UpdateCenterAssetDto) {
    return this.prisma.centerAsset.update({
      where: { id },
      data: {
        ...dto,
        lastSeenAt: new Date(),
      },
      include: {
        center: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    await this.prisma.centerAsset.delete({ where: { id } });
    return { ok: true as const };
  }
}

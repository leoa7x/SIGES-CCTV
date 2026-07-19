import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";
import { NodeAssetSource, NodeAssetType, NodeState } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

// Reused by the heartbeat scheduler as the reachability target — must reject
// anything that isn't a plain IPv4 before it ever reaches `execFile("ping", ...)`.
const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${IPV4_OCTET}(\\.${IPV4_OCTET}){3}$`);

export class CreateCenterAssetDto {
  @IsString() @IsNotEmpty() centerId!: string;
  @IsEnum(NodeAssetType) assetType!: NodeAssetType;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() @Matches(IPV4_PATTERN, { message: "ip debe ser una IPv4 válida" }) ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsEnum(NodeAssetSource) source?: NodeAssetSource;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCenterAssetDto {
  @IsOptional() @IsEnum(NodeAssetType) assetType?: NodeAssetType;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() @Matches(IPV4_PATTERN, { message: "ip debe ser una IPv4 válida" }) ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsOptional() @IsEnum(NodeState) operativeState?: NodeState;
  @IsOptional() @IsEnum(NodeAssetSource) source?: NodeAssetSource;
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
        source: rest.source ?? NodeAssetSource.MANUAL,
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

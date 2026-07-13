import { Injectable } from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateNodeAnalyticsAssignmentDto {
  @IsString() @IsNotEmpty() analyticsCatalogId!: string;
  @IsOptional() @IsString() customLabel?: string;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateNodeAssetAnalyticsAssignmentDto {
  @IsString() @IsNotEmpty() analyticsCatalogId!: string;
  @IsOptional() @IsString() customLabel?: string;
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class NodeAnalyticsService {
  constructor(private prisma: PrismaService) {}

  findCatalog() {
    return this.prisma.analyticsCatalog.findMany({ orderBy: { name: "asc" } });
  }

  assignToNode(nodeId: string, dto: CreateNodeAnalyticsAssignmentDto) {
    const { analyticsCatalogId, ...rest } = dto;
    return this.prisma.nodeAnalyticsAssignment.create({
      data: {
        ...rest,
        node: { connect: { id: nodeId } },
        analyticsCatalog: { connect: { id: analyticsCatalogId } },
      },
      include: { analyticsCatalog: true },
    });
  }

  assignToAsset(nodeAssetId: string, dto: CreateNodeAssetAnalyticsAssignmentDto) {
    const { analyticsCatalogId, ...rest } = dto;
    return this.prisma.nodeAssetAnalyticsAssignment.create({
      data: {
        ...rest,
        nodeAsset: { connect: { id: nodeAssetId } },
        analyticsCatalog: { connect: { id: analyticsCatalogId } },
      },
      include: { analyticsCatalog: true },
    });
  }

  async removeNodeAssignment(assignmentId: string) {
    await this.prisma.nodeAnalyticsAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  async removeAssetAssignment(assignmentId: string) {
    await this.prisma.nodeAssetAnalyticsAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }
}

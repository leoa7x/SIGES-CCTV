import { Injectable } from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCenterDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() address?: string;
  @IsString() @IsNotEmpty() projectId!: string;
}

export class UpdateCenterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class MonitoringCentersService {
  constructor(private prisma: PrismaService) {}

  findAll(projectId?: string) {
    return this.prisma.monitoringCenter.findMany({
      where: projectId ? { projectId } : undefined,
      include: { project: { include: { city: true } }, _count: { select: { routes: true } } },
      orderBy: { name: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.monitoringCenter.findUniqueOrThrow({
      where: { id },
      include: { project: { include: { city: true } }, routes: { include: { _count: { select: { nodes: true } } } } },
    });
  }

  create(dto: CreateCenterDto) {
    const { projectId, ...rest } = dto;
    return this.prisma.monitoringCenter.create({ data: { ...rest, project: { connect: { id: projectId } } } });
  }

  update(id: string, dto: UpdateCenterDto) {
    return this.prisma.monitoringCenter.update({ where: { id }, data: dto as Parameters<typeof this.prisma.monitoringCenter.update>[0]["data"] });
  }
}

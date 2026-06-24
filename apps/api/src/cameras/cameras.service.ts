import { Injectable } from "@nestjs/common";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CameraState } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCameraDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsBoolean() hasAnalytics?: boolean;
  @IsString() @IsNotEmpty() nodeId!: string;
}

export class UpdateCameraDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsEnum(CameraState) state?: CameraState;
  @IsOptional() @IsBoolean() hasAnalytics?: boolean;
}

@Injectable()
export class CamerasService {
  constructor(private prisma: PrismaService) {}

  findAll(nodeId?: string) {
    return this.prisma.camera.findMany({
      where: nodeId ? { nodeId } : undefined,
      include: { node: true },
      orderBy: { code: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.camera.findUniqueOrThrow({
      where: { id },
      include: { node: { include: { route: { include: { center: true } } } } },
    });
  }

  create(dto: CreateCameraDto) {
    const { nodeId, ...rest } = dto;
    return this.prisma.camera.create({ data: { ...rest, node: { connect: { id: nodeId } } } });
  }

  update(id: string, dto: UpdateCameraDto) {
    return this.prisma.camera.update({ where: { id }, data: dto as Parameters<typeof this.prisma.camera.update>[0]["data"] });
  }
}

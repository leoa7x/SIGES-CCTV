import { BadRequestException, Injectable } from "@nestjs/common";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CameraState, CameraTransport } from "@prisma/client";
import { CameraSecretService } from "./camera-secret.service";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCameraDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsBoolean() hasAnalytics?: boolean;
  @IsOptional() @IsString() streamUrl?: string;
  @IsOptional() @IsString() streamUsername?: string;
  @IsOptional() @IsString() streamPassword?: string;
  @IsOptional() @IsEnum(CameraTransport) streamTransport?: CameraTransport;
  @IsOptional() @IsBoolean() previewEnabled?: boolean;
  @IsOptional() @IsString() onvifUrl?: string;
  @IsString() @IsNotEmpty() nodeId!: string;
}

export class UpdateCameraDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsEnum(CameraState) state?: CameraState;
  @IsOptional() @IsBoolean() hasAnalytics?: boolean;
  @IsOptional() @IsString() streamUrl?: string;
  @IsOptional() @IsString() streamUsername?: string;
  @IsOptional() @IsString() streamPassword?: string;
  @IsOptional() @IsEnum(CameraTransport) streamTransport?: CameraTransport;
  @IsOptional() @IsBoolean() previewEnabled?: boolean;
  @IsOptional() @IsString() onvifUrl?: string;
}

@Injectable()
export class CamerasService {
  constructor(
    private prisma: PrismaService,
    private readonly secretService: CameraSecretService,
  ) {}

  async findAll(nodeId?: string) {
    const cameras = await this.prisma.camera.findMany({
      where: nodeId ? { nodeId } : undefined,
      include: { node: true },
      orderBy: { code: "asc" },
    });
    return cameras.map((camera) => this.toSafeCamera(camera));
  }

  async findOne(id: string) {
    const camera = await this.prisma.camera.findUniqueOrThrow({
      where: { id },
      include: { node: { include: { route: { include: { center: true } } } } },
    });
    return this.toSafeCamera(camera);
  }

  /** Internal-only connection lookup for authenticated preview sessions. */
  async getPreviewConnection(id: string) {
    const camera = await this.prisma.camera.findUniqueOrThrow({ where: { id } });
    if (!camera.previewEnabled || !camera.streamUrl) {
      throw new BadRequestException("Camera is not configured for live preview");
    }
    return {
      streamUrl: camera.streamUrl,
      streamUsername: camera.streamUsername,
      streamPassword: camera.streamPasswordEncrypted ? this.secretService.decrypt(camera.streamPasswordEncrypted) : null,
      streamTransport: camera.streamTransport,
      previewEnabled: camera.previewEnabled,
    };
  }

  async create(dto: CreateCameraDto) {
    const { nodeId, streamPassword, ...rest } = dto;
    const camera = await this.prisma.camera.create({
      data: {
        ...rest,
        streamPasswordEncrypted: streamPassword ? this.secretService.encrypt(streamPassword) : undefined,
        node: { connect: { id: nodeId } },
      },
    });
    return this.toSafeCamera(camera);
  }

  async update(id: string, dto: UpdateCameraDto) {
    const { streamPassword, ...rest } = dto;
    const camera = await this.prisma.camera.update({
      where: { id },
      data: {
        ...rest,
        streamPasswordEncrypted: streamPassword ? this.secretService.encrypt(streamPassword) : undefined,
      } as Parameters<typeof this.prisma.camera.update>[0]["data"],
    });
    return this.toSafeCamera(camera);
  }

  private toSafeCamera<T extends { streamPasswordEncrypted?: string | null }>(
    camera: T,
  ): Omit<T, "streamPasswordEncrypted" | "streamPassword"> {
    const { streamPasswordEncrypted: _, streamPassword: __, ...safe } = camera as T & { streamPassword?: unknown };
    return safe;
  }
}

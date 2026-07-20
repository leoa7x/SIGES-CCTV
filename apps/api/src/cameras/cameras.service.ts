import { BadRequestException, Injectable } from "@nestjs/common";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CameraState, CameraTransport, Prisma } from "@prisma/client";
import { parsePagination } from "../common/pagination";
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

  async findAll(query: { nodeId?: string; search?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query.page, query.pageSize);
    const where: Prisma.CameraWhereInput = {
      ...(query.nodeId ? { nodeId: query.nodeId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [cameras, total] = await Promise.all([
      this.prisma.camera.findMany({
        where,
        include: { node: true },
        orderBy: { code: "asc" },
        skip,
        take,
      }),
      this.prisma.camera.count({ where }),
    ]);

    return { items: cameras.map((camera) => this.toSafeCamera(camera)), total, page, pageSize };
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
    this.validatePreviewUrl(camera.streamUrl, camera.ip);
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
    const stream = this.normalizeStreamUrl(rest.streamUrl, rest.ip, rest.streamUsername, streamPassword);
    const camera = await this.prisma.camera.create({
      data: {
        ...rest,
        streamUrl: stream.streamUrl,
        streamUsername: stream.streamUsername,
        streamPasswordEncrypted: stream.streamPassword ? this.secretService.encrypt(stream.streamPassword) : undefined,
        node: { connect: { id: nodeId } },
      },
    });
    return this.toSafeCamera(camera);
  }

  async update(id: string, dto: UpdateCameraDto) {
    const { streamPassword, ...rest } = dto;
    const stream = this.normalizeStreamUrl(rest.streamUrl, rest.ip, rest.streamUsername, streamPassword);
    const camera = await this.prisma.camera.update({
      where: { id },
      data: {
        ...rest,
        streamUrl: stream.streamUrl,
        streamUsername: stream.streamUsername,
        streamPasswordEncrypted: stream.streamPassword ? this.secretService.encrypt(stream.streamPassword) : undefined,
      } as Parameters<typeof this.prisma.camera.update>[0]["data"],
    });
    return this.toSafeCamera(camera);
  }

  private toSafeCamera<T extends { streamPasswordEncrypted?: string | null }>(
    camera: T,
  ): Omit<T, "streamPasswordEncrypted" | "streamPassword"> {
    const { streamPasswordEncrypted: _, streamPassword: __, ...safe } = camera as T & { streamPassword?: unknown };
    const streamUrl = (safe as { streamUrl?: string }).streamUrl;
    return { ...safe, streamUrl: this.redactStreamUrl(streamUrl) } as Omit<T, "streamPasswordEncrypted" | "streamPassword">;
  }

  private normalizeStreamUrl(
    streamUrl: string | undefined,
    ip: string | undefined,
    streamUsername: string | undefined,
    streamPassword: string | undefined,
  ) {
    if (!streamUrl) return { streamUrl, streamUsername, streamPassword };

    const url = this.validatePreviewUrl(streamUrl, ip);
    const embeddedUsername = url.username ? decodeURIComponent(url.username) : undefined;
    const embeddedPassword = url.password ? decodeURIComponent(url.password) : undefined;
    url.username = "";
    url.password = "";
    return {
      streamUrl: url.toString(),
      streamUsername: streamUsername ?? embeddedUsername,
      streamPassword: streamPassword ?? embeddedPassword,
    };
  }

  private validatePreviewUrl(streamUrl: string, ip?: string | null): URL {
    let url: URL;
    try {
      url = new URL(streamUrl);
    } catch {
      throw new BadRequestException("Camera preview URL must be a valid RTSP URL");
    }
    if (url.protocol !== "rtsp:" && url.protocol !== "rtsps:") {
      throw new BadRequestException("Camera preview URL must use RTSP or RTSPS");
    }
    if (!url.hostname) throw new BadRequestException("Camera preview URL must include a host");
    if (ip && url.hostname.toLowerCase() !== ip.toLowerCase()) {
      throw new BadRequestException("Camera preview URL host must match the configured camera IP");
    }
    return url;
  }

  private redactStreamUrl(streamUrl: string | undefined): string | undefined {
    if (!streamUrl) return streamUrl;
    try {
      const url = new URL(streamUrl);
      url.username = "";
      url.password = "";
      return url.toString();
    } catch {
      return streamUrl.replace(/^(rtsps?:\/\/)[^@/?#]*@/i, "$1");
    }
  }
}

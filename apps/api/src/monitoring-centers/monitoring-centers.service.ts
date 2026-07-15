import { Injectable } from "@nestjs/common";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCenterDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsString() @IsNotEmpty() projectId!: string;
}

export class UpdateCenterDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class MonitoringCentersService {
  constructor(private prisma: PrismaService) {}

  private async geocode(
    query: string,
    cityName: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const q = `${query}, ${cityName}, Colombia`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=co`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)" },
      });
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {}
    return null;
  }

  private async resolveCoordinatesForCity(
    cityName: string | undefined,
    input: { name?: string; address?: string; lat?: number; lng?: number },
  ): Promise<{ lat: number | undefined; lng: number | undefined }> {
    let { lat, lng } = input;

    if (lat != null && lng != null) return { lat, lng };
    if (!cityName) return { lat, lng };

    const searchTerm = input.address ?? input.name;
    if (!searchTerm) return { lat, lng };

    const coords = await this.geocode(searchTerm, cityName);
    if (!coords) return { lat, lng };

    return { lat: coords.lat, lng: coords.lng };
  }

  findAll(projectId?: string) {
    return this.prisma.monitoringCenter.findMany({
      where: projectId ? { projectId } : undefined,
      include: {
        project: { include: { city: true } },
        _count: { select: { routes: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.monitoringCenter.findUniqueOrThrow({
      where: { id },
      include: {
        project: { include: { city: true } },
        routes: { include: { _count: { select: { nodes: true } } } },
      },
    });
  }

  private async resolveCoordinatesForProject(
    projectId: string,
    input: { name?: string; address?: string; lat?: number; lng?: number },
  ): Promise<{ lat: number | undefined; lng: number | undefined }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { city: true },
    });
    return this.resolveCoordinatesForCity(project?.city?.name, input);
  }

  async create(dto: CreateCenterDto) {
    const { projectId, ...rest } = dto;
    const { lat, lng } = await this.resolveCoordinatesForProject(projectId, rest);

    return this.prisma.monitoringCenter.create({
      data: { ...rest, lat, lng, project: { connect: { id: projectId } } },
    });
  }

  async update(id: string, dto: UpdateCenterDto) {
    let data = dto as Parameters<typeof this.prisma.monitoringCenter.update>[0]["data"];
    if (dto.lat == null || dto.lng == null) {
      const current = await this.prisma.monitoringCenter.findUniqueOrThrow({
        where: { id },
        include: { project: { include: { city: true } } },
      });
      const coords = await this.resolveCoordinatesForCity(current.project?.city?.name, {
        name: dto.name ?? current.name,
        address: dto.address ?? current.address ?? undefined,
        lat: dto.lat,
        lng: dto.lng,
      });
      data = { ...dto, lat: coords.lat, lng: coords.lng } as Parameters<typeof this.prisma.monitoringCenter.update>[0]["data"];
    }

    return this.prisma.monitoringCenter.update({
      where: { id },
      data,
    });
  }
}

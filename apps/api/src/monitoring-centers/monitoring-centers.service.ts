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

  async create(dto: CreateCenterDto) {
    const { projectId, ...rest } = dto;
    let { lat, lng } = rest;

    if (lat == null || lng == null) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { city: true },
      });
      if (project?.city) {
        const searchTerm = rest.address ?? rest.name;
        const coords = await this.geocode(searchTerm, project.city.name);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
    }

    return this.prisma.monitoringCenter.create({
      data: { ...rest, lat, lng, project: { connect: { id: projectId } } },
    });
  }

  update(id: string, dto: UpdateCenterDto) {
    return this.prisma.monitoringCenter.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.monitoringCenter.update>[0]["data"],
    });
  }
}

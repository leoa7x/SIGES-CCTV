import { Injectable, NotFoundException } from "@nestjs/common";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { GeoEntityType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export class CreateCityDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsEnum(GeoEntityType) type?: GeoEntityType;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() daneCode?: string;
  @IsOptional() @IsInt() population?: number;
  @IsOptional() @IsNumber() areaSqKm?: number;
  @IsOptional() @IsString() contractObject?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class UpdateCityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(GeoEntityType) type?: GeoEntityType;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() daneCode?: string;
  @IsOptional() @IsInt() population?: number;
  @IsOptional() @IsNumber() areaSqKm?: number;
  @IsOptional() @IsString() contractObject?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

// ─── Counts helper type ────────────────────────────────────────────────────────

interface CityCounts {
  cameras: number;
  nodes: number;
  poles: number;
}

// ─── Nominatim response shape ──────────────────────────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CitiesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  // ── Geocoding via Nominatim ────────────────────────────────────────────────

  private async geocode(
    name: string,
    department?: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const query = department ? `${name}, ${department}, Colombia` : `${name}, Colombia`;
    const encoded = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=co`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)",
        },
      });
      if (!res.ok) return null;
      const results = (await res.json()) as NominatimResult[];
      if (!results.length) return null;
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    } catch {
      return null;
    }
  }

  // ── Compute counts via deep Prisma chain ──────────────────────────────────

  private async computeCounts(cityId: string): Promise<CityCounts> {
    // City → Projects → Centers → Routes → Nodes → Cameras
    const projects = await this.prisma.project.findMany({
      where: { cityId },
      select: {
        centers: {
          select: {
            routes: {
              select: {
                nodes: {
                  select: {
                    id: true,
                    hasPole: true,
                    cameras: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    let cameras = 0;
    let nodes = 0;
    let poles = 0;

    for (const project of projects) {
      for (const center of project.centers) {
        for (const route of center.routes) {
          for (const node of route.nodes) {
            nodes++;
            if (node.hasPole) poles++;
            cameras += node.cameras.length;
          }
        }
      }
    }

    return { cameras, nodes, poles };
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll() {
    const cities = await this.prisma.city.findMany({ orderBy: { name: "asc" } });
    const withCounts = await Promise.all(
      cities.map(async (city) => ({
        ...city,
        counts: await this.computeCounts(city.id),
      })),
    );
    return withCounts;
  }

  findOne(id: string) {
    return this.prisma.city.findUniqueOrThrow({ where: { id } });
  }

  async create(dto: CreateCityDto) {
    let lat = dto.lat;
    let lng = dto.lng;

    // Auto-geocode if lat/lng not supplied
    if (lat === undefined || lng === undefined) {
      const coords = await this.geocode(dto.name, dto.department ?? undefined);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }

    return this.prisma.city.create({
      data: {
        name: dto.name,
        type: dto.type,
        department: dto.department,
        daneCode: dto.daneCode,
        population: dto.population,
        areaSqKm: dto.areaSqKm,
        contractObject: dto.contractObject,
        lat,
        lng,
      },
    });
  }

  update(id: string, dto: UpdateCityDto) {
    return this.prisma.city.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.city.update>[0]["data"],
    });
  }

  // ── Logo upload ───────────────────────────────────────────────────────────

  async uploadLogo(
    id: string,
    buffer: Buffer,
    mimetype: string,
  ): Promise<{ logoUrl: string }> {
    // Ensure city exists
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException(`City ${id} not found`);

    let ext = mimetype.split("/")[1] ?? "png";
    if (ext === "jpeg") ext = "jpg";

    const key = `cities/${id}/logo.${ext}`;
    const logoUrl = await this.storage.upload(key, buffer, mimetype);

    await this.prisma.city.update({ where: { id }, data: { logoUrl } });
    return { logoUrl };
  }
}

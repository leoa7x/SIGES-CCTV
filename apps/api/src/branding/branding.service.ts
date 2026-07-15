import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { GeoEntityType } from "@prisma/client";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

// Raster-only whitelist: this file is served from a public-read bucket and
// surfaced unauthenticated on the login page (see PublicBrandingController),
// so accepting SVG/HTML content types would let anyone with MANAGE_ORG store
// a script that executes for every anonymous visitor of the login screen.
const ALLOWED_LOGO_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export class CreateBrandingProfileDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() cityId!: string;
  @IsOptional() @IsString() loginMessage?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBrandingProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() cityId?: string;
  @IsOptional() @IsString() loginMessage?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
export class BrandingService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  findAll() {
    return this.prisma.brandingProfile.findMany({
      include: {
        city: { select: { id: true, name: true, type: true, department: true } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  findOne(id: string) {
    return this.prisma.brandingProfile.findUniqueOrThrow({
      where: { id },
      include: {
        city: { select: { id: true, name: true, type: true, department: true } },
      },
    });
  }

  async create(dto: CreateBrandingProfileDto) {
    await this.ensureCityExists(dto.cityId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.brandingProfile.updateMany({ where: { isActive: true }, data: { isActive: false } });
      }
      return tx.brandingProfile.create({
        data: {
          name: dto.name,
          cityId: dto.cityId,
          loginMessage: dto.loginMessage?.trim() || null,
          isActive: dto.isActive ?? false,
        },
      });
    });
  }

  async update(id: string, dto: UpdateBrandingProfileDto) {
    if (dto.cityId) {
      await this.ensureCityExists(dto.cityId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.brandingProfile.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }
      return tx.brandingProfile.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
          ...(dto.loginMessage !== undefined ? { loginMessage: dto.loginMessage.trim() || null } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
  }

  async uploadLogo(id: string, buffer: Buffer, mimetype: string) {
    const profile = await this.prisma.brandingProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException(`Branding profile ${id} not found`);

    const ext = ALLOWED_LOGO_MIME_TYPES[mimetype];
    if (!ext) {
      throw new BadRequestException("Logo must be a PNG, JPEG, or WebP image");
    }

    const key = `branding/${id}/logo.${ext}`;
    const logoUrl = await this.storage.upload(key, buffer, mimetype);
    await this.prisma.brandingProfile.update({ where: { id }, data: { logoUrl } });
    return { logoUrl };
  }

  async getActivePublic() {
    const active = await this.prisma.brandingProfile.findFirst({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        loginMessage: true,
        city: {
          select: { id: true, name: true, type: true, department: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!active) return null;

    return {
      id: active.id,
      name: active.name,
      logoUrl: active.logoUrl,
      loginMessage: active.loginMessage,
      entity: {
        id: active.city.id,
        name: active.city.name,
        type: active.city.type as GeoEntityType,
        department: active.city.department,
      },
    };
  }

  private async ensureCityExists(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) throw new NotFoundException(`City ${cityId} not found`);
  }
}

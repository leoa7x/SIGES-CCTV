import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { BrandingSnapshot } from "./ops-reports.types";

@Injectable()
export class OpsReportBrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveBrandingSnapshot(): Promise<BrandingSnapshot> {
    const active = await this.prisma.brandingProfile.findFirst({
      where: { isActive: true },
      select: { id: true, name: true, logoUrl: true, loginMessage: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!active) throw new NotFoundException("No active branding profile found for report generation");

    return {
      profileId: active.id,
      name: active.name,
      logoUrl: active.logoUrl,
      loginMessage: active.loginMessage,
    };
  }
}

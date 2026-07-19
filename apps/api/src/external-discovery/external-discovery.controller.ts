import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ExternalDiscoveryService, type ExternalFindingStatus } from "./external-discovery.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("external-discovery")
export class ExternalDiscoveryController {
  constructor(private readonly service: ExternalDiscoveryService) {}

  @Get("centers/:centerId")
  listByCenter(@Param("centerId") centerId: string) {
    return this.service.listByCenter(centerId);
  }

  @RequirePermissions(Permission.MANAGE_ORG)
  @Patch(":id/status")
  setStatus(@Param("id") id: string, @Body("status") status: ExternalFindingStatus) {
    return this.service.setStatus(id, status);
  }
}

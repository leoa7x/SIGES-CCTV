import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CenterDiscoveryService, ConfirmCenterDiscoveredDeviceDto } from "./center-discovery.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("center-discovery")
export class CenterDiscoveryController {
  constructor(private service: CenterDiscoveryService) {}

  @RequirePermissions(Permission.RESOLVE_DISCOVERY)
  @Post("devices/:id/confirm")
  confirm(@Param("id") id: string, @Body() dto: ConfirmCenterDiscoveredDeviceDto) {
    return this.service.confirmDevice(id, dto);
  }

  @RequirePermissions(Permission.RESOLVE_DISCOVERY)
  @Post("devices/:id/dismiss")
  dismiss(@Param("id") id: string) {
    return this.service.dismissDevice(id);
  }
}

import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ConfirmDiscoveredDeviceDto, NodeDiscoveryService } from "./node-discovery.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller()
export class NodeDiscoveryController {
  constructor(private service: NodeDiscoveryService) {}

  @RequirePermissions(Permission.RUN_DISCOVERY)
  @Post("nodes/:id/discovery-jobs")
  run(@Param("id") id: string) {
    return this.service.runForNode(id);
  }

  @RequirePermissions(Permission.RESOLVE_DISCOVERY)
  @Post("node-discovery/devices/:id/confirm")
  confirm(@Param("id") id: string, @Body() dto: ConfirmDiscoveredDeviceDto) {
    return this.service.confirmDevice(id, dto);
  }

  @RequirePermissions(Permission.RESOLVE_DISCOVERY)
  @Post("node-discovery/devices/:id/dismiss")
  dismiss(@Param("id") id: string) {
    return this.service.dismissDevice(id);
  }
}

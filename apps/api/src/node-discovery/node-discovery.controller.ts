import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfirmDiscoveredDeviceDto, NodeDiscoveryService } from "./node-discovery.service";

@UseGuards(AuthGuard("jwt"))
@Controller()
export class NodeDiscoveryController {
  constructor(private service: NodeDiscoveryService) {}

  @Post("nodes/:id/discovery-jobs")
  run(@Param("id") id: string) {
    return this.service.runForNode(id);
  }

  @Post("node-discovery/devices/:id/confirm")
  confirm(@Param("id") id: string, @Body() dto: ConfirmDiscoveredDeviceDto) {
    return this.service.confirmDevice(id, dto);
  }

  @Post("node-discovery/devices/:id/dismiss")
  dismiss(@Param("id") id: string) {
    return this.service.dismissDevice(id);
  }
}

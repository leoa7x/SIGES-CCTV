import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { ObservabilityService } from "./observability.service";

@UseGuards(AuthGuard("jwt"))
@Controller("observability")
export class ObservabilityController {
  constructor(private readonly service: ObservabilityService) {}

  @Get("embed/node/:id")
  getNodeEmbed(@Param("id") id: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.service.getDashboardEmbed({
      dashboard: "node-observability",
      nodeId: id,
      from,
      to,
    });
  }

  @Get("embed/network-command-view")
  getNetworkCommandView(
    @Query("routeId") routeId?: string,
    @Query("centerId") centerId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.getDashboardEmbed({
      dashboard: "network-command-view",
      routeId,
      centerId,
      from,
      to,
    });
  }
}

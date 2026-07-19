import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

import { IngestNetworkTelemetryDto } from "./network-telemetry.ingest.dto";
import { NetworkTelemetryService } from "./network-telemetry.service";

@Controller("network-telemetry")
export class NetworkTelemetryController {
  constructor(private service: NetworkTelemetryService) {}

  @Post("ingest")
  ingest(@Headers("authorization") authorization: string | undefined, @Body() dto: IngestNetworkTelemetryDto) {
    return this.service.ingestWithCollectorAuth(authorization, dto);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/summary")
  summary(@Param("id") id: string) {
    return this.service.getNodeSummary(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/timeseries")
  timeseries(@Param("id") id: string) {
    return this.service.getNodeTimeseries(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/assets")
  assets(@Param("id") id: string) {
    return this.service.getNodeAssets(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("nodes/:id/alerts")
  alerts(@Param("id") id: string) {
    return this.service.getNodeAlerts(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("centers/:id/official-assets")
  centerOfficialAssets(@Param("id") id: string) {
    return this.service.getCenterOfficialAssets(id);
  }

  @UseGuards(AuthGuard("jwt"))
  @Get("centers/:id/alerts")
  centerAlerts(@Param("id") id: string) {
    return this.service.getCenterAlerts(id);
  }
}

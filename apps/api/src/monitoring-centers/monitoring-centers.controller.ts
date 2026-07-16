import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CenterDiscoveryService } from "../center-discovery/center-discovery.service";
import { MonitoringCentersService, CreateCenterDto, UpdateCenterDto } from "./monitoring-centers.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("monitoring-centers")
export class MonitoringCentersController {
  constructor(
    private service: MonitoringCentersService,
    private centerDiscoveryService: CenterDiscoveryService,
  ) {}

  @Get() findAll(@Query("projectId") projectId?: string) { return this.service.findAll(projectId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_ORG) @Post() create(@Body() dto: CreateCenterDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_ORG) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCenterDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.RUN_DISCOVERY) @Post(":id/discovery-jobs") runDiscovery(@Param("id") id: string) { return this.centerDiscoveryService.runForCenter(id); }
}

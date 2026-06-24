import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MonitoringCentersService, CreateCenterDto, UpdateCenterDto } from "./monitoring-centers.service";

@UseGuards(AuthGuard("jwt"))
@Controller("monitoring-centers")
export class MonitoringCentersController {
  constructor(private service: MonitoringCentersService) {}

  @Get() findAll(@Query("projectId") projectId?: string) { return this.service.findAll(projectId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateCenterDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCenterDto) { return this.service.update(id, dto); }
}

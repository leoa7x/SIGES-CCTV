import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { NodesService, CreateNodeDto, UpdateNodeDto } from "./nodes.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("nodes")
export class NodesController {
  constructor(private service: NodesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Get("geojson") findGeoJson() { return this.service.findGeoJson(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_NODES) @Post() create(@Body() dto: CreateNodeDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_NODES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateNodeDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_NODES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

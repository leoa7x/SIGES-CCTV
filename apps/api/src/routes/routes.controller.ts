import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RoutesService, CreateRouteDto, UpdateRouteDto } from "./routes.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("routes")
export class RoutesController {
  constructor(private service: RoutesService) {}

  @Get() findAll(@Query("centerId") centerId?: string) { return this.service.findAll(centerId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_ROUTES) @Post() create(@Body() dto: CreateRouteDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_ROUTES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateRouteDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_ROUTES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateFiberCableDto, FiberCablesService, UpdateFiberCableDto } from "./fiber-cables.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("fiber-cables")
export class FiberCablesController {
  constructor(private service: FiberCablesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post() create(@Body() dto: CreateFiberCableDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberCableDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CamerasService, CreateCameraDto, UpdateCameraDto } from "./cameras.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("cameras")
export class CamerasController {
  constructor(private service: CamerasService) {}

  @Get() findAll(
    @Query("nodeId") nodeId?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.service.findAll({ nodeId, search, page, pageSize });
  }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_CAMERAS) @Post() create(@Body() dto: CreateCameraDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_CAMERAS) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCameraDto) { return this.service.update(id, dto); }
}

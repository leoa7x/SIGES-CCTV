import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";

import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CenterAssetsService, CreateCenterAssetDto, UpdateCenterAssetDto } from "./center-assets.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("center-assets")
export class CenterAssetsController {
  constructor(private service: CenterAssetsService) {}

  @Get() findAll(@Query("centerId") centerId?: string) { return this.service.findAll(centerId); }
  @RequirePermissions(Permission.MANAGE_ORG) @Post() create(@Body() dto: CreateCenterAssetDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_ORG) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCenterAssetDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_ORG) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

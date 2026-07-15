import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { CreateNodeAssetDto, NodeAssetsService, UpdateNodeAssetDto } from "./node-assets.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("node-assets")
export class NodeAssetsController {
  constructor(private service: NodeAssetsService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @RequirePermissions(Permission.MANAGE_NODES) @Post() create(@Body() dto: CreateNodeAssetDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_NODES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateNodeAssetDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_NODES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

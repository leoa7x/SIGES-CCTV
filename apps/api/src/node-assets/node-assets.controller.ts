import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateNodeAssetDto, NodeAssetsService, UpdateNodeAssetDto } from "./node-assets.service";

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR];

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("node-assets")
export class NodeAssetsController {
  constructor(private service: NodeAssetsService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Roles(...MANAGE_ROLES) @Post() create(@Body() dto: CreateNodeAssetDto) { return this.service.create(dto); }
  @Roles(...MANAGE_ROLES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateNodeAssetDto) { return this.service.update(id, dto); }
  @Roles(...MANAGE_ROLES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

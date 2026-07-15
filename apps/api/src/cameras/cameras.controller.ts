import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CamerasService, CreateCameraDto, UpdateCameraDto } from "./cameras.service";

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR];

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("cameras")
export class CamerasController {
  constructor(private service: CamerasService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Roles(...MANAGE_ROLES) @Post() create(@Body() dto: CreateCameraDto) { return this.service.create(dto); }
  @Roles(...MANAGE_ROLES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCameraDto) { return this.service.update(id, dto); }
}

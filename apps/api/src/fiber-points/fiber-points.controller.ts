import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateFiberPointDto, FiberPointsService, UpdateFiberPointDto } from "./fiber-points.service";

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR];

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("fiber-points")
export class FiberPointsController {
  constructor(private service: FiberPointsService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Roles(...MANAGE_ROLES) @Post() create(@Body() dto: CreateFiberPointDto) { return this.service.create(dto); }
  @Roles(...MANAGE_ROLES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberPointDto) { return this.service.update(id, dto); }
  @Roles(...MANAGE_ROLES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

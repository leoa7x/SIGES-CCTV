import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { FiberSegmentsService, CreateFiberSegmentDto, UpdateFiberSegmentDto } from "./fiber-segments.service";

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR];

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("fiber-segments")
export class FiberSegmentsController {
  constructor(private service: FiberSegmentsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get("geojson") findAllGeoJson() { return this.service.findAllGeoJson(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Roles(...MANAGE_ROLES) @Post() create(@Body() dto: CreateFiberSegmentDto) { return this.service.create(dto); }
  @Roles(...MANAGE_ROLES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberSegmentDto) { return this.service.update(id, dto); }
  @Roles(...MANAGE_ROLES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

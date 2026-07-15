import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { FiberSegmentsService, CreateFiberSegmentDto, UpdateFiberSegmentDto } from "./fiber-segments.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("fiber-segments")
export class FiberSegmentsController {
  constructor(private service: FiberSegmentsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get("geojson") findAllGeoJson() { return this.service.findAllGeoJson(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post() create(@Body() dto: CreateFiberSegmentDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberSegmentDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

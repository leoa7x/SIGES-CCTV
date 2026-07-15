import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  CreateSpliceBlockInputDto,
  CreateSpliceCableLegDto,
  CreateSpliceDto,
  SplicesService,
  UpdateSpliceDto,
} from "./splices.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("splices")
export class SplicesController {
  constructor(private service: SplicesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post() create(@Body() dto: CreateSpliceDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateSpliceDto) { return this.service.update(id, dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post(":id/legs") addLeg(@Param("id") id: string, @Body() dto: CreateSpliceCableLegDto) { return this.service.addLeg(id, dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post(":id/block-inputs") addBlockInput(@Param("id") id: string, @Body() dto: CreateSpliceBlockInputDto) { return this.service.addBlockInput(id, dto); }
  @RequirePermissions(Permission.MANAGE_FIBER) @Post(":id/expand-blocks") expandBlocks(@Param("id") id: string) { return this.service.expandBlocks(id); }
}

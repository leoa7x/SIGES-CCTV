import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  CreateSpliceBlockInputDto,
  CreateSpliceCableLegDto,
  CreateSpliceDto,
  SplicesService,
  UpdateSpliceDto,
} from "./splices.service";

const MANAGE_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPERVISOR];

@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("splices")
export class SplicesController {
  constructor(private service: SplicesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Roles(...MANAGE_ROLES) @Post() create(@Body() dto: CreateSpliceDto) { return this.service.create(dto); }
  @Roles(...MANAGE_ROLES) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateSpliceDto) { return this.service.update(id, dto); }
  @Roles(...MANAGE_ROLES) @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
  @Roles(...MANAGE_ROLES) @Post(":id/legs") addLeg(@Param("id") id: string, @Body() dto: CreateSpliceCableLegDto) { return this.service.addLeg(id, dto); }
  @Roles(...MANAGE_ROLES) @Post(":id/block-inputs") addBlockInput(@Param("id") id: string, @Body() dto: CreateSpliceBlockInputDto) { return this.service.addBlockInput(id, dto); }
  @Roles(...MANAGE_ROLES) @Post(":id/expand-blocks") expandBlocks(@Param("id") id: string) { return this.service.expandBlocks(id); }
}

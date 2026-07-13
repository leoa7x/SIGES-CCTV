import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  CreateSpliceBlockInputDto,
  CreateSpliceCableLegDto,
  CreateSpliceDto,
  SplicesService,
  UpdateSpliceDto,
} from "./splices.service";

@UseGuards(AuthGuard("jwt"))
@Controller("splices")
export class SplicesController {
  constructor(private service: SplicesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Post() create(@Body() dto: CreateSpliceDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateSpliceDto) { return this.service.update(id, dto); }
  @Post(":id/legs") addLeg(@Param("id") id: string, @Body() dto: CreateSpliceCableLegDto) { return this.service.addLeg(id, dto); }
  @Post(":id/block-inputs") addBlockInput(@Param("id") id: string, @Body() dto: CreateSpliceBlockInputDto) { return this.service.addBlockInput(id, dto); }
  @Post(":id/expand-blocks") expandBlocks(@Param("id") id: string) { return this.service.expandBlocks(id); }
}

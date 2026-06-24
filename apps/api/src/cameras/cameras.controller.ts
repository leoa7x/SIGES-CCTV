import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CamerasService, CreateCameraDto, UpdateCameraDto } from "./cameras.service";

@UseGuards(AuthGuard("jwt"))
@Controller("cameras")
export class CamerasController {
  constructor(private service: CamerasService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateCameraDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCameraDto) { return this.service.update(id, dto); }
}

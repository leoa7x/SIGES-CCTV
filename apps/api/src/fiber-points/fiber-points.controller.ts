import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreateFiberPointDto, FiberPointsService, UpdateFiberPointDto } from "./fiber-points.service";

@UseGuards(AuthGuard("jwt"))
@Controller("fiber-points")
export class FiberPointsController {
  constructor(private service: FiberPointsService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Post() create(@Body() dto: CreateFiberPointDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberPointDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

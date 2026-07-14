import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { RoutesService, CreateRouteDto, UpdateRouteDto } from "./routes.service";

@UseGuards(AuthGuard("jwt"))
@Controller("routes")
export class RoutesController {
  constructor(private service: RoutesService) {}

  @Get() findAll(@Query("centerId") centerId?: string) { return this.service.findAll(centerId); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateRouteDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateRouteDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreateFiberCableDto, FiberCablesService, UpdateFiberCableDto } from "./fiber-cables.service";

@UseGuards(AuthGuard("jwt"))
@Controller("fiber-cables")
export class FiberCablesController {
  constructor(private service: FiberCablesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Post() create(@Body() dto: CreateFiberCableDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberCableDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

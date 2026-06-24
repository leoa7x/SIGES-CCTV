import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { NodesService, CreateNodeDto, UpdateNodeDto } from "./nodes.service";

@UseGuards(AuthGuard("jwt"))
@Controller("nodes")
export class NodesController {
  constructor(private service: NodesService) {}

  @Get() findAll(@Query("routeId") routeId?: string) { return this.service.findAll(routeId); }
  @Get("geojson") findGeoJson() { return this.service.findGeoJson(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateNodeDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateNodeDto) { return this.service.update(id, dto); }
}

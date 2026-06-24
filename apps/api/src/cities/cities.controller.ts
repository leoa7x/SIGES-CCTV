import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CitiesService, CreateCityDto, UpdateCityDto } from "./cities.service";

@UseGuards(AuthGuard("jwt"))
@Controller("cities")
export class CitiesController {
  constructor(private service: CitiesService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateCityDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCityDto) { return this.service.update(id, dto); }
}

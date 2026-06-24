import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IncidentsService, CreateIncidentDto, UpdateIncidentDto } from "./incidents.service";

@UseGuards(AuthGuard("jwt"))
@Controller("incidents")
export class IncidentsController {
  constructor(private service: IncidentsService) {}

  @Get() findAll(@Query("status") status?: string) { return this.service.findAll(status); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateIncidentDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateIncidentDto) { return this.service.update(id, dto); }
}

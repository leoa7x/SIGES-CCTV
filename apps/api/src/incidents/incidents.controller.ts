import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { IncidentsService, CreateIncidentDto, UpdateIncidentDto } from "./incidents.service";

type AuthenticatedRequest = Request & { user: { role: UserRole } };

@UseGuards(AuthGuard("jwt"))
@Controller("incidents")
export class IncidentsController {
  constructor(private service: IncidentsService) {}

  @Get() findAll(@Query("status") status?: string) { return this.service.findAll(status); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateIncidentDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.role);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateIncidentDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.user.role);
  }
}

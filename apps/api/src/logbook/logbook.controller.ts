import { Body, Controller, Get, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { LogbookService, CreateLogbookEntryDto } from "./logbook.service";

type AuthenticatedRequest = Request & { user: { role: UserRole } };

@UseGuards(AuthGuard("jwt"))
@Controller("logbook")
export class LogbookController {
  constructor(private service: LogbookService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Post() create(@Body() dto: CreateLogbookEntryDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.role);
  }
}

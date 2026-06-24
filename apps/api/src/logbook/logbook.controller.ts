import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { LogbookService, CreateLogbookEntryDto } from "./logbook.service";

@UseGuards(AuthGuard("jwt"))
@Controller("logbook")
export class LogbookController {
  constructor(private service: LogbookService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Post() create(@Body() dto: CreateLogbookEntryDto) { return this.service.create(dto); }
}

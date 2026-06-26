import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FiberSegmentsService, CreateFiberSegmentDto, UpdateFiberSegmentDto } from "./fiber-segments.service";

@UseGuards(AuthGuard("jwt"))
@Controller("fiber-segments")
export class FiberSegmentsController {
  constructor(private service: FiberSegmentsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateFiberSegmentDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateFiberSegmentDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}

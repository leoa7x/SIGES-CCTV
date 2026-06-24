import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from "./projects.service";

@UseGuards(AuthGuard("jwt"))
@Controller("projects")
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateProjectDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateProjectDto) { return this.service.update(id, dto); }
}

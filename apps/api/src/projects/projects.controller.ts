import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from "./projects.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @RequirePermissions(Permission.MANAGE_ORG) @Post() create(@Body() dto: CreateProjectDto) { return this.service.create(dto); }
  @RequirePermissions(Permission.MANAGE_ORG) @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateProjectDto) { return this.service.update(id, dto); }
}

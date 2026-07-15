import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission, UserRole } from "@prisma/client";
import type { Request } from "express";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { UsersService, CreateUserDto, UpdateUserDto } from "./users.service";

type AuthenticatedRequest = Request & { user: { role: UserRole } };

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS)
@Controller("users")
export class UsersController {
  constructor(private service: UsersService) {}

  // Overrides the controller-level MANAGE_USERS requirement with an empty
  // permission list (PermissionsGuard treats [] as "any authenticated user").
  // The logbook's technician picker needs this list but most TECHNICIAN/
  // OPERATOR accounts filing entries don't have MANAGE_USERS — without this
  // override, that Promise.all() 403s and silently breaks the whole page.
  // Must stay above the ":id" route below or Nest would match "technicians"
  // as an :id param instead.
  @RequirePermissions()
  @Get("technicians")
  findTechnicians() { return this.service.findTechnicians(); }

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user.role);
  }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.user.role);
  }
}

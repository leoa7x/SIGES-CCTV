import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { UsersService, CreateUserDto, UpdateUserDto } from "./users.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@RequirePermissions(Permission.MANAGE_USERS)
@Controller("users")
export class UsersController {
  constructor(private service: UsersService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateUserDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateUserDto) { return this.service.update(id, dto); }
}

import { Injectable } from "@nestjs/common";
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { EntityState, Permission, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  state: true,
  createdAt: true,
} as const;

function normalizePermissions(role: UserRole | undefined, permissions: Permission[] | undefined) {
  if (!role || role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
    return [];
  }
  return [...new Set(permissions ?? [])];
}

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() name?: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsArray() @IsEnum(Permission, { each: true }) permissions?: Permission[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsArray() @IsEnum(Permission, { each: true }) permissions?: Permission[];
  @IsOptional() @IsEnum(EntityState) state?: EntityState;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { email: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: USER_SELECT,
    });
  }

  async create(dto: CreateUserDto) {
    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        permissions: normalizePermissions(rest.role, rest.permissions),
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.role || dto.permissions
          ? {
              permissions: normalizePermissions(dto.role, dto.permissions),
            }
          : {}),
      },
      select: USER_SELECT,
    });
  }
}

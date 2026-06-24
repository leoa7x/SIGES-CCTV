import { Injectable } from "@nestjs/common";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() name?: string;
  @IsEnum(UserRole) role!: UserRole;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, state: true, createdAt: true },
      orderBy: { email: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: { id: true, email: true, name: true, role: true, state: true, createdAt: true },
    });
  }

  async create(dto: CreateUserDto) {
    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: { id: true, email: true, name: true, role: true, state: true, createdAt: true },
    });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto as Parameters<typeof this.prisma.user.update>[0]["data"],
      select: { id: true, email: true, name: true, role: true, state: true, createdAt: true },
    });
  }
}

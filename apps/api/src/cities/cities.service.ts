import { Injectable } from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateCityDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() department!: string;
}

export class UpdateCityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class CitiesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.city.findMany({ orderBy: { name: "asc" } });
  }

  findOne(id: string) {
    return this.prisma.city.findUniqueOrThrow({ where: { id } });
  }

  create(dto: CreateCityDto) {
    return this.prisma.city.create({ data: dto });
  }

  update(id: string, dto: UpdateCityDto) {
    return this.prisma.city.update({ where: { id }, data: dto as Parameters<typeof this.prisma.city.update>[0]["data"] });
  }
}

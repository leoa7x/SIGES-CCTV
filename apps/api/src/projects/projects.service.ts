import { Injectable } from "@nestjs/common";
import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

export class CreateProjectDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() client!: string;
  @IsOptional() @IsString() contract?: string;
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsString() @IsNotEmpty() cityId!: string;
}

export class UpdateProjectDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() contract?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() state?: string;
}

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      include: { city: true, _count: { select: { centers: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  findOne(id: string) {
    return this.prisma.project.findUniqueOrThrow({
      where: { id },
      include: { city: true, centers: { include: { _count: { select: { routes: true } } } } },
    });
  }

  create(dto: CreateProjectDto) {
    const { cityId, startDate, endDate, ...rest } = dto;
    return this.prisma.project.create({
      data: { ...rest, startDate: new Date(startDate), endDate: endDate ? new Date(endDate) : undefined, city: { connect: { id: cityId } } },
    });
  }

  update(id: string, dto: UpdateProjectDto) {
    const { endDate, ...rest } = dto;
    return this.prisma.project.update({
      where: { id },
      data: { ...rest, endDate: endDate ? new Date(endDate) : undefined } as Parameters<typeof this.prisma.project.update>[0]["data"],
    });
  }
}

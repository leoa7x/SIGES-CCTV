import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IncidentSeverity, IncidentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export class CreateIncidentDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(IncidentSeverity) severity!: IncidentSeverity;
  @IsOptional() @IsString() nodeId?: string;
  @IsOptional() @IsString() cameraId?: string;
  @IsOptional() @IsString() centerId?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

export class UpdateIncidentDto {
  @IsOptional() @IsEnum(IncidentStatus) status?: IncidentStatus;
  @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @IsOptional() @IsString() solution?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  findAll(status?: string) {
    return this.prisma.incident.findMany({
      where: status ? { status: status as IncidentStatus } : undefined,
      include: {
        node: true,
        camera: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { detectedAt: "desc" },
    });
  }

  findOne(id: string) {
    return this.prisma.incident.findUniqueOrThrow({
      where: { id },
      include: {
        node: { include: { route: { include: { center: true } } } },
        camera: true,
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  create(dto: CreateIncidentDto) {
    const { nodeId, cameraId, centerId, assignedUserId, ...rest } = dto;
    return this.prisma.incident.create({
      data: {
        ...rest,
        node: nodeId ? { connect: { id: nodeId } } : undefined,
        camera: cameraId ? { connect: { id: cameraId } } : undefined,
        center: centerId ? { connect: { id: centerId } } : undefined,
        assignedUser: assignedUserId ? { connect: { id: assignedUserId } } : undefined,
      },
    });
  }

  update(id: string, dto: UpdateIncidentDto) {
    const { assignedUserId, ...rest } = dto;
    return this.prisma.incident.update({
      where: { id },
      data: {
        ...rest,
        resolvedAt: rest.status === "RESOLVED" || rest.status === "CLOSED" ? new Date() : undefined,
        assignedUser: assignedUserId ? { connect: { id: assignedUserId } } : undefined,
      } as Parameters<typeof this.prisma.incident.update>[0]["data"],
    });
  }
}

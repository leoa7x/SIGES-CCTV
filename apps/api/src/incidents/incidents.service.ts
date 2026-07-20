import { ForbiddenException, Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { IncidentSeverity, IncidentStatus, Prisma, UserRole } from "@prisma/client";
import { parsePagination } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

// VIEWER is the read-only role — writing to the incident log must stay
// restricted to staff who actually work incidents, not passive observers.
function assertCanWriteIncidents(requesterRole: UserRole) {
  if (requesterRole === UserRole.VIEWER) {
    throw new ForbiddenException("Viewers cannot create or update incidents");
  }
}

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

  async findAll(query: { status?: string; search?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query.page, query.pageSize);
    const where: Prisma.IncidentWhereInput = {
      ...(query.status ? { status: query.status as IncidentStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { node: { is: { name: { contains: query.search, mode: "insensitive" } } } },
              { node: { is: { code: { contains: query.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        include: {
          node: true,
          camera: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { detectedAt: "desc" },
        skip,
        take,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return { items, total, page, pageSize };
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

  create(dto: CreateIncidentDto, requesterRole: UserRole) {
    assertCanWriteIncidents(requesterRole);
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

  update(id: string, dto: UpdateIncidentDto, requesterRole: UserRole) {
    assertCanWriteIncidents(requesterRole);
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

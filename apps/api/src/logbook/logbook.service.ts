import { ForbiddenException, Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ActivityType, EntryResult, Prisma, UserRole } from "@prisma/client";
import { parsePagination } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

export class CreateLogbookEntryDto {
  @IsEnum(ActivityType) activityType!: ActivityType;
  @IsOptional() @IsString() observations?: string;
  @IsEnum(EntryResult) result!: EntryResult;
  @IsString() @IsNotEmpty() technicianId!: string;
  @IsString() @IsNotEmpty() nodeId!: string;
}

@Injectable()
export class LogbookService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { nodeId?: string; page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = parsePagination(query.page, query.pageSize);
    const where: Prisma.LogbookEntryWhereInput = query.nodeId ? { nodeId: query.nodeId } : {};

    const [items, total] = await Promise.all([
      this.prisma.logbookEntry.findMany({
        where,
        include: {
          technician: { select: { id: true, name: true, email: true } },
          node: true,
        },
        orderBy: { date: "desc" },
        skip,
        take,
      }),
      this.prisma.logbookEntry.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  create(dto: CreateLogbookEntryDto, requesterRole: UserRole) {
    // VIEWER is the read-only role — the field logbook is an audit trail of
    // work performed and must stay restricted to staff who actually do it.
    if (requesterRole === UserRole.VIEWER) {
      throw new ForbiddenException("Viewers cannot create logbook entries");
    }
    const { technicianId, nodeId, ...rest } = dto;
    return this.prisma.logbookEntry.create({
      data: {
        ...rest,
        technician: { connect: { id: technicianId } },
        node: { connect: { id: nodeId } },
      },
    });
  }
}

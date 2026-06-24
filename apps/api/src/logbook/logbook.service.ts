import { Injectable } from "@nestjs/common";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ActivityType, EntryResult } from "@prisma/client";
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

  findAll(nodeId?: string) {
    return this.prisma.logbookEntry.findMany({
      where: nodeId ? { nodeId } : undefined,
      include: {
        technician: { select: { id: true, name: true, email: true } },
        node: true,
      },
      orderBy: { date: "desc" },
    });
  }

  create(dto: CreateLogbookEntryDto) {
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

import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { HistoricalArtifactInput, OpsReportFilters, OpsReportType } from "./ops-reports.types";

type CreateHistoricalReportInput = {
  reportType: OpsReportType;
  title: string;
  generatedByUserId: string | null;
  trigger: "MANUAL" | "SCHEDULED";
  filters: OpsReportFilters;
  brandingSnapshot: Record<string, unknown>;
  pdf: HistoricalArtifactInput;
  csv: HistoricalArtifactInput;
};

@Injectable()
export class OpsReportHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createHistoricalReport(input: CreateHistoricalReportInput) {
    const reportId = randomUUID();
    const artifacts = [
      { format: "PDF" as const, file: input.pdf },
      { format: "CSV" as const, file: input.csv },
    ];
    const stored: Prisma.OpsReportArtifactCreateManyInput[] = [];

    for (const artifact of artifacts) {
      const storageKey = `reports/${reportId}/${artifact.file.fileName}`;
      const retrievalReference = await this.storage.uploadPrivateLikeHistorical(
        storageKey,
        artifact.file.buffer,
        artifact.file.mimeType,
      );
      stored.push({
        reportDefinitionId: reportId,
        format: artifact.format,
        fileName: artifact.file.fileName,
        storageKey,
        publicUrl: retrievalReference,
        mimeType: artifact.file.mimeType,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.opsReportDefinition.create({
        data: {
          id: reportId,
          reportType: input.reportType,
          title: input.title,
          dateFrom: new Date(input.filters.dateFrom),
          dateTo: new Date(input.filters.dateTo),
          filtersJson: input.filters as Prisma.InputJsonValue,
          brandingSnapshotJson: input.brandingSnapshot as Prisma.InputJsonValue,
          generatedByUserId: input.generatedByUserId,
          trigger: input.trigger,
        },
      });
      await tx.opsReportArtifact.createMany({ data: stored });
      return definition;
    });
  }
}

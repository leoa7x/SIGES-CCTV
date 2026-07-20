import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { OpsReportsService } from "./ops-reports.service";

@Injectable()
export class OpsReportSchedulerService {
  private readonly completedWindows = new Set<string>();

  constructor(private readonly prisma: PrismaService, private readonly reports: OpsReportsService) {}

  async executeDueSchedules(now = new Date()) {
    const schedules = await this.prisma.opsReportSchedule.findMany({ where: { active: true } });
    for (const schedule of schedules) {
      if (!this.isDue(schedule.frequency, now)) continue;

      const windowKey = `${schedule.id}:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
      if (this.completedWindows.has(windowKey)) continue;
      const scheduledAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4));
      const relativeRange = schedule.relativeRangeJson as unknown as { days: number };
      const dateFrom = new Date(scheduledAt);
      dateFrom.setUTCDate(dateFrom.getUTCDate() - relativeRange.days);
      const existing = await this.prisma.opsReportDefinition.findFirst({
        where: {
          reportType: schedule.reportType,
          title: schedule.titleTemplate,
          dateFrom,
          dateTo: scheduledAt,
          trigger: "SCHEDULED",
        },
      });
      if (existing) {
        this.completedWindows.add(windowKey);
        continue;
      }
      await this.reports.generateFromSchedule(schedule, scheduledAt);
      this.completedWindows.add(windowKey);
    }
  }

  private isDue(frequency: "WEEKLY" | "MONTHLY", now: Date) {
    if (now.getUTCHours() !== 4) return false;
    return frequency === "WEEKLY" ? now.getUTCDay() === 0 : now.getUTCDate() === 1;
  }
}

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
      await this.reports.generateFromSchedule(schedule, now);
      this.completedWindows.add(windowKey);
    }
  }

  private isDue(frequency: "WEEKLY" | "MONTHLY", now: Date) {
    if (now.getUTCHours() !== 4) return false;
    return frequency === "WEEKLY" ? now.getUTCDay() === 0 : now.getUTCDate() === 1;
  }
}

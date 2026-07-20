import assert from "node:assert/strict";
import test from "node:test";

import { OpsReportSchedulerService } from "./ops-report-scheduler.service";

test("executeDueSchedules generates official reports for active weekly schedules", async () => {
  let called = 0;
  const prisma = {
    opsReportSchedule: {
      findMany: async () => [{
        id: "schedule-1",
        reportType: "MONITORING",
        frequency: "WEEKLY",
        filtersJson: {},
        relativeRangeJson: { days: 7 },
        active: true,
      }],
    },
  };
  const reports = { generateFromSchedule: async () => { called += 1; } };
  const service = new OpsReportSchedulerService(prisma as any, reports as any);

  await service.executeDueSchedules(new Date("2026-07-19T04:00:00.000Z"));

  assert.equal(called, 1);
});

test("executeDueSchedules skips schedules outside their due window and deduplicates a window", async () => {
  let called = 0;
  const prisma = {
    opsReportSchedule: {
      findMany: async () => [{
        id: "schedule-1",
        reportType: "MONITORING",
        frequency: "WEEKLY",
        filtersJson: {},
        relativeRangeJson: { days: 7 },
        active: true,
      }],
    },
  };
  const service = new OpsReportSchedulerService(prisma as any, {
    generateFromSchedule: async () => { called += 1; },
  } as any);

  await service.executeDueSchedules(new Date("2026-07-20T04:00:00.000Z"));
  await service.executeDueSchedules(new Date("2026-07-19T04:00:00.000Z"));
  await service.executeDueSchedules(new Date("2026-07-19T04:00:30.000Z"));

  assert.equal(called, 1);
});

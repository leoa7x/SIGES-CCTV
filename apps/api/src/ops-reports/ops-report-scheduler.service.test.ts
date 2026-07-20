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
        titleTemplate: "Monitoreo semanal",
        filtersJson: {},
        relativeRangeJson: { days: 7 },
        active: true,
      }],
    },
    opsReportDefinition: { findFirst: async () => null },
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
        titleTemplate: "Monitoreo semanal",
        filtersJson: {},
        relativeRangeJson: { days: 7 },
        active: true,
      }],
    },
    opsReportDefinition: { findFirst: async () => null },
  };
  const service = new OpsReportSchedulerService(prisma as any, {
    generateFromSchedule: async () => { called += 1; },
  } as any);

  await service.executeDueSchedules(new Date("2026-07-20T04:00:00.000Z"));
  await service.executeDueSchedules(new Date("2026-07-19T04:00:00.000Z"));
  await service.executeDueSchedules(new Date("2026-07-19T04:00:30.000Z"));

  assert.equal(called, 1);
});

test("executeDueSchedules skips a report already persisted for the scheduled window", async () => {
  let called = 0;
  let queriedWhere: unknown;
  const prisma = {
    opsReportSchedule: {
      findMany: async () => [{
        id: "schedule-1",
        reportType: "MONITORING",
        frequency: "WEEKLY",
        titleTemplate: "Monitoreo semanal",
        filtersJson: {},
        relativeRangeJson: { days: 7 },
        active: true,
      }],
    },
    opsReportDefinition: {
      findFirst: async ({ where }: any) => {
        queriedWhere = where;
        return { id: "existing-report" };
      },
    },
  };
  const service = new OpsReportSchedulerService(prisma as any, {
    generateFromSchedule: async () => { called += 1; },
  } as any);

  await service.executeDueSchedules(new Date("2026-07-19T04:00:30.000Z"));

  assert.equal(called, 0);
  assert.deepEqual(queriedWhere, {
    reportType: "MONITORING",
    title: "Monitoreo semanal",
    dateFrom: new Date("2026-07-12T04:00:00.000Z"),
    dateTo: new Date("2026-07-19T04:00:00.000Z"),
    trigger: "SCHEDULED",
  });
});

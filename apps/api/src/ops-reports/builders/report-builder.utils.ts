import { OpsReportFilters } from "../ops-reports.types";

export function dateRange(filters: OpsReportFilters) {
  return {
    gte: new Date(`${filters.dateFrom}T00:00:00.000Z`),
    lte: new Date(`${filters.dateTo}T23:59:59.999Z`),
  };
}

export function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  return items.reduce((counts, item) => {
    const label = key(item);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

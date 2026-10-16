import type { CustomMetricResult } from "./custom-kpi";
import type { ExportColumn } from "./export-xlsx";

export function ticketResults(metrics: CustomMetricResult[]) {
  const tickets = metrics.filter(metric => /билет/iu.test(metric.name));
  const target = tickets.reduce((sum, metric) => sum + metric.target, 0);
  return {
    tickets: tickets.length ? tickets.reduce((sum, metric) => sum + metric.actual, 0) : null,
    ticketsPct: target > 0
      ? Math.round(tickets.reduce((sum, metric) => sum + metric.credited, 0) / target * 10000) / 100
      : null,
  };
}

export const CUSTOM_KPI_COLUMNS: ExportColumn[] = [
  { header: "Сотрудник", key: "employee", width: 26 },
  { header: "Показатель", key: "indicator", width: 26 },
  { header: "Факт", key: "actual", width: 10 },
  { header: "Норма", key: "target", width: 10 },
  { header: "Недобор по дням", key: "shortfall", width: 18 },
  { header: "Выполнение, %", key: "score", width: 16, numFmt: '0.##"%"' },
  { header: "Вес, %", key: "weight", width: 10 },
  { header: "Баллы KPI", key: "points", width: 14, numFmt: "0.##" },
  { header: "Потеря баллов KPI", key: "lostPoints", width: 18, numFmt: "0.##" },
  { header: "Дней без ввода", key: "missingDays", width: 16 },
];

export function customKpiRows(employee: string, metrics: CustomMetricResult[]) {
  return metrics.map(m => ({
    employee, indicator: m.name, actual: m.actual, target: m.target,
    shortfall: m.shortfall, score: Math.round((m.score ?? 0) * 100) / 100,
    weight: m.weight, points: Math.round((m.score ?? 0) * m.weight) / 100,
    lostPoints: Math.round((100 - (m.score ?? 0)) * m.weight) / 100,
    missingDays: m.missingDays,
  }));
}
export type CustomKpiReportRow = ReturnType<typeof customKpiRows>[number];

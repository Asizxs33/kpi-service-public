import { assessDailyTarget, businessDate, isValidDate } from "./daily-target";

export type CustomMetric = {
  id: string;
  name: string;
  dailyTarget: number;
  weight: number;
  departments: string[];
  startsOn: string;
  endsOn: string | null;
};
export type CustomMetricEntry = { metricId: string; employeeId: string; date: string; amount: number };

export function validateMetric(metric: CustomMetric) {
  if (!metric.name.trim() || metric.name.length > 100) throw new Error("Название: от 1 до 100 символов");
  if (!Number.isSafeInteger(metric.dailyTarget) || metric.dailyTarget < 1 || metric.dailyTarget > 100000) throw new Error("Дневная норма: целое число от 1 до 100 000");
  if (!Number.isSafeInteger(metric.weight) || metric.weight < 1 || metric.weight > 100) throw new Error("Вес: целое число от 1 до 100%");
  if (!Array.isArray(metric.departments) || !metric.departments.length || metric.departments.some(d => typeof d !== "string" || !d.trim())) throw new Error("Выберите хотя бы один отдел");
  if (!isValidDate(metric.startsOn) || (metric.endsOn !== null && (!isValidDate(metric.endsOn) || metric.endsOn < metric.startsOn))) throw new Error("Проверьте даты действия показателя");
}

// A report can span several non-overlapping rules. Reserve all weights that
// might appear together, so even such reports never exceed the personal budget.
export function validateMetricBudget(metrics: CustomMetric[], personalWeight: number) {
  for (const department of new Set(metrics.flatMap(m => m.departments))) {
    const total = metrics.filter(m => m.departments.includes(department)).reduce((sum, m) => sum + m.weight, 0);
    if (total > personalWeight) throw new Error(`${department}: веса дополнительных показателей (${total}%) превышают долю личного результата (${personalWeight}%)`);
  }
}

export function assessCustomMetrics(
  employee: { id: string; department: string; hireDate?: string | null },
  metrics: CustomMetric[], entries: CustomMetricEntry[], daysOff: string[],
  range?: { from: string; to: string }, today = businessDate(),
) {
  return metrics.filter(m => m.departments.includes(employee.department)).map(metric => ({
    ...metric,
    ...assessDailyTarget({
      from: range?.from ?? `${today.slice(0, 7)}-01`, to: range?.to ?? today,
      startsOn: metric.startsOn, endsOn: metric.endsOn,
      // Legacy employee forms allowed free text; only ISO hire dates are usable.
      hireDate: employee.hireDate && isValidDate(employee.hireDate) ? employee.hireDate : null,
      today, dailyTarget: metric.dailyTarget, daysOff,
      entries: entries.filter(e => e.metricId === metric.id && e.employeeId === employee.id),
      allowCarryover: false,
    }),
  })).filter(result => result.score !== null);
}

export type CustomMetricResult = ReturnType<typeof assessCustomMetrics>[number];

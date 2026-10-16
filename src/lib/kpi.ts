import type { Employee, LogEntry, Settings } from "@/generated/prisma/client";
import { assessCustomMetrics, type CustomMetric, type CustomMetricEntry, type CustomMetricResult } from "./custom-kpi";

export const WEIGHTS_META = [
  { key: "base", label: "Оклад", color: "bg-primary-container" },
  { key: "discipline", label: "Дисциплина", color: "bg-secondary" },
  { key: "personal", label: "Личный результат", color: "bg-tertiary-fixed-dim" },
  { key: "upsell", label: "Допродажи", color: "bg-inverse-primary" },
  { key: "quality", label: "Качество работы", color: "bg-error-container" },
] as const;

export const DEFAULT_WEIGHTS = { base: 35, discipline: 15, personal: 30, upsell: 10, quality: 10 };

export type Weights = { base: number; discipline: number; personal: number; upsell: number; quality: number };

export function weightsTotal(w: Weights) {
  return w.base + w.discipline + w.personal + w.upsell + w.quality;
}

export function weightsList(settings: Settings | Weights) {
  return WEIGHTS_META.map((m) => ({ ...m, weight: settings[m.key as keyof Weights] }));
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type KpiResult = {
  base: number;
  discipline: number;
  personal: number;
  upsell: number;
  quality: number;
  total: number;
  custom: CustomMetricResult[];
  personalSalesWeight: number;
  // % выполнения дневной нормы (2 отзыва / 2 отправки на 2 этаж в день ×
  // рабочие дни периода) — раздельно, не усреднённые в quality.
  reviewsPct: number;
  referralsPct: number;
  raw: {
    totalSales: number;
    totalServed: number;
    totalUpsold: number;
    reviewsCount: number;
    complaintsCount: number;
    referralsCount: number;
    violationsCount: number;
    reviewsTarget: number;
    referralsTarget: number;
  };
};

export type DateRange = { from: string; to: string };

// Месяц, за который берётся план продаж при расчёте KPI — месяц начала
// выбранного диапазона дат, либо текущий календарный месяц по умолчанию.
export function planMonthKey(range?: DateRange) {
  return range ? range.from.slice(0, 7) : currentMonthKey();
}

type PlanRow = { monthKey: string; employeeId: string | null; department: string | null; amount: number };

// План не задан на конкретный месяц явно => 0 (не наследуется с прошлых
// месяцев) — так видно, что план ещё не настроен.
export function findPlanAmount(plans: PlanRow[], monthKey: string, target: { employeeId?: string; department?: string }): number {
  const row = plans.find((p) => p.monthKey === monthKey && (target.employeeId ? p.employeeId === target.employeeId : p.department === target.department));
  return row?.amount ?? 0;
}

export function daysInRangeInclusive(range: DateRange) {
  const from = new Date(range.from);
  const to = new Date(range.to);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// Выбранный период — это ровно весь календарный месяц (1-е число по
// последний день месяца), а не произвольный/однодневный диапазон внутри
// него. В этом случае план для сравнения («Отклонение»/«% плана») должен
// быть планом на весь месяц, а не дневным — см. isFullMonthRange ниже.
export function isFullMonthRange(range: DateRange | undefined, monthKey: string): boolean {
  if (!range) return true;
  if (range.from.slice(0, 7) !== monthKey || range.to.slice(0, 7) !== monthKey) return false;
  return range.from.slice(8, 10) === "01" && Number(range.to.slice(8, 10)) === daysInMonth(monthKey);
}

// Дневной план (план на ОДИН рабочий день) — план на месяц делённый на
// (календарные дни месяца минус фиксированная квота выходных, см.
// STANDARD_DAYS_OFF_ALLOWANCE ниже), без умножения на число прошедших
// дней. Используется в экспорте с Дашборда для «Отклонение» — по явному
// запросу сравнивается с дневным планом на 1 день, а не с планом на
// весь месяц целиком и не пересчитывается под число дней в периоде.
export function dailyPlanAmount(monthlyPlan: number, monthKey: string): number {
  const divisor = Math.max(1, daysInMonth(monthKey) - STANDARD_DAYS_OFF_ALLOWANCE);
  return Math.round(monthlyPlan / divisor);
}

// Норма — 2 отзыва и 2 отправки на 2 этаж на КАЖДОГО сотрудника КАЖДЫЙ
// рабочий день (не настраивается по сотруднику — единое правило для всех).
export const DAILY_MIN_REVIEWS = 2;
export const DAILY_MIN_REFERRALS = 2;

// Фиксированная «квота» выходных в месяц — не зависит от того, сколько
// выходных реально отмечено сотруднику (это отдельно видно в экспорте),
// рабочие дни = календарные дни месяца минус эта квота, всегда одинаково
// у всех. Используется и для нормы отзывов/2 этажа, и для дневного плана
// (dailyPlanAmount ниже).
const STANDARD_DAYS_OFF_ALLOWANCE = 4;

// Сколько рабочих дней приходится на выбранный период — основа для нормы
// отзывов/2 этажа (норма = рабочие_дни × 2). При заданном диапазоне дат —
// число дней диапазона за вычетом выходных сотрудника в этом диапазоне
// (если смотрим один конкретный день и он был выходным — норму на него
// не начисляем). Без диапазона (текущий месяц целиком) — календарные дни
// текущего месяца минус фиксированная квота выходных (не факт по
// сотруднику) — например, август (31 день) даёт 31-4=27 рабочих дней,
// февраль (28 дней) — 28-4=24, у всех сотрудников поровну.
export function workingDaysForPeriod(range: DateRange | undefined, daysOffDates: string[]): number {
  if (range) {
    const offInRange = daysOffDates.filter((d) => d >= range.from && d <= range.to).length;
    return Math.max(0, daysInRangeInclusive(range) - offInRange);
  }
  return Math.max(0, daysInMonth(currentMonthKey()) - STANDARD_DAYS_OFF_ALLOWANCE);
}

/**
 * Считает KPI% сотрудника на основе введённых журналов + целей сотрудника +
 * весов из настроек. По умолчанию — за текущий календарный месяц; передай
 * `range` ({from, to}, включительно, формат YYYY-MM-DD), чтобы посчитать за
 * произвольный период (например, выбранный диапазон дат на Дашборде).
 * Логика — 1:1 порт из store.js (клиентского прототипа), теперь работает на
 * реальных данных БД.
 */
export function computeKpi(employee: Employee, logs: LogEntry[], weights: Weights, salesTarget: number, range?: DateRange, daysOffDates: string[] = [], customData?: { metrics: CustomMetric[]; entries: CustomMetricEntry[]; today?: string }): KpiResult {
  const monthKey = currentMonthKey();
  const monthLogs = logs.filter((l) => {
    if (l.employeeId !== employee.id) return false;
    return range ? l.date >= range.from && l.date <= range.to : l.date.slice(0, 7) === monthKey;
  });

  const upsellLogs = monthLogs.filter((l) => l.type === "UPSELL");
  const complaintLogs = monthLogs.filter((l) => l.type === "COMPLAINT");
  const disciplineLogs = monthLogs.filter((l) => l.type === "DISCIPLINE");
  const referralLogs = monthLogs.filter((l) => l.type === "REFERRAL");

  const totalSales = upsellLogs.reduce((s, l) => s + (l.salesAmount || 0), 0);
  const totalServed = upsellLogs.reduce((s, l) => s + (l.customersServed || 0), 0);
  const totalUpsold = upsellLogs.reduce((s, l) => s + (l.successfulUpsells || 0), 0);
  // «Допродажи» считаются по «Полному обслуживанию» (fullServiceCount —
  // галочки на каждого обслуженного клиента, реально ведутся ежедневно),
  // а не по successfulUpsells — то поле заполняется только вручную и
  // почти всегда пустое (продажи приходят автосинхронизацией из UMAG,
  // которая его не трогает), из-за чего этот компонент KPI был у всех
  // почти всегда 0 независимо от реальной работы.
  const totalFullService = upsellLogs.reduce((s, l) => s + (l.fullServiceCount || 0), 0);
  const reviewsCount = complaintLogs.filter((l) => l.kind === "REVIEW").reduce((s, l) => s + (l.count || 1), 0);
  const complaintsCount = complaintLogs.filter((l) => l.kind === "COMPLAINT").length;
  const referralsCount = referralLogs.reduce((s, l) => s + (l.count || 0), 0);
  const violationsCount = disciplineLogs.length;

  // Норма 2 отзыва / 2 отправки на 2 этаж в день действует только в
  // Розница (розничный зал 1 этажа) — у колл-центра нет ни отзывов в этом
  // смысле, ни физического «2 этажа», у Детский отдел сотрудники сами и есть
  // «2 этаж». Для остальных отделов цель = 0 → скор не проседает.
  const appliesReviewsNorm = employee.department === "Розница";
  const workingDays = appliesReviewsNorm ? workingDaysForPeriod(range, daysOffDates) : 0;
  const reviewsTarget = workingDays * DAILY_MIN_REVIEWS;
  const referralsTarget = workingDays * DAILY_MIN_REFERRALS;

  const baseScore = 100;
  const disciplineScore = clamp(100 - violationsCount * 25, 0, 100);
  const personalScore = salesTarget > 0 ? clamp((totalSales / salesTarget) * 100, 0, 100) : 0;
  const upsellScore = totalServed > 0 ? clamp((totalFullService / totalServed) * 100, 0, 100) : 0;
  const reviewsScore = reviewsTarget > 0 ? clamp((reviewsCount / reviewsTarget) * 100, 0, 100) : 100;
  const referralScore = referralsTarget > 0 ? clamp((referralsCount / referralsTarget) * 100, 0, 100) : 100;
  const qualityScore = clamp((reviewsScore + referralScore) / 2 - complaintsCount * 10, 0, 100);

  const weightSum = weightsTotal(weights) || 100;
  const custom = customData ? assessCustomMetrics(employee, customData.metrics, customData.entries, daysOffDates, range, customData.today) : [];
  const personalSalesWeight = weights.personal - custom.reduce((sum, metric) => sum + metric.weight, 0);
  const total =
    (baseScore * weights.base +
      disciplineScore * weights.discipline +
      personalScore * personalSalesWeight +
      custom.reduce((sum, metric) => sum + (metric.score ?? 0) * metric.weight, 0) +
      upsellScore * weights.upsell +
      qualityScore * weights.quality) /
    weightSum;

  return {
    custom,
    personalSalesWeight,
    base: Math.round(baseScore),
    discipline: Math.round(disciplineScore),
    personal: Math.round(personalScore),
    upsell: Math.round(upsellScore),
    quality: Math.round(qualityScore),
    total: Math.round(clamp(total, 0, 100)),
    reviewsPct: Math.round(reviewsScore),
    referralsPct: Math.round(referralScore),
    raw: { totalSales, totalServed, totalUpsold, reviewsCount, complaintsCount, referralsCount, violationsCount, reviewsTarget, referralsTarget },
  };
}

export function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

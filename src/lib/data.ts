import { prisma } from "@/lib/prisma";
import { DEFAULT_WEIGHTS } from "@/lib/kpi";

export async function getSettings() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (settings) return settings;
  return prisma.settings.create({ data: { id: "singleton", ...DEFAULT_WEIGHTS } });
}

export function getEmployees() {
  return prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
}

export function getEmployeeById(id: string) {
  return prisma.employee.findUnique({ where: { id } });
}

// Вторичный ключ сортировки (createdAt) обязателен: у большинства записей
// одна и та же date, а без tie-breaker'а Postgres не гарантирует стабильный
// порядок строк с равным date — после любого UPDATE (например, клика по
// «Полное обслуживание») строка может физически переместиться, и список
// визуально "перемешивается", хотя ничего не удалялось/не добавлялось.
export function getAllLogs() {
  return prisma.logEntry.findMany({ orderBy: [{ date: "desc" }, { createdAt: "asc" }] });
}

export function getLogsForEmployee(employeeId: string, type?: "UPSELL" | "COMPLAINT" | "DISCIPLINE" | "REFERRAL") {
  return prisma.logEntry.findMany({
    where: { employeeId, ...(type ? { type } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "asc" }],
  });
}

export function getStoreDailyRevenue() {
  return prisma.storeDailyRevenue.findMany({ orderBy: { date: "desc" } });
}

export function getMonthlyPlans() {
  return prisma.monthlyPlan.findMany({ orderBy: { monthKey: "desc" } });
}

export function getDaysOff() {
  return prisma.dayOff.findMany({ orderBy: { date: "asc" } });
}

export function getDaysOffForEmployee(employeeId: string) {
  return prisma.dayOff.findMany({ where: { employeeId }, orderBy: { date: "asc" } });
}

export function getStoreDailyDebt() {
  return prisma.storeDailyDebt.findMany({ orderBy: { date: "desc" } });
}

export function getCustomMetrics() {
  return prisma.kpiMetric.findMany({ orderBy: { createdAt: "asc" } });
}

export function getCustomMetricEntries() {
  return prisma.kpiMetricEntry.findMany({ orderBy: { date: "desc" } });
}

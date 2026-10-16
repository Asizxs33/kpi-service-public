"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, departmentScope, requireEditableLogDate } from "@/lib/require-auth";
import { businessDate, isValidDate } from "@/lib/daily-target";

export async function saveMetricEntries(metricId: string, date: string, entries: { employeeId: string; amount: number }[]) {
  const session = await requireAuth();
  if (!isValidDate(date) || date > businessDate()) throw new Error("Укажите корректную дату не позднее сегодняшнего дня");
  await requireEditableLogDate(date);
  if (!Array.isArray(entries) || !entries.length || entries.length > 500) throw new Error("Выберите от 1 до 500 сотрудников");
  if (new Set(entries.map(e => e.employeeId)).size !== entries.length) throw new Error("Сотрудники не должны повторяться");
  if (entries.some(e => !Number.isSafeInteger(e.amount) || e.amount < 0 || e.amount > 1000000)) throw new Error("Факт: целое число от 0 до 1 000 000");
  const scope = departmentScope(session);
  await prisma.$transaction(async tx => {
    const metric = await tx.kpiMetric.findUniqueOrThrow({ where: { id: metricId } });
    if (date < metric.startsOn || (metric.endsOn && date > metric.endsOn)) throw new Error("На эту дату показатель не действует");
    const employees = await tx.employee.findMany({ where: { id: { in: entries.map(e => e.employeeId) } } });
    if (employees.length !== entries.length || employees.some(e => !e.active || !metric.departments.includes(e.department) || (scope && !scope.includes(e.department)))) throw new Error("Нет доступа к одному из сотрудников или показатель к нему не относится");
    if (employees.some(e => e.hireDate && isValidDate(e.hireDate) && date < e.hireDate)) throw new Error("Нельзя вводить факт до даты найма");
    if (await tx.dayOff.count({ where: { employeeId: { in: entries.map(e => e.employeeId) }, date } })) throw new Error("У сотрудника отмечен выходной. Проверьте график перед вводом факта.");
    for (const entry of entries) {
      const where = { metricId_employeeId_date: { metricId, employeeId: entry.employeeId, date } };
      const before = await tx.kpiMetricEntry.findUnique({ where });
      if (before?.amount === entry.amount) continue;
      const saved = await tx.kpiMetricEntry.upsert({ where, create: { metricId, employeeId: entry.employeeId, date, amount: entry.amount }, update: { amount: entry.amount } });
      await tx.auditLog.create({ data: {
        logEntryId: `metric-entry:${saved.id}`, action: before ? "UPDATE" : "CREATE",
        userId: session.user?.id, userName: session.user?.name ?? "Пользователь",
        before: before ? { count: before.amount } : undefined,
        after: { count: entry.amount, date, employeeId: entry.employeeId, indicator: metric.name },
      } });
    }
  }, { isolationLevel: "Serializable", timeout: 30000 });
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees/[id]", "page");
}

export async function getMetricEntryHistory(entryId: string) {
  const session = await requireAuth();
  const entry = await prisma.kpiMetricEntry.findUniqueOrThrow({ where: { id: entryId }, include: { employee: { select: { department: true } } } });
  const scope = departmentScope(session);
  if (scope && !scope.includes(entry.employee.department)) throw new Error("Нет доступа к этому отделу");
  return prisma.auditLog.findMany({ where: { logEntryId: `metric-entry:${entryId}` }, orderBy: { createdAt: "desc" } });
}

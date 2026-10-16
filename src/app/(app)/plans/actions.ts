"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDepartmentAccess } from "@/lib/require-auth";

export async function setEmployeePlan(monthKey: string, employeeId: string, amount: number) {
  if (amount < 0) throw new Error("План не может быть отрицательным");
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { department: true } });
  await requireDepartmentAccess(employee.department);
  await prisma.monthlyPlan.upsert({
    where: { monthKey_employeeId: { monthKey, employeeId } },
    update: { amount },
    create: { monthKey, employeeId, amount },
  });
  revalidatePath("/plans");
  revalidatePath("/dashboard");
  revalidatePath(`/employees/${employeeId}`);
}

export async function setDepartmentPlan(monthKey: string, department: string, amount: number) {
  if (amount < 0) throw new Error("План не может быть отрицательным");
  await requireDepartmentAccess(department);
  await prisma.monthlyPlan.upsert({
    where: { monthKey_department: { monthKey, department } },
    update: { amount },
    create: { monthKey, department, amount },
  });
  revalidatePath("/plans");
  revalidatePath("/dashboard");
}

// ADMIN — любой сотрудник; ROP — только сотрудники своего отдела. Отметка
// выходного дня влияет на норму отзывов/2 этажа для выбранного периода
// (см. workingDaysForPeriod в lib/kpi.ts) — план продаж (Дашборд/Планы)
// от выходных не зависит, всегда полный месячный.
export async function toggleDayOff(employeeId: string, date: string) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { department: true } });
  await requireDepartmentAccess(employee.department);
  const existing = await prisma.dayOff.findUnique({ where: { employeeId_date: { employeeId, date } } });
  if (existing) {
    await prisma.dayOff.delete({ where: { id: existing.id } });
  } else {
    await prisma.dayOff.create({ data: { employeeId, date } });
  }
  revalidatePath("/plans");
  revalidatePath("/dashboard");
}

// Быстрая массовая отметка: вместо кликов по каждому дню в календаре —
// просто число выходных за месяц. Заменяет весь набор выходных этого
// сотрудника на последние `count` дней месяца (даты неважны для самого
// количества — workingDaysForPeriod считает только их число; кому нужны
// конкретные даты — может донастроить через календарь).
export async function setDaysOffCount(employeeId: string, monthKey: string, count: number) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { department: true } });
  await requireDepartmentAccess(employee.department);

  const [y, m] = monthKey.split("-").map(Number);
  const totalDays = new Date(y, m, 0).getDate();
  const clamped = Math.max(0, Math.min(count, totalDays));

  const targetDates = Array.from({ length: clamped }, (_, i) => {
    const day = totalDays - i;
    return `${monthKey}-${String(day).padStart(2, "0")}`;
  });

  await prisma.$transaction([
    prisma.dayOff.deleteMany({ where: { employeeId, date: { startsWith: monthKey } } }),
    ...(targetDates.length ? [prisma.dayOff.createMany({ data: targetDates.map((date) => ({ employeeId, date })) })] : []),
  ]);

  revalidatePath("/plans");
  revalidatePath("/dashboard");
}

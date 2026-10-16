"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireDepartmentAccess, requireEditableLogDate } from "@/lib/require-auth";
import { writeAudit, getLogAudit } from "@/lib/audit";
import { notifyComplaintAlert } from "@/lib/telegram";
import type { ComplaintKind, LogType } from "@/generated/prisma/client";

export type LogInput = {
  type: LogType;
  date: string;
  employeeId: string;
  notes?: string;
  salesAmount?: number;
  customersServed?: number;
  successfulUpsells?: number;
  sevenSteps?: boolean;
  fullServiceCount?: number;
  kind?: ComplaintKind;
  violationType?: string;
  fine?: number;
  count?: number;
};

export async function addLog(data: LogInput) {
  if (!data.employeeId || !data.date) throw new Error("Дата и сотрудник обязательны");
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: data.employeeId }, select: { department: true, fullName: true } });
  const session = await requireDepartmentAccess(employee.department);
  await requireEditableLogDate(data.date);
  const created = await prisma.logEntry.create({ data });
  await writeAudit(session, { logEntryId: created.id, action: "CREATE", after: data });
  if (data.type === "COMPLAINT" && data.kind === "COMPLAINT") {
    await notifyComplaintAlert(employee.fullName, data.date, data.notes ?? null);
  }
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function updateLog(id: string, data: LogInput) {
  if (!data.employeeId || !data.date) throw new Error("Дата и сотрудник обязательны");
  const before = await prisma.logEntry.findUniqueOrThrow({ where: { id }, include: { employee: { select: { department: true, fullName: true } } } });
  const session = await requireDepartmentAccess(before.employee.department);
  // При смене сотрудника проверяем доступ и к новому отделу.
  let newEmployeeName: string | null = null;
  if (data.employeeId !== before.employeeId) {
    const newEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: data.employeeId }, select: { department: true, fullName: true } });
    await requireDepartmentAccess(newEmployee.department);
    newEmployeeName = newEmployee.fullName;
  }
  // Проверяем и старую, и новую дату — нельзя ни редактировать старую
  // запись задним числом, ни переносить её на запретную дату.
  await requireEditableLogDate(before.date);
  await requireEditableLogDate(data.date);
  await prisma.logEntry.update({ where: { id }, data });
  await writeAudit(session, { logEntryId: id, action: "UPDATE", before: toAuditSnapshot(before), after: data });
  // Алерт только при переходе В жалобу (не было жалобой до правки) —
  // чтобы обычное редактирование уже существующей жалобы не спамило.
  const wasComplaint = before.type === "COMPLAINT" && before.kind === "COMPLAINT";
  const isComplaint = data.type === "COMPLAINT" && data.kind === "COMPLAINT";
  if (isComplaint && !wasComplaint) {
    await notifyComplaintAlert(newEmployeeName ?? before.employee.fullName, data.date, data.notes ?? null);
  }
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function removeLog(id: string) {
  const before = await prisma.logEntry.findUniqueOrThrow({ where: { id }, include: { employee: { select: { department: true } } } });
  const session = await requireDepartmentAccess(before.employee.department);
  await requireEditableLogDate(before.date);
  await prisma.logEntry.delete({ where: { id } });
  await writeAudit(session, { logEntryId: id, action: "DELETE", before: toAuditSnapshot(before) });
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function toggleLogField(id: string, field: "sevenSteps", next: boolean) {
  const before = await prisma.logEntry.findUniqueOrThrow({ where: { id }, include: { employee: { select: { department: true } } } });
  const session = await requireDepartmentAccess(before.employee.department);
  await requireEditableLogDate(before.date);
  await prisma.logEntry.update({ where: { id }, data: { [field]: next } });
  await writeAudit(session, { logEntryId: id, action: "UPDATE", before: { [field]: before[field] }, after: { [field]: next } });
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function setFullServiceCount(id: string, count: number) {
  const before = await prisma.logEntry.findUniqueOrThrow({ where: { id }, include: { employee: { select: { department: true } } } });
  const session = await requireDepartmentAccess(before.employee.department);
  await requireEditableLogDate(before.date);
  await prisma.logEntry.update({ where: { id }, data: { fullServiceCount: count } });
  await writeAudit(session, { logEntryId: id, action: "UPDATE", before: { fullServiceCount: before.fullServiceCount }, after: { fullServiceCount: count } });
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

export async function setFullServiceReason(id: string, index: number, reason: string | null) {
  const before = await prisma.logEntry.findUniqueOrThrow({ where: { id }, include: { employee: { select: { department: true } } } });
  const session = await requireDepartmentAccess(before.employee.department);
  await requireEditableLogDate(before.date);
  const current = ((before.fullServiceReasons as Record<string, string> | null) ?? {}) as Record<string, string>;
  const previousReason = current[String(index)] ?? null;
  if (reason) {
    current[String(index)] = reason;
  } else {
    delete current[String(index)];
  }
  await prisma.logEntry.update({ where: { id }, data: { fullServiceReasons: current } });
  await writeAudit(session, {
    logEntryId: id,
    action: "UPDATE",
    before: { fullServiceReason: previousReason, index },
    after: { fullServiceReason: reason, index },
  });
  revalidatePath("/logs");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
}

// Массовый ввод за один день — вместо открытия модалки и выбора сотрудника
// по одному, экран со всеми сотрудниками сразу: по числу на каждого
// (количество отзывов / отправок на 2 этаж). Пропускает записи, которые
// не изменились, чтобы не плодить лишние строки аудита.
export async function bulkSetCounts(date: string, type: "COMPLAINT" | "REFERRAL", kind: ComplaintKind | undefined, entries: { employeeId: string; count: number }[]) {
  for (const { employeeId, count } of entries) {
    const existing = await prisma.logEntry.findFirst({ where: { employeeId, date, source: null, type } });
    if (existing) {
      const unchanged = existing.count === count && (type !== "COMPLAINT" || existing.kind === kind);
      if (unchanged) continue;
      await updateLog(existing.id, { type, date, employeeId, count, ...(type === "COMPLAINT" ? { kind } : {}) });
    } else if (count > 0) {
      await addLog({ type, date, employeeId, count, ...(type === "COMPLAINT" ? { kind } : {}) });
    }
  }
  revalidatePath("/logs");
  revalidatePath("/dashboard");
}

export async function getLogHistory(logEntryId: string) {
  await requireAuth();
  return getLogAudit(logEntryId);
}

function toAuditSnapshot(log: {
  type: LogType;
  date: string;
  employeeId: string;
  notes: string | null;
  salesAmount: number | null;
  customersServed: number | null;
  successfulUpsells: number | null;
  sevenSteps: boolean | null;
  fullServiceCount: number | null;
  fullServiceReasons: unknown;
  kind: ComplaintKind | null;
  violationType: string | null;
  fine: number | null;
  count: number | null;
}) {
  const { type, date, employeeId, notes, salesAmount, customersServed, successfulUpsells, sevenSteps, fullServiceCount, fullServiceReasons, kind, violationType, fine, count } = log;
  return { type, date, employeeId, notes, salesAmount, customersServed, successfulUpsells, sevenSteps, fullServiceCount, fullServiceReasons, kind, violationType, fine, count };
}

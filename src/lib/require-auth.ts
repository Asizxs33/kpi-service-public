import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

// null = доступ ко всем отделам (ADMIN/MANAGER); массив = пользователь
// с ролью ROP видит и редактирует только эти отделы (может быть
// несколько — например, один РОП на Розница и Детский отдел сразу).
export function departmentScope(session: Session | null): string[] | null {
  if (session?.user?.role === "ROP") return session.user.departments ?? [];
  return null;
}

// Для server actions: бросает ошибку (а не редиректит), если у текущего
// пользователя нет прав администратора — используется для операций,
// доступных только ADMIN (настройки KPI, добавление/удаление сотрудников).
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Недостаточно прав — действие доступно только администратору");
  }
  return session;
}

// Для server actions над записью, привязанной к отделу (LogEntry через
// Employee, сам Employee) — бросает ошибку, если ROP пытается изменить
// запись чужого отдела. ADMIN/MANAGER проходят без ограничений.
export async function requireDepartmentAccess(department: string) {
  const session = await requireAuth();
  const scope = departmentScope(session);
  if (scope && !scope.includes(department)) {
    throw new Error("Недостаточно прав — запись относится к другому отделу");
  }
  return session;
}

// Задним числом: ADMIN всегда может редактировать записи журналов любой
// даты. MANAGER/ROP — только если дата не старше Settings.editBackdateLimitDays
// (настраивается на странице «Доступы»); 0/не задано — ограничения нет.
export async function requireEditableLogDate(date: string) {
  const session = await requireAuth();
  if (session.user?.role === "ADMIN") return session;
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" }, select: { editBackdateLimitDays: true } });
  const limit = settings?.editBackdateLimitDays ?? 0;
  if (limit <= 0) return session;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limit);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  if (date < cutoffStr) {
    throw new Error(`Редактирование записей старше ${limit} дн. запрещено настройками доступа — обратитесь к администратору`);
  }
  return session;
}

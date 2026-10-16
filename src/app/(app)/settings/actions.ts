"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { DEFAULT_WEIGHTS, weightsTotal, type Weights } from "@/lib/kpi";
import { validateMetric, validateMetricBudget, type CustomMetric } from "@/lib/custom-kpi";

export async function saveWeights(weights: Weights, metrics: CustomMetric[]) {
  const session = await requireAdmin();
  const cleanWeights = { base: weights.base, discipline: weights.discipline, personal: weights.personal, upsell: weights.upsell, quality: weights.quality };
  if (Object.values(cleanWeights).some(w => !Number.isSafeInteger(w) || w < 0 || w > 100) || weightsTotal(cleanWeights) !== 100) {
    throw new Error("Сумма весов должна быть равна 100%");
  }
  if (!Array.isArray(metrics) || metrics.length > 100) throw new Error("Не более 100 дополнительных показателей");
  metrics.forEach(validateMetric);
  validateMetricBudget(metrics, cleanWeights.personal);
  if (new Set(metrics.map(m => m.id)).size !== metrics.length) throw new Error("Повторяющиеся показатели");
  await prisma.$transaction(async tx => {
    const existing = await tx.kpiMetric.findMany();
    if (existing.some(m => !metrics.some(next => next.id === m.id))) throw new Error("Список показателей изменился. Обновите страницу; для завершения показателя задайте дату окончания.");
    const departments = new Set((await tx.employee.findMany({ select: { department: true } })).map(e => e.department));
    for (const metric of metrics) {
      if (metric.departments.some(d => !departments.has(d))) throw new Error("Выбран неизвестный отдел");
      const before = existing.find(m => m.id === metric.id);
      const data = { name: metric.name.trim(), dailyTarget: metric.dailyTarget, weight: metric.weight, departments: [...new Set(metric.departments)], startsOn: metric.startsOn, endsOn: metric.endsOn };
      const saved = before
        ? await tx.kpiMetric.update({ where: { id: metric.id }, data })
        : await tx.kpiMetric.create({ data });
      await tx.auditLog.create({ data: {
        logEntryId: `metric:${saved.id}`, action: before ? "UPDATE" : "CREATE",
        userId: session.user?.id, userName: session.user?.name ?? "Администратор",
        before: before ? { name: before.name, dailyTarget: before.dailyTarget, weight: before.weight, departments: before.departments, startsOn: before.startsOn, endsOn: before.endsOn } : undefined,
        after: data,
      } });
    }
    await tx.settings.upsert({ where: { id: "singleton" }, update: cleanWeights, create: { id: "singleton", ...cleanWeights } });
  }, { isolationLevel: "Serializable", timeout: 30000 });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/employees/[id]", "page");
  revalidatePath("/logs");
  return prisma.kpiMetric.findMany({ orderBy: { createdAt: "asc" } });
}

export async function resetWeights() {
  await requireAdmin();
  await prisma.$transaction(async tx => {
    validateMetricBudget(await tx.kpiMetric.findMany(), DEFAULT_WEIGHTS.personal);
    await tx.settings.upsert({
      where: { id: "singleton" },
      update: DEFAULT_WEIGHTS,
      create: { id: "singleton", ...DEFAULT_WEIGHTS },
    });
  }, { isolationLevel: "Serializable" });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/employees");
  revalidatePath("/employees/[id]", "page");
}

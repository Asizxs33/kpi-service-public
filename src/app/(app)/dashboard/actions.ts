"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-auth";

// Кнопка «Полная синхронизация» на Дашборде — дёргает POST /sync у бота
// (Render, тот же процесс, что и ежедневная авто-синхронизация в
// bot.py) за один конкретный день: бот подтягивает из UMAG продажи
// сотрудников, выручку точки (как в «Прибыль/убытки»), долги и платежи.
// Период кнопка обходит по дням сама. Без даты — сегодня. Требует
// BOT_SYNC_URL и BOT_SYNC_SECRET (переменные окружения Vercel) — секрет
// должен совпадать с SYNC_API_SECRET на стороне бота.
export async function triggerSync(date?: string): Promise<{ ok: true; synced: number } | { ok: false; error: string }> {
  await requireAuth();

  const baseUrl = process.env.BOT_SYNC_URL;
  const secret = process.env.BOT_SYNC_SECRET;
  if (!baseUrl || !secret) {
    return { ok: false, error: "Синхронизация с ботом не настроена (нет BOT_SYNC_URL/BOT_SYNC_SECRET)" };
  }
  if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Некорректная дата" };
  }
  const url = new URL(baseUrl);
  if (date) url.searchParams.set("date", date);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "X-Sync-Secret": secret },
      // У бота логин в UMAG + обход всех сотрудников может занять
      // десятки секунд — таймаут Vercel-функции длиннее дефолтного fetch.
      signal: AbortSignal.timeout(55_000),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error ?? `Бот ответил ${res.status}` };
    }
    revalidatePath("/dashboard");
    revalidatePath("/logs");
    revalidatePath("/plans");
    revalidatePath("/employees/[id]", "page");
    return { ok: true, synced: Array.isArray(data.synced) ? data.synced.length : 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось связаться с ботом" };
  }
}

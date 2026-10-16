"use client";

import Icon from "@/components/Icon";

import { useState, useTransition } from "react";
import { triggerSync } from "./actions";

const MAX_DAYS = 62;

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end && out.length <= MAX_DAYS) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const ruDate = (iso: string) => iso.split("-").reverse().join(".");

// «Полная синхронизация» за выбранный период: бот по одному дню подтягивает
// из UMAG продажи сотрудников, выручку точки (как в «Прибыль/убытки», без
// возвратов), долги по контрагентам и платежи для кассового сайта. Дни идут
// по очереди — один запрос к боту на день укладывается в лимит Vercel.
export default function SyncButton({ from, to }: { from: string; to: string }) {
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function handleClick() {
    const days = daysBetween(from, to);
    if (days.length > MAX_DAYS) {
      setMessage({ text: `Период длиннее ${MAX_DAYS} дней: выберите короче`, error: true });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      let done = 0;
      for (const day of days) {
        setProgress(`${ruDate(day)} · ${done + 1} из ${days.length}`);
        const result = await triggerSync(day);
        if (!result.ok) {
          setProgress(null);
          setMessage({ text: `${ruDate(day)}: ${result.error}. Готово дней: ${done} из ${days.length}`, error: true });
          return;
        }
        done += 1;
      }
      setProgress(null);
      setMessage({ text: `Синхронизировано дней: ${done} (${ruDate(days[0])} – ${ruDate(days[days.length - 1])})`, error: false });
      setTimeout(() => setMessage(null), 8000);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={pending}
        title={`Полная синхронизация с UMAG за период ${ruDate(from)} – ${ruDate(to)}: продажи, выручка, долги, платежи`}
        className="h-9 px-3 md:px-4 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-surface-container-low flex items-center gap-2 disabled:opacity-60"
      >
        <Icon name="sync" className={`text-[18px] ${pending ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">{pending ? `Синхронизация… ${progress ?? ""}` : "Полная синхронизация"}</span>
      </button>
      {message && (
        <div
          className={`absolute right-0 top-full mt-1 z-10 max-w-[320px] px-3 py-2 rounded-lg text-xs font-medium shadow-lg ${
            message.error ? "bg-error-container text-error" : "bg-[#2EA84A]/10 text-[#2EA84A]"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}

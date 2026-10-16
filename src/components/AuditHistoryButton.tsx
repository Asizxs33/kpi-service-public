"use client";

import Icon from "@/components/Icon";


import { useState, useTransition } from "react";
import { getLogHistory } from "@/app/(app)/logs/actions";
import { getMetricEntryHistory } from "@/app/(app)/logs/metric-actions";

const ACTION_LABEL: Record<string, { label: string; cls: string }> = {
  CREATE: { label: "Создано", cls: "bg-green-100 text-green-800" },
  UPDATE: { label: "Изменено", cls: "bg-amber-100 text-amber-800" },
  DELETE: { label: "Удалено", cls: "bg-red-100 text-red-800" },
};

const FIELD_LABEL: Record<string, string> = {
  type: "Тип",
  date: "Дата",
  employeeId: "Сотрудник",
  notes: "Заметки",
  salesAmount: "Продажи, ₸",
  customersServed: "Обслужено",
  successfulUpsells: "Допродано",
  sevenSteps: "7 шагов",
  fullServiceCount: "Полное обслуживание",
  fullServiceReasons: "Причины отклонений",
  fullServiceReason: "Причина отклонения",
  index: "Позиция",
  kind: "Тип записи",
  violationType: "Нарушение",
  fine: "Штраф, ₸",
  count: "Количество",
  indicator: "Показатель",
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Да" : "Нет";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null): { key: string; from: unknown; to: unknown }[] {
  const keys = new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]);
  const out: { key: string; from: unknown; to: unknown }[] = [];
  for (const key of keys) {
    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) out.push({ key, from, to });
  }
  return out;
}

type AuditEntry = {
  id: string;
  action: string;
  userName: string;
  before: unknown;
  after: unknown;
  createdAt: Date | string;
};

export default function AuditHistoryButton({ logEntryId, metricEntry = false }: { logEntryId: string; metricEntry?: boolean }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    startTransition(async () => {
      setError("");
      try {
        const rows = metricEntry ? await getMetricEntryHistory(logEntryId) : await getLogHistory(logEntryId);
        setEntries(rows as unknown as AuditEntry[]);
      } catch (err) { setError(err instanceof Error ? err.message : "Не удалось загрузить историю"); }
    });
  }

  return (
    <>
      <button onClick={handleOpen} className="text-on-surface-variant hover:text-primary p-1" title="История изменений">
        <Icon name="history" className="text-[18px]" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-background">История изменений</h3>
              <button onClick={() => setOpen(false)} className="p-1 text-on-surface-variant hover:text-primary">
                <Icon name="close" className="" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {error && <p role="alert" className="text-sm text-error">{error}</p>}
              {pending && !entries && <p className="text-sm text-on-surface-variant">Загрузка...</p>}
              {entries && entries.length === 0 && <p className="text-sm text-on-surface-variant">Изменений пока не было.</p>}
              {entries?.map((entry) => {
                const meta = ACTION_LABEL[entry.action] ?? { label: entry.action, cls: "bg-surface-container-high text-on-surface-variant" };
                const diffs = diffFields(entry.before as Record<string, unknown> | null, entry.after as Record<string, unknown> | null);
                return (
                  <div key={entry.id} className="border border-outline-variant rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
                      <span className="text-xs text-on-surface-variant">
                        {new Date(entry.createdAt).toLocaleString("ru-RU")} · {entry.userName}
                      </span>
                    </div>
                    {diffs.length > 0 ? (
                      <ul className="text-sm space-y-1">
                        {diffs.map((d) => (
                          <li key={d.key} className="text-on-surface-variant">
                            <span className="font-medium text-on-surface">{FIELD_LABEL[d.key] ?? d.key}:</span> {fmtValue(d.from)} → {fmtValue(d.to)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-on-surface-variant">Без изменений полей.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

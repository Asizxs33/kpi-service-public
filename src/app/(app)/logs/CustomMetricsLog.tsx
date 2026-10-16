"use client";

import { useState, useTransition } from "react";
import type { CustomMetric, CustomMetricEntry } from "@/lib/custom-kpi";
import { isValidDate } from "@/lib/daily-target";
import { saveMetricEntries } from "./metric-actions";
import { useFeedback } from "@/components/FeedbackProvider";
import AuditHistoryButton from "@/components/AuditHistoryButton";

type EmployeeRow = { id: string; fullName: string; department: string; active: boolean; hireDate: string | null };

export default function CustomMetricsLog({ metrics, entries, employees, daysOff, today }: {
  metrics: CustomMetric[]; entries: (CustomMetricEntry & { id: string })[]; employees: EmployeeRow[];
  daysOff: Record<string, string[]>; today: string;
}) {
  const [metricId, setMetricId] = useState(metrics.find(m => m.startsOn <= today && (!m.endsOn || m.endsOn >= today))?.id ?? metrics[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const notify = useFeedback();
  const metric = metrics.find(m => m.id === metricId);
  const isTickets = !!metric && /билет/iu.test(metric.name);
  if (!metrics.length) return null;
  const active = !!metric && isValidDate(date) && date >= metric.startsOn && (!metric.endsOn || date <= metric.endsOn) && date <= today;
  const rows = employees.filter(e => e.active && metric?.departments.includes(e.department));
  function isOff(employee: EmployeeRow) {
    return daysOff[employee.id]?.includes(date) || !!(employee.hireDate && isValidDate(employee.hireDate) && date < employee.hireDate);
  }
  const changed = rows.filter(e => draft[e.id] !== undefined && !isOff(e));
  function save() {
    const values = changed.map(e => ({ employeeId: e.id, amount: Number(draft[e.id]) }));
    if (changed.some(e => !draft[e.id].trim()) || values.some(e => !Number.isSafeInteger(e.amount) || e.amount < 0 || e.amount > 1000000)) {
      setError("Введите целое количество от 0 до 1 000 000. Для нулевых продаж укажите 0."); return;
    }
    setError("");
    startTransition(async () => {
      try { await saveMetricEntries(metricId, date, values); setDraft({}); notify("Факт по показателю сохранён. KPI пересчитан."); }
      catch (err) { setError(err instanceof Error ? err.message : "Не удалось сохранить"); }
    });
  }
  return <details open className="mb-5 border border-outline-variant rounded-xl bg-white group">
    <summary className="p-4 cursor-pointer font-semibold text-primary">{metrics.every(m => /билет/iu.test(m.name)) ? "Продажи билетов" : "Билеты и ежедневные показатели"}</summary>
    <div className="p-4 pt-0 space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-sm flex-1 min-w-48">Показатель<select disabled={pending || changed.length > 0} value={metricId} onChange={e => { setMetricId(e.target.value); setDraft({}); setError(""); }} className="w-full block border border-outline-variant rounded-lg p-2">{metrics.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="text-sm">Дата<input disabled={pending || changed.length > 0} type="date" value={date} max={today} onChange={e => { setDate(e.target.value); setDraft({}); setError(""); }} className="w-full block border border-outline-variant rounded-lg p-2" /></label>
      </div>
      <p className="text-sm text-on-surface-variant">Норма: <strong>{metric?.dailyTarget} в рабочий день</strong> · вес {metric?.weight}% KPI. Факт вводится вручную. Перевыполнение другого дня не компенсирует недобор; пустой факт считается нулём.</p>
      {!active && <p className="text-sm text-error">На выбранную дату показатель не действует или дата ещё не наступила.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead><tr><th className="p-2">Сотрудник</th><th className="p-2">{isTickets ? "Продано билетов" : "Количество"}</th><th className="p-2">История</th></tr></thead>
          <tbody>{rows.map(employee => {
            const saved = entries.find(e => e.metricId === metricId && e.employeeId === employee.id && e.date === date);
            const value = draft[employee.id] ?? (saved ? String(saved.amount) : "");
            const off = isOff(employee);
            return <tr key={employee.id} className="border-t border-outline-variant">
              <td className="p-2 font-medium">{employee.fullName}<div className="text-xs font-normal text-outline">{employee.department}{off ? " · Нет рабочей нормы" : ""}</div></td>
              <td className="p-2"><input aria-label={`${isTickets ? "Продано билетов" : "Количество"}: ${employee.fullName}`} type="number" min={0} max={1000000} step={1} disabled={pending || !active || off} value={value} onChange={e => setDraft({ ...draft, [employee.id]: e.target.value })} className="w-28 rounded-lg border border-outline-variant px-2 py-1 disabled:opacity-40" placeholder="Не введено" /></td>
              <td className="p-2">{saved && <AuditHistoryButton logEntryId={saved.id} metricEntry />}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!rows.length && <p className="text-sm text-outline">Нет доступных сотрудников для этого показателя.</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !active || !changed.length} onClick={save} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40">{pending ? "Сохранение…" : isTickets ? "Сохранить продажи билетов" : "Сохранить количество"}</button>
        {changed.length > 0 && <><span className="text-xs text-outline">Несохранённых строк: {changed.length}</span><button disabled={pending} onClick={() => { setDraft({}); setError(""); }} className="text-sm text-on-surface-variant underline">Отменить ввод</button></>}
      </div>
    </div>
  </details>;
}

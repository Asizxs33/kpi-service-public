"use client";
import { useFeedback } from "@/components/FeedbackProvider";
import ProgressMeter from "@/components/ProgressMeter";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setDepartmentPlan, setEmployeePlan } from "./actions";
import DayOffPicker from "./DayOffPicker";

export type PlanRow = {
  kind: "department" | "employee";
  id: string;
  label: string;
  department: string;
  plan: number;
  fact: number;
  daysOff?: string[];
};

function fmt(n: number) {
  return `₸ ${n.toLocaleString("ru-RU")}`;
}

function DeviationCell({ plan, fact }: { plan: number; fact: number }) {
  if (plan <= 0) {
    return <span className="text-on-surface-variant">—</span>;
  }
  const diff = fact - plan;
  const pct = Math.round((fact / plan) * 100);
  const positive = diff >= 0;
  return (
    <span className={`deviation-badge ${positive ? "deviation-positive" : "deviation-negative"}`}>
      {positive ? "+" : ""}
      {diff.toLocaleString("ru-RU")} ₸ ({pct}%)
    </span>
  );
}

function usePlanSave(row: PlanRow, monthKey: string) {
  const notify = useFeedback();
  const [value, setValue] = useState(row.plan);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    startTransition(async () => {
      try {
      if (row.kind === "department") {
        await setDepartmentPlan(monthKey, row.department, value);
      } else {
        await setEmployeePlan(monthKey, row.id, value);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      notify("План сохранён");
      } catch (error) { notify(error instanceof Error ? error.message : "Не удалось сохранить план", true); }
    });
  }

  return { value, setValue, pending, saved, dirty: value !== row.plan, handleSave };
}

function PlanTableRow({ row, monthKey, canManageDaysOff }: { row: PlanRow; monthKey: string; canManageDaysOff: boolean }) {
  const { value, setValue, pending, saved, dirty, handleSave } = usePlanSave(row, monthKey);

  return (
    <tr className={`border-b border-outline-variant ${row.kind === "department" ? "bg-surface-container-low font-semibold" : ""}`}>
      <td className="py-3 px-4">{row.label}</td>
      <td className="py-3 px-4 text-on-surface-variant">{row.department}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <input
            type="number" aria-label={`План продаж: ${row.label}`}
            min={0}
            value={value}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            className="w-36 h-9 px-2 border border-outline-variant rounded text-sm text-right focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleSave}
            disabled={pending || !dirty}
            className="h-9 px-3 bg-primary text-on-primary rounded text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "..." : saved ? "✓" : "Сохранить"}
          </button>
        </div>
      </td>
      <td className="py-3 px-4 text-right"><strong>{fmt(row.fact)}</strong>{row.plan > 0 && <ProgressMeter value={Math.round(row.fact / row.plan * 100)} label="Выполнение" />}</td>
      <td className="py-3 px-4 text-right">
        <DeviationCell plan={row.plan} fact={row.fact} />
      </td>
      {canManageDaysOff && <td className="py-3 px-4">{row.kind === "employee" && <DayOffPicker employeeId={row.id} monthKey={monthKey} initialDaysOff={row.daysOff ?? []} />}</td>}
    </tr>
  );
}

function PlanCard({ row, monthKey, canManageDaysOff }: { row: PlanRow; monthKey: string; canManageDaysOff: boolean }) {
  const { value, setValue, pending, saved, dirty, handleSave } = usePlanSave(row, monthKey);

  return (
    <div className={`p-4 flex flex-col gap-3 ${row.kind === "department" ? "bg-surface-container-low" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate ${row.kind === "department" ? "font-semibold" : "font-medium"}`}>{row.label}</div>
          <span className="text-xs text-on-surface-variant">{row.department}</span>
        </div>
        {canManageDaysOff && row.kind === "employee" && <DayOffPicker employeeId={row.id} monthKey={monthKey} initialDaysOff={row.daysOff ?? []} />}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number" aria-label={`План продаж: ${row.label}`}
          min={0}
          value={value}
          onChange={(e) => setValue(Number(e.target.value) || 0)}
          className="flex-1 min-w-0 h-9 px-2 border border-outline-variant rounded text-sm text-right focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleSave}
          disabled={pending || !dirty}
          className="h-9 px-3 bg-primary text-on-primary rounded text-xs font-semibold hover:opacity-90 disabled:opacity-40 shrink-0"
        >
          {pending ? "..." : saved ? "✓" : "Сохранить"}
        </button>
      </div>

      {row.plan > 0 && <ProgressMeter value={Math.round(row.fact / row.plan * 100)} label="Выполнение плана" />}
      <div className="flex items-center justify-between text-sm pt-2 border-t border-outline-variant">
        <div>
          <span className="text-xs text-on-surface-variant block">Факт, ₸</span>
          {fmt(row.fact)}
        </div>
        <div className="text-right">
          <span className="text-xs text-on-surface-variant block">Отклонение</span>
          <DeviationCell plan={row.plan} fact={row.fact} />
        </div>
      </div>
    </div>
  );
}

export default function PlansClient({
  monthKey,
  departmentRows,
  employeeRows,
  canManageDaysOff = false,
}: {
  monthKey: string;
  departmentRows: PlanRow[];
  employeeRows: PlanRow[];
  canManageDaysOff?: boolean;
}) {
  const router = useRouter();
  const allRows = [...departmentRows, ...employeeRows];

  function handleMonthChange(next: string) {
    router.push(`/plans?month=${next}`);
  }

  return (
    <main className="plans-page flex-1 p-4 sm:p-6 max-w-container-max mx-auto w-full flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">Планы продаж</h1>
          <p className="text-sm text-on-surface-variant mt-1">План на конкретный месяц — прошлые и будущие месяцы не затрагиваются.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface-variant uppercase">Месяц</span>
          <input
            type="month" aria-label="Месяц плана"
            value={monthKey}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="h-10 px-3 border border-outline-variant rounded-lg bg-surface text-sm"
          />
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        {/* Мобильный — карточки */}
        <div className="md:hidden divide-y divide-outline-variant">
          {allRows.map((row) => (
            <PlanCard key={`${row.kind}-${row.id}-${monthKey}`} row={row} monthKey={monthKey} canManageDaysOff={canManageDaysOff} />
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="data-table sticky-name-table w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-xs font-semibold text-on-surface-variant uppercase">
                <th className="py-3 px-4">Кто</th>
                <th className="py-3 px-4">Отдел</th>
                <th className="py-3 px-4">План, ₸</th>
                <th className="py-3 px-4 text-right">Факт, ₸</th>
                <th className="py-3 px-4 text-right">Отклонение</th>
                {canManageDaysOff && <th className="py-3 px-4">Выходные</th>}
              </tr>
            </thead>
            <tbody>
              {departmentRows.map((row) => (
                <PlanTableRow key={`dept-${row.id}-${monthKey}`} row={row} monthKey={monthKey} canManageDaysOff={canManageDaysOff} />
              ))}
              {employeeRows.map((row) => (
                <PlanTableRow key={`emp-${row.id}-${monthKey}`} row={row} monthKey={monthKey} canManageDaysOff={canManageDaysOff} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

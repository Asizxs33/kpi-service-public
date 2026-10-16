"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { initials } from "@/lib/kpi";
import { showResultColumn } from "@/lib/departments";

export type ResultsTableRow = {
  id: string;
  fullName: string;
  department: string;
  dayOff: boolean;
  daysOffCount: number;
  plan: number;
  dailyPlan: number;
  deviation: number;
  planPct: number;
  sales: number;
  lastYear: number | null;
  served: number;
  avgCheck: number;
  reviews: number;
  reviewsPct: number;
  complaints: number;
  referrals: number;
  referralsPct: number;
  tickets: number | null;
  ticketsPct: number | null;
  discipline: number;
  kpi: number;
  statusLabel: string;
  statusCls: string;
};

type ColumnKey =
  | "department"
  | "dayOff"
  | "daysOffCount"
  | "plan"
  | "dailyPlan"
  | "deviation"
  | "planPct"
  | "sales"
  | "lastYear"
  | "served"
  | "avgCheck"
  | "reviews"
  | "reviewsPct"
  | "complaints"
  | "referrals"
  | "referralsPct"
  | "tickets"
  | "ticketsPct"
  | "discipline"
  | "kpi"
  | "status";

const COLUMNS: { key: ColumnKey; label: string; align: "right" | "center"; defaultHidden?: boolean }[] = [
  { key: "department", label: "Отдел", align: "center", defaultHidden: true },
  { key: "dayOff", label: "Выходной", align: "center" },
  { key: "daysOffCount", label: "Выходных за месяц", align: "center", defaultHidden: true },
  { key: "plan", label: "План ₸", align: "right", defaultHidden: true },
  { key: "dailyPlan", label: "План дня ₸", align: "right", defaultHidden: true },
  { key: "sales", label: "Продажи ₸", align: "right" },
  { key: "lastYear", label: "Прошлый год ₸", align: "right", defaultHidden: true },
  { key: "deviation", label: "Отклонение", align: "right", defaultHidden: true },
  { key: "planPct", label: "% плана", align: "right", defaultHidden: true },
  { key: "served", label: "Обслужено", align: "right" },
  { key: "avgCheck", label: "Ср. чек", align: "right" },
  { key: "reviews", label: "Отзывы", align: "right" },
  { key: "reviewsPct", label: "Отзывы %", align: "right" },
  { key: "complaints", label: "Жалобы", align: "right" },
  { key: "referrals", label: "2 этаж", align: "right" },
  { key: "referralsPct", label: "2 этаж %", align: "right" },
  { key: "tickets", label: "Билеты", align: "right" },
  { key: "ticketsPct", label: "Билеты, %", align: "right" },
  { key: "discipline", label: "Дисциплина %", align: "right" },
  { key: "kpi", label: "KPI %", align: "right" },
  { key: "status", label: "Статус", align: "center" },
];

// Экспортируется — DashboardExportButton использует тот же набор как
// запасной вариант по умолчанию (когда пользователь ещё ни разу не трогал
// шестерёнку и в localStorage ничего не сохранено), чтобы новые
// по-умолчанию-скрытые колонки не появлялись в экспорте, пока их явно не
// включили на экране.
export const DEFAULT_HIDDEN: ColumnKey[] = COLUMNS.filter((c) => c.defaultHidden).map((c) => c.key);

// v2 -- добавили новые колонки (Отдел/Выходных/План/План дня/Отклонение/%
// плана, скрыты по умолчанию) к прежнему набору; новый ключ, чтобы у кого
// уже было сохранено состояние v1, новые колонки не попали в hidden молча.
export const STORAGE_KEY = "dashboard-results-hidden-columns-v2";

function subscribeColumns(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_KEY, onChange);
  };
}

function readColumns() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function parseColumns(saved: string | null): Set<ColumnKey> {
  try {
    const value: unknown = saved ? JSON.parse(saved) : null;
    if (Array.isArray(value)) return new Set(COLUMNS.filter(c => value.includes(c.key)).map(c => c.key));
  } catch { /* Use defaults when saved preferences are invalid. */ }
  return new Set(DEFAULT_HIDDEN);
}

function moneyCell(n: number) {
  return `${n.toLocaleString("ru-RU")} ₸`;
}

function renderCell(row: ResultsTableRow, key: ColumnKey) {
  switch (key) {
    case "department":
      return row.department;
    case "dayOff":
      return row.dayOff ? <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error">Выходной</span> : "";
    case "daysOffCount":
      return row.daysOffCount;
    case "plan":
      return moneyCell(row.plan);
    case "dailyPlan":
      return moneyCell(row.dailyPlan);
    case "deviation":
      return <span className={row.deviation < 0 ? "text-error font-semibold" : "text-[#2EA84A] font-semibold"}>{row.deviation >= 0 ? "+" : ""}{moneyCell(row.deviation)}</span>;
    case "planPct":
      return <span className={row.planPct < 95 ? "text-error font-medium" : "text-[#2EA84A] font-medium"}>{row.planPct}%</span>;
    case "sales":
      return row.sales.toLocaleString("ru-RU");
    case "lastYear":
      return row.lastYear === null ? "—" : row.lastYear.toLocaleString("ru-RU");
    case "served":
      return row.served;
    case "avgCheck":
      return row.avgCheck.toLocaleString("ru-RU");
    case "reviews":
      return row.reviews;
    case "reviewsPct":
      return <span className={row.reviewsPct < 100 ? "text-error font-medium" : ""}>{row.reviewsPct}%</span>;
    case "complaints":
      return row.complaints > 0 ? <span className="text-error font-medium">{row.complaints}</span> : 0;
    case "referrals":
      return row.referrals;
    case "referralsPct":
      return <span className={row.referralsPct < 100 ? "text-error font-medium" : ""}>{row.referralsPct}%</span>;
    case "discipline":
      return `${row.discipline}%`;
    case "tickets":
      return row.tickets === null ? "—" : row.tickets.toLocaleString("ru-RU");
    case "ticketsPct":
      return row.ticketsPct === null ? "—" : <span className={row.ticketsPct < 100 ? "text-error font-medium" : ""}>{row.ticketsPct.toLocaleString("ru-RU")}%</span>;
    case "kpi":
      return <span className={`kpi-badge ${row.kpi >= 85 ? "kpi-badge-good" : row.kpi >= 75 ? "kpi-badge-mid" : "kpi-badge-low"}`}>{row.kpi}%</span>;
    case "status":
      return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${row.statusCls}`}>{row.statusLabel}</span>;
  }
}

// Переключатель видимости столбцов (шестерёнка + чекбоксы) — таблица
// «Результаты по сотрудникам» широкая, не всем нужны все колонки сразу.
// Выбор сохраняется в localStorage браузера (per-device, не синхронизируется
// между пользователями/устройствами — это просто личное удобство).
export default function ResultsTable({ rows, teamAvg, department }: { rows: ResultsTableRow[]; teamAvg: number; department?: string }) {
  const savedColumns = useSyncExternalStore(subscribeColumns, readColumns, () => null);
  const [localColumns, setLocalColumns] = useState<Set<ColumnKey> | null>(null);
  const hidden = localColumns ?? parseColumns(savedColumns);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function toggleColumn(key: ColumnKey) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      setLocalColumns(null);
      window.dispatchEvent(new Event(STORAGE_KEY));
    } catch {
      setLocalColumns(next);
    }
  }

  const availableColumns = COLUMNS.filter((c) => showResultColumn(c.key, department));
  const visibleColumns = availableColumns.filter((c) => !hidden.has(c.key));

  return (
    <div className="hidden md:block">
      <div className="px-3 pt-2 flex justify-end relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title="Видимость столбцов"
          className="h-8 w-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
        >
          <Icon name="settings" className="text-[18px]" />
        </button>
        {menuOpen && (
          <div className="absolute right-3 top-full mt-1 z-20 w-56 bg-white border border-outline-variant rounded-lg shadow-xl p-2">
            <p className="text-xs font-semibold text-on-surface-variant px-2 py-1">Видимость столбцов</p>
            {availableColumns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface-container-low cursor-pointer text-sm">
                <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleColumn(c.key)} className="accent-primary" />
                {c.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table sticky-name-table w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-surface-container text-xs font-semibold text-on-surface-variant border-b border-outline-variant">
              <th className="p-3">Сотрудник</th>
              {visibleColumns.map((c) => (
                <th key={c.key} className={`p-3 text-${c.align} ${c.key === "kpi" ? "text-primary" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-outline-variant">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="p-6 text-center text-on-surface-variant">
                  Нет активных сотрудников. Добавьте сотрудника на странице «Сотрудники».
                </td>
              </tr>
            ) : (
              <>
                <tr className="bg-primary/5 font-semibold">
                  <td className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs">СР</div>
                    <span>Среднее по команде</span>
                  </td>
                  {visibleColumns.map((c) =>
                    c.key === "kpi" ? (
                      <td key={c.key} className="p-3 text-right text-primary">
                        {teamAvg}%
                      </td>
                    ) : c.key === "status" ? (
                      <td key={c.key} className="p-3 text-center">
                        -
                      </td>
                    ) : (
                      <td key={c.key} className="p-3" />
                    )
                  )}
                </tr>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs font-bold">
                        {initials(row.fullName)}
                      </div>
                      <Link href={`/employees/${row.id}`} className="hover:text-primary">
                        {row.fullName}
                      </Link>
                      {row.dayOff && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error">Выходной</span>}
                    </td>
                    {visibleColumns.map((c) => (
                      <td key={c.key} className={`p-3 text-${c.align}`}>
                        {renderCell(row, c.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

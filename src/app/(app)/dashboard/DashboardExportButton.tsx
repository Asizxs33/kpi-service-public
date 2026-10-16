"use client";

import { useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import Icon from "@/components/Icon";


import { exportMultiSheetExcel, exportToPdf, escapeHtml, type ExportColumn } from "@/lib/export-xlsx";
import { STORAGE_KEY, DEFAULT_HIDDEN } from "./ResultsTable";
import { showResultColumn } from "@/lib/departments";

export type DashboardExportRow = {
  fullName: string;
  department: string;
  dayOff: string;
  daysOffCount: number;
  plan: number;
  dailyPlan: number;
  sales: number;
  lastYear: number | null;
  deviation: number;
  planPct: number;
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
  status: string;
};

function fmtNum(n: unknown) {
  return typeof n === "number" ? n.toLocaleString("ru-RU") : String(n ?? "");
}

function pctBadge(pct: unknown) {
  const n = Number(pct) || 0;
  const cls = n >= 95 ? "badge-green" : n >= 75 ? "badge-amber" : "badge-red";
  return `<span class="badge ${cls}">${n}%</span>`;
}

function deviationCell(dev: unknown) {
  const n = Number(dev) || 0;
  const cls = n >= 0 ? "pos" : "neg";
  const sign = n >= 0 ? "+" : "";
  return `<span class="${cls}">${sign}${fmtNum(n)} ₸</span>`;
}

function statusBadgeHtml(status: unknown) {
  const s = String(status ?? "");
  const cls = s === "Топ" || s === "Хорошо" ? "badge-green" : s === "Средне" ? "badge-amber" : "badge-red";
  return `<span class="badge ${cls}">${escapeHtml(s)}</span>`;
}

function dayOffCell(v: unknown) {
  return v ? `<span class="badge badge-red">${escapeHtml(v)}</span>` : "";
}

function complaintsCell(v: unknown) {
  const n = Number(v) || 0;
  return n > 0 ? `<span class="neg">${n}</span>` : "0";
}

const COLUMNS: ExportColumn[] = [
  { header: "Сотрудник", key: "fullName", width: 28 },
  { header: "Отдел", key: "department", width: 16 },
  { header: "Выходной", key: "dayOff", width: 12, align: "center", render: (v) => dayOffCell(v) },
  { header: "Выходных за месяц", key: "daysOffCount", width: 14, align: "center" },
  { header: "План, ₸", key: "plan", width: 14, align: "right" },
  { header: "План дня, ₸", key: "dailyPlan", width: 14, align: "right" },
  { header: "Факт, ₸", key: "sales", width: 14, align: "right" },
  { header: "Прошлый год, ₸", key: "lastYear", width: 14, align: "right", render: (v) => (typeof v === "number" ? fmtNum(v) : "—") },
  { header: "Отклонение", key: "deviation", width: 16, align: "right", render: (v) => deviationCell(v) },
  { header: "% плана", key: "planPct", width: 10, align: "center", render: (v) => pctBadge(v) },
  { header: "Обслужено", key: "served", width: 12, align: "right" },
  { header: "Ср. чек, ₸", key: "avgCheck", width: 12, align: "right" },
  { header: "Отзывы", key: "reviews", width: 10, align: "right" },
  { header: "Отзывы %", key: "reviewsPct", width: 10, align: "center", render: (v) => pctBadge(v) },
  { header: "Жалобы", key: "complaints", width: 10, align: "right", render: (v) => complaintsCell(v) },
  { header: "2 этаж", key: "referrals", width: 10, align: "right" },
  { header: "2 этаж %", key: "referralsPct", width: 10, align: "center", render: (v) => pctBadge(v) },
  { header: "Билеты", key: "tickets", width: 10, align: "right", render: (v) => v === null ? "—" : fmtNum(v) },
  { header: "Билеты, %", key: "ticketsPct", width: 12, align: "center", numFmt: '0.##"%"', render: (v) => v === null ? "—" : pctBadge(v) },
  { header: "Дисциплина %", key: "discipline", width: 14, align: "center", render: (v) => pctBadge(v) },
  { header: "KPI %", key: "kpi", width: 10, align: "center", render: (v) => pctBadge(v) },
  { header: "Статус", key: "status", width: 12, align: "center", render: (v) => statusBadgeHtml(v) },
];

// Столбцы, скрытые шестерёнкой «Видимость столбцов» в таблице на экране
// (ResultsTable), скрываются и в экспорте — читаем тот же ключ
// localStorage прямо в момент экспорта, чтобы не дублировать состояние.
function getVisibleColumns(department?: string): ExportColumn[] {
  const availableColumns = COLUMNS.filter((c) => showResultColumn(c.key, department));
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const hidden = new Set<string>(saved ? (JSON.parse(saved) as string[]) : DEFAULT_HIDDEN);
    return availableColumns.filter((c) => !hidden.has(c.key));
  } catch {
    return availableColumns.filter((c) => !(DEFAULT_HIDDEN as string[]).includes(c.key));
  }
}

export default function DashboardExportButton({ rows, department, period }: { rows: DashboardExportRow[]; department?: string; period: string }) {
  const notify = useFeedback();
  const [exporting, setExporting] = useState(false);
  const subtitle = period;
  const title = `KPI — ${department || "Все отделы"}`;

  async function handleExportExcel() {
    setExporting(true);
    try { await exportMultiSheetExcel(`${title}_${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: "Результаты по сотрудникам", columns: getVisibleColumns(department), rows }], { title, subtitle });
    notify("Excel готов"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось создать Excel", true); } finally { setExporting(false); }
  }

  function handleExportPdf() {
    try { exportToPdf(title, [{ name: "Результаты по сотрудникам", columns: getVisibleColumns(department), rows }], { subtitle }); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось открыть PDF", true); }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleExportExcel} disabled={exporting} className="h-9 px-4 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-surface-container-low flex items-center gap-2">
        <Icon name="download" className="text-[18px]" />
        {exporting ? "Подготовка…" : "Excel"}
      </button>
      <button onClick={handleExportPdf} className="h-9 px-4 border border-outline-variant text-on-surface-variant rounded-lg text-sm font-semibold hover:bg-surface-container-low flex items-center gap-2">
        <Icon name="picture_as_pdf" className="text-[18px]" />
        PDF
      </button>
    </div>
  );
}

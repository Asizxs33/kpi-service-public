"use client";
import { useModalFocus } from "@/lib/use-modal-focus";
import { useFeedback } from "@/components/FeedbackProvider";
import ResponsiveFilters from "@/components/ResponsiveFilters";

import Icon from "@/components/Icon";


import { useMemo, useState, useTransition } from "react";
import type { Employee, LogEntry, LogType, ComplaintKind } from "@/generated/prisma/client";
import { addLog, updateLog, removeLog, bulkSetCounts, type LogInput } from "./actions";
import { exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export-xlsx";
import SevenStepsToggle from "@/components/SevenStepsToggle";
import FullServiceRating from "@/components/FullServiceRating";
import AuditHistoryButton from "@/components/AuditHistoryButton";
import CustomMetricsLog from "./CustomMetricsLog";
import type { CustomMetric, CustomMetricEntry } from "@/lib/custom-kpi";

const TABS: { type: LogType; label: string }[] = [
  { type: "UPSELL", label: "Допродажи и 7 шагов продаж" },
  { type: "COMPLAINT", label: "Жалобы и отзывы" },
  { type: "DISCIPLINE", label: "Нарушения дисциплины" },
  { type: "REFERRAL", label: "Отправки на 2 этаж" },
];

const TAB_TITLES: Record<LogType, string> = {
  UPSELL: "Допродажа и 7 шагов",
  COMPLAINT: "Жалоба / отзыв",
  DISCIPLINE: "Нарушение дисциплины",
  REFERRAL: "Отправка на 2 этаж",
};

function fmt(n: number) {
  return `₸ ${n.toLocaleString("ru-RU")}`;
}

function parseReasons(raw: unknown): Record<number, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[Number(k)] = v;
  }
  return out;
}

// Причины отклонений «Полного обслуживания» — для экспорта в одну строку.
function formatReasons(raw: unknown): string {
  const reasons = parseReasons(raw);
  if (!reasons) return "";
  return Object.entries(reasons)
    .map(([i, text]) => `${Number(i) + 1}: ${text}`)
    .join("; ");
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  employeeId: "",
  salesAmount: 0,
  customersServed: 0,
  successfulUpsells: 0,
  sevenSteps: false,
  fullServiceCount: 0,
  kind: "REVIEW" as "REVIEW" | "COMPLAINT",
  violationType: "",
  fine: 0,
  count: 1,
  notes: "",
};

export default function LogsClient({
  employees,
  logs,
  daysOffByEmployee = {},
  metrics, metricEntries, today,
}: {
  employees: Employee[];
  logs: LogEntry[];
  daysOffByEmployee?: Record<string, string[]>;
  metrics: CustomMetric[];
  metricEntries: (CustomMetricEntry & { id: string })[];
  today: string;
}) {
  const notify = useFeedback();
  const isDayOff = (employeeId: string, date: string) => daysOffByEmployee[employeeId]?.includes(date) ?? false;
  const [activeType, setActiveType] = useState<LogType>("UPSELL");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const modalRef = useModalFocus(modalOpen, setModalOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkRef = useModalFocus(bulkOpen, setBulkOpen);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkCounts, setBulkCounts] = useState<Record<string, number>>({});
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const activeEmployees = employees.filter((e) => e.active);

  const empName = (id: string) => employees.find((e) => e.id === id)?.fullName ?? "—";

  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => l.type === activeType)
      .filter((l) => !employeeFilter || l.employeeId === employeeFilter)
      .filter((l) => !dateFilter || l.date === dateFilter);
  }, [logs, activeType, employeeFilter, dateFilter]);

  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleLogs = filteredLogs.slice(pageStart, pageStart + pageSize);

  function openModal() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, employeeId: activeEmployees[0]?.id ?? "" });
    setFormError(null);
    setModalOpen(true);
  }

  // Массовый ввод за день — экран со всеми сотрудниками сразу, вместо
  // модалки на каждого по отдельности (для «Отзывы» и «2 этаж», где нужно
  // просто число на человека).
  function loadBulkCounts(date: string) {
    const counts: Record<string, number> = {};
    activeEmployees.forEach((e) => {
      const log = logs.find(
        (l) => l.employeeId === e.id && l.date === date && l.type === activeType && (activeType !== "COMPLAINT" || l.kind === "REVIEW")
      );
      counts[e.id] = log?.count ?? 0;
    });
    setBulkCounts(counts);
  }

  function openBulk() {
    loadBulkCounts(bulkDate);
    setBulkError(null);
    setBulkOpen(true);
  }

  function handleBulkDateChange(date: string) {
    setBulkDate(date);
    loadBulkCounts(date);
  }

  function handleBulkSave() {
    const entries = activeEmployees.map((e) => ({ employeeId: e.id, count: bulkCounts[e.id] ?? 0 }));
    setBulkError(null);
    startBulkTransition(async () => {
      try {
        await bulkSetCounts(
          bulkDate,
          activeType as "COMPLAINT" | "REFERRAL",
          activeType === "COMPLAINT" ? ("REVIEW" as ComplaintKind) : undefined,
          entries
        );
        setBulkOpen(false);
        notify("Записи сохранены");
      } catch (e) {
        setBulkError(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  function openEditModal(log: LogEntry) {
    setEditingId(log.id);
    setForm({
      date: log.date,
      employeeId: log.employeeId,
      salesAmount: log.salesAmount ?? 0,
      customersServed: log.customersServed ?? 0,
      successfulUpsells: log.successfulUpsells ?? 0,
      sevenSteps: log.sevenSteps ?? false,
      fullServiceCount: log.fullServiceCount ?? 0,
      kind: (log.kind as "REVIEW" | "COMPLAINT") ?? "REVIEW",
      violationType: log.violationType ?? "",
      fine: log.fine ?? 0,
      count: log.count ?? 1,
      notes: log.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.date) return;

    const data: LogInput = { type: activeType, date: form.date, employeeId: form.employeeId, notes: form.notes };
    if (activeType === "UPSELL") {
      data.salesAmount = form.salesAmount;
      data.customersServed = form.customersServed;
      data.successfulUpsells = form.successfulUpsells;
      data.sevenSteps = form.sevenSteps;
      data.fullServiceCount = Math.min(form.fullServiceCount, form.customersServed);
    } else if (activeType === "COMPLAINT") {
      data.kind = form.kind;
      if (form.kind === "REVIEW") data.count = form.count || 1;
    } else if (activeType === "DISCIPLINE") {
      data.violationType = form.violationType;
      data.fine = form.fine;
    } else if (activeType === "REFERRAL") {
      data.count = form.count;
    }

    setFormError(null);
    startTransition(async () => {
      try {
        if (editingId) {
          await updateLog(editingId, data);
        } else {
          await addLog(data);
        }
        setModalOpen(false);
        notify("Запись сохранена");
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Не удалось сохранить");
      }
    });
  }

  function buildExportData(): { fileBase: string; sheetName: string; columns: ExportColumn[]; rows: Record<string, unknown>[] } {
    if (activeType === "UPSELL") {
      return {
        fileBase: "Допродажи",
        sheetName: "Допродажи и 7 шагов",
        columns: [
          { header: "Дата", key: "date", width: 12 },
          { header: "Выходной", key: "dayOff", width: 10 },
          { header: "Сотрудник", key: "employee", width: 26 },
          { header: "Продажи, ₸", key: "sales", width: 14 },
          { header: "Обслужено", key: "served", width: 12 },
          { header: "Допродано", key: "upsold", width: 12 },
          { header: "7 шагов", key: "sevenSteps", width: 10 },
          { header: "Полное обслуживание", key: "fullService", width: 18 },
          { header: "Причины отклонений", key: "fullServiceReasons", width: 30 },
          { header: "Заметки", key: "notes", width: 30 },
        ],
        rows: filteredLogs.map((l) => ({
          date: l.date,
          dayOff: isDayOff(l.employeeId, l.date) ? "Выходной" : "",
          employee: empName(l.employeeId),
          sales: l.salesAmount ?? 0,
          served: l.customersServed ?? 0,
          upsold: l.successfulUpsells ?? 0,
          sevenSteps: l.sevenSteps ? "Да" : "Нет",
          fullService: `${l.fullServiceCount ?? 0} из ${l.customersServed ?? 0}`,
          fullServiceReasons: formatReasons(l.fullServiceReasons),
          notes: l.notes ?? "",
        })),
      };
    }
    if (activeType === "COMPLAINT") {
      return {
        fileBase: "Жалобы_и_отзывы",
        sheetName: "Жалобы и отзывы",
        columns: [
          { header: "Дата", key: "date", width: 12 },
          { header: "Выходной", key: "dayOff", width: 10 },
          { header: "Сотрудник", key: "employee", width: 26 },
          { header: "Тип", key: "kind", width: 12 },
          { header: "Кол-во", key: "count", width: 10 },
          { header: "Заметки", key: "notes", width: 30 },
        ],
        rows: filteredLogs.map((l) => ({
          date: l.date,
          dayOff: isDayOff(l.employeeId, l.date) ? "Выходной" : "",
          employee: empName(l.employeeId),
          kind: l.kind === "COMPLAINT" ? "Жалоба" : "Отзыв",
          count: l.kind === "REVIEW" ? l.count ?? 1 : "",
          notes: l.notes ?? "",
        })),
      };
    }
    if (activeType === "DISCIPLINE") {
      return {
        fileBase: "Нарушения_дисциплины",
        sheetName: "Нарушения дисциплины",
        columns: [
          { header: "Дата", key: "date", width: 12 },
          { header: "Выходной", key: "dayOff", width: 10 },
          { header: "Сотрудник", key: "employee", width: 26 },
          { header: "Нарушение", key: "violationType", width: 20 },
          { header: "Штраф, ₸", key: "fine", width: 12 },
          { header: "Заметки", key: "notes", width: 30 },
        ],
        rows: filteredLogs.map((l) => ({
          date: l.date,
          dayOff: isDayOff(l.employeeId, l.date) ? "Выходной" : "",
          employee: empName(l.employeeId),
          violationType: l.violationType ?? "",
          fine: l.fine ?? 0,
          notes: l.notes ?? "",
        })),
      };
    }
    return {
      fileBase: "Отправки_на_2_этаж",
      sheetName: "Отправки на 2 этаж",
      columns: [
        { header: "Дата", key: "date", width: 12 },
        { header: "Выходной", key: "dayOff", width: 10 },
        { header: "Сотрудник", key: "employee", width: 26 },
        { header: "Кол-во", key: "count", width: 10 },
        { header: "Заметки", key: "notes", width: 30 },
      ],
      rows: filteredLogs.map((l) => ({
        date: l.date,
        dayOff: isDayOff(l.employeeId, l.date) ? "Выходной" : "",
        employee: empName(l.employeeId),
        count: l.count ?? 0,
        notes: l.notes ?? "",
      })),
    };
  }

  const [exporting, setExporting] = useState(false);
  async function handleExportExcel() {
    setExporting(true);
    try {
    const { fileBase, sheetName, columns, rows } = buildExportData();
    await exportToExcel(`${fileBase}_${new Date().toISOString().slice(0, 10)}.xlsx`, sheetName, columns, rows, { subtitle: `${dateFilter || "Все даты"} · ${employeeFilter ? empName(employeeFilter) : "Все сотрудники"}` });
    notify("Excel готов"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось создать Excel", true); } finally { setExporting(false); }
  }

  function handleExportPdf() {
    const { sheetName, columns, rows } = buildExportData();
    try { exportToPdf(sheetName, [{ name: sheetName, columns, rows }], { subtitle: `${dateFilter || "Все даты"} · ${employeeFilter ? empName(employeeFilter) : "Все сотрудники"}` }); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось открыть PDF", true); }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await removeLog(id);
        notify("Запись удалена");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Не удалось удалить запись", true);
      }
    });
  }

  const summary = useMemo(() => {
    if (activeType === "UPSELL") {
      const served = filteredLogs.reduce((s, l) => s + (l.customersServed || 0), 0);
      const upsold = filteredLogs.reduce((s, l) => s + (l.successfulUpsells || 0), 0);
      const pct = served > 0 ? Math.round((upsold / served) * 100) : 0;
      return (
        <>
          Обслужено: {served} · Допродано: {upsold} · <span className="text-[#2EA84A]">{pct}% конверсия</span>
        </>
      );
    }
    if (activeType === "COMPLAINT") {
      const reviews = filteredLogs.filter((l) => l.kind === "REVIEW").reduce((s, l) => s + (l.count || 1), 0);
      const complaints = filteredLogs.filter((l) => l.kind === "COMPLAINT").length;
      return (
        <>
          Отзывов: {reviews} · <span className="text-error">Жалоб: {complaints}</span>
        </>
      );
    }
    if (activeType === "DISCIPLINE") {
      const fines = filteredLogs.reduce((s, l) => s + (l.fine || 0), 0);
      return (
        <>
          Нарушений: {filteredLogs.length} · Штрафы: {fmt(fines)}
        </>
      );
    }
    const count = filteredLogs.reduce((s, l) => s + (l.count || 0), 0);
    return <>Отправлено на 2 этаж: {count}</>;
  }, [filteredLogs, activeType]);

  return (
    <main className="logs-page flex-1 p-6 max-w-container-max mx-auto w-full flex flex-col">
      <div className="page-heading"><h1>Журналы контроля</h1><p>Продажи, качество обслуживания и ежедневная работа команды</p></div>
      <CustomMetricsLog metrics={metrics} entries={metricEntries} employees={employees} daysOff={daysOffByEmployee} today={today} />
      <div className="journal-tabs mb-4 overflow-x-auto">
        <nav aria-label="Тип журнала" className="flex gap-2 w-max min-w-full">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              aria-pressed={activeType === tab.type}
              onClick={() => { setActiveType(tab.type); setPage(1); }}
              className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm cursor-pointer ${
                activeType === tab.type ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-primary font-medium"
              }`}
            >
              <Icon name={{ UPSELL: "shopping_cart", COMPLAINT: "star_rate", DISCIPLINE: "verified_user", REFERRAL: "stairs" }[tab.type]} />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="journal-toolbar flex justify-between items-center mb-4 flex-wrap gap-3">
        <ResponsiveFilters active={!!dateFilter || !!employeeFilter}>
          <input
            type="date"
            aria-label="Дата записей"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="pl-3 pr-3 py-2 border border-outline-variant rounded bg-white h-10 text-sm"
          />
          <select aria-label="Сотрудник" value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }} className="pl-3 pr-8 py-2 border border-outline-variant rounded bg-white h-10 text-sm">
            <option value="">Все сотрудники</option>
            {activeEmployees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
          {(dateFilter || employeeFilter) && <button type="button" onClick={() => { setDateFilter(""); setEmployeeFilter(""); setPage(1); }} className="text-sm text-primary px-2">Сбросить</button>}
        </ResponsiveFilters>
        <div className="journal-actions flex flex-wrap gap-2 sm:gap-3">
          <button onClick={handleExportExcel} disabled={exporting} className="border border-outline-variant text-on-surface-variant h-8 sm:h-10 px-2.5 sm:px-4 rounded text-xs sm:text-sm flex items-center hover:bg-surface-container-low">
            <Icon name="download" className="mr-1 sm:mr-2 text-[16px] sm:text-sm" />
            Экспорт
          </button>
          <button onClick={handleExportPdf} className="border border-outline-variant text-on-surface-variant h-8 sm:h-10 px-2.5 sm:px-4 rounded text-xs sm:text-sm flex items-center hover:bg-surface-container-low">
            <Icon name="picture_as_pdf" className="mr-1 sm:mr-2 text-[16px] sm:text-sm" />
            PDF
          </button>
          {(activeType === "COMPLAINT" || activeType === "REFERRAL") && (
            <button
              onClick={openBulk}
              className="border border-primary text-primary h-8 sm:h-10 px-2.5 sm:px-4 rounded text-xs sm:text-sm flex items-center hover:bg-primary/5 whitespace-nowrap"
            >
              <Icon name="table_rows" className="mr-1 sm:mr-2 text-[16px] sm:text-sm" />
              Массовый ввод за день
            </button>
          )}
          <button onClick={openModal} className="bg-primary text-white h-8 sm:h-10 px-2.5 sm:px-4 rounded text-xs sm:text-sm flex items-center hover:opacity-90 whitespace-nowrap">
            <Icon name="add" className="mr-1 sm:mr-2 text-[16px] sm:text-sm" />
            Добавить запись
          </button>
        </div>
      </div>

      <nav aria-label="Страницы журнала" className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span aria-live="polite">Записи {filteredLogs.length ? pageStart + 1 : 0}–{Math.min(pageStart + pageSize, filteredLogs.length)} из {filteredLogs.length}</span>
        <div className="flex items-center gap-3">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="border border-outline-variant rounded px-3 py-2 disabled:opacity-40">Назад</button>
          <span>Страница {currentPage} из {pageCount}</span>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="border border-outline-variant rounded px-3 py-2 disabled:opacity-40">Далее</button>
        </div>
      </nav>
      <div className="journal-surface bg-white border border-outline-variant rounded flex-1 overflow-hidden flex flex-col shadow-sm">
        {/* Мобильный — карточки */}
        <div className="md:hidden divide-y flex-1 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-6 text-center text-sm text-on-surface-variant">Записей пока нет — добавьте первую.</div>
          ) : (
            visibleLogs.map((log) => (
              <div key={log.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{empName(log.employeeId)}</div>
                    <div className="text-xs text-on-surface-variant flex items-center gap-2 flex-wrap">
                      {log.date}
                      {isDayOff(log.employeeId, log.date) && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error">Выходной</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <AuditHistoryButton logEntryId={log.id} />
                    <button onClick={() => openEditModal(log)} className="text-on-surface-variant hover:text-primary p-1" title="Редактировать">
                      <Icon name="edit" className="text-[18px]" />
                    </button>
                    <button onClick={() => handleDelete(log.id)} disabled={pending} className="text-on-surface-variant hover:text-error p-1" title="Удалить">
                      <Icon name="delete" className="text-[18px]" />
                    </button>
                  </div>
                </div>

                {activeType === "UPSELL" && (
                  <>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <span className="text-xs text-on-surface-variant block">Продажи, ₸</span>
                        {fmt(log.salesAmount ?? 0)}
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Обслужено</span>
                        {log.customersServed ?? 0}
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block">Допродано</span>
                        <span className="text-[#2EA84A] font-medium">{log.successfulUpsells ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-6">
                      <div>
                        <span className="text-xs text-on-surface-variant block mb-1">7 шагов</span>
                        <SevenStepsToggle id={log.id} initial={log.sevenSteps ?? false} />
                      </div>
                      <div>
                        <span className="text-xs text-on-surface-variant block mb-1">Полное обслуживание</span>
                        <FullServiceRating
                          id={log.id}
                          servedCount={log.customersServed ?? 0}
                          initial={log.fullServiceCount ?? 0}
                          initialReasons={parseReasons(log.fullServiceReasons)}
                        />
                      </div>
                    </div>
                  </>
                )}
                {activeType === "COMPLAINT" && (
                  <div className="flex items-center gap-4 text-sm">
                    {log.kind === "COMPLAINT" ? (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold">Жалоба</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">Отзыв</span>
                    )}
                    {log.kind === "REVIEW" && <span className="text-on-surface-variant">Кол-во: {log.count ?? 1}</span>}
                  </div>
                )}
                {activeType === "DISCIPLINE" && (
                  <div className="grid grid-cols-2 gap-x-4 text-sm">
                    <div>
                      <span className="text-xs text-on-surface-variant block">Нарушение</span>
                      {log.violationType || "—"}
                    </div>
                    <div>
                      <span className="text-xs text-on-surface-variant block">Штраф, ₸</span>
                      {fmt(log.fine ?? 0)}
                    </div>
                  </div>
                )}
                {activeType === "REFERRAL" && (
                  <div className="text-sm">
                    <span className="text-xs text-on-surface-variant block">Кол-во</span>
                    {log.count ?? 0}
                  </div>
                )}
                {log.notes && <div className="text-sm text-on-surface-variant">{log.notes}</div>}
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto flex-1">
          <table className="data-table journal-table min-w-full divide-y text-left text-sm">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="py-3 pl-4 pr-3 text-xs font-semibold text-on-surface-variant uppercase">Дата</th>
                <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase">Сотрудник</th>
                {activeType === "UPSELL" && (
                  <>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Продажи, ₸</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Обслужено</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Допродано</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-center">7 шагов</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-center">Полное обслуживание</th>
                  </>
                )}
                {activeType === "COMPLAINT" && (
                  <>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase">Тип</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Кол-во</th>
                  </>
                )}
                {activeType === "DISCIPLINE" && (
                  <>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase">Нарушение</th>
                    <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Штраф, ₸</th>
                  </>
                )}
                {activeType === "REFERRAL" && <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase text-right">Кол-во</th>}
                <th className="px-3 py-3 text-xs font-semibold text-on-surface-variant uppercase">Заметки</th>
                <th className="px-3 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-on-surface-variant">
                    Записей пока нет — добавьте первую.
                  </td>
                </tr>
              ) : (
                visibleLogs.map((log, i) => (
                  <tr key={log.id} className={`h-12 group ${i % 2 === 1 ? "bg-surface-container-low" : ""} hover:bg-gray-50 transition-colors`}>
                    <td className="whitespace-nowrap py-2 pl-4 pr-3">
                      {log.date}
                      {isDayOff(log.employeeId, log.date) && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error align-middle">Выходной</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{empName(log.employeeId)}</td>
                    {activeType === "UPSELL" && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{fmt(log.salesAmount ?? 0)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{log.customersServed ?? 0}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-[#2EA84A] font-medium">{log.successfulUpsells ?? 0}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-center">
                          <SevenStepsToggle id={log.id} initial={log.sevenSteps ?? false} />
                        </td>
                        <td className="px-3 py-2">
                          <FullServiceRating
                            id={log.id}
                            servedCount={log.customersServed ?? 0}
                            initial={log.fullServiceCount ?? 0}
                            initialReasons={parseReasons(log.fullServiceReasons)}
                          />
                        </td>
                      </>
                    )}
                    {activeType === "COMPLAINT" && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2">
                          {log.kind === "COMPLAINT" ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold">Жалоба</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">Отзыв</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{log.kind === "REVIEW" ? log.count ?? 1 : "—"}</td>
                      </>
                    )}
                    {activeType === "DISCIPLINE" && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2">{log.violationType || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{fmt(log.fine ?? 0)}</td>
                      </>
                    )}
                    {activeType === "REFERRAL" && <td className="whitespace-nowrap px-3 py-2 text-right">{log.count ?? 0}</td>}
                    <td className="px-3 py-2 text-on-surface-variant truncate max-w-xs">{log.notes || "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AuditHistoryButton logEntryId={log.id} />
                        <button onClick={() => openEditModal(log)} className="text-on-surface-variant hover:text-primary p-1" title="Редактировать">
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button onClick={() => handleDelete(log.id)} disabled={pending} className="text-on-surface-variant hover:text-error p-1" title="Удалить">
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-surface-container-low border-t border-outline-variant p-4 mt-auto">
          <p className="text-lg font-bold text-on-background text-center">{summary}</p>
        </div>
      </div>

      {modalOpen && (
        <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Запись журнала" className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-background">{editingId ? "Редактировать запись" : "Новая запись"} — {TAB_TITLES[activeType]}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-on-surface-variant hover:text-primary">
                <Icon name="close" className="" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Дата *</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Сотрудник *</label>
                <select
                  required
                  value={form.employeeId}
                  onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                >
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {activeType === "UPSELL" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Обслужено клиентов</label>
                      <input
                        type="number"
                        min={0}
                        value={form.customersServed}
                        onChange={(e) => setForm({ ...form, customersServed: Number(e.target.value) || 0 })}
                        className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Успешные допродажи</label>
                      <input
                        type="number"
                        min={0}
                        value={form.successfulUpsells}
                        onChange={(e) => setForm({ ...form, successfulUpsells: Number(e.target.value) || 0 })}
                        className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.sevenSteps} onChange={(e) => setForm({ ...form, sevenSteps: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm text-on-surface-variant">7 шагов продаж пройдены</span>
                  </label>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Полное обслуживание (из {form.customersServed} обслуженных)</label>
                    <input
                      type="number"
                      min={0}
                      max={form.customersServed}
                      value={form.fullServiceCount}
                      onChange={(e) => setForm({ ...form, fullServiceCount: Math.min(Number(e.target.value) || 0, form.customersServed) })}
                      className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {activeType === "COMPLAINT" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Тип записи</label>
                    <select
                      value={form.kind}
                      onChange={(e) => setForm({ ...form, kind: e.target.value as "REVIEW" | "COMPLAINT" })}
                      className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                    >
                      <option value="REVIEW">Отзыв</option>
                      <option value="COMPLAINT">Жалоба</option>
                    </select>
                  </div>
                  {form.kind === "REVIEW" && (
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Количество отзывов</label>
                      <input
                        type="number"
                        min={1}
                        value={form.count}
                        onChange={(e) => setForm({ ...form, count: Number(e.target.value) || 1 })}
                        className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              )}

              {activeType === "DISCIPLINE" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Тип нарушения</label>
                    <input
                      type="text"
                      placeholder="Опоздание, дресс-код..."
                      value={form.violationType}
                      onChange={(e) => setForm({ ...form, violationType: e.target.value })}
                      className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Штраф, ₸</label>
                    <input
                      type="number"
                      min={0}
                      value={form.fine}
                      onChange={(e) => setForm({ ...form, fine: Number(e.target.value) || 0 })}
                      className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {activeType === "REFERRAL" && (
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Клиентов отправлено на 2 этаж</label>
                  <input
                    type="number"
                    min={0}
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: Number(e.target.value) || 0 })}
                    className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Заметки</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded focus:border-primary"
                />
              </div>

              {formError && <p className="text-sm text-error">{formError}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="h-10 px-4 border border-outline-variant rounded text-sm hover:bg-gray-50">
                  Отмена
                </button>
                <button type="submit" disabled={pending} className="h-10 px-4 bg-primary text-white rounded text-sm hover:opacity-90 disabled:opacity-60">
                  {pending ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div ref={bulkRef} role="dialog" aria-modal="true" aria-label="Массовый ввод за день" className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setBulkOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-background">
                Массовый ввод — {activeType === "COMPLAINT" ? "Отзывы" : "Отправки на 2 этаж"}
              </h3>
              <button onClick={() => setBulkOpen(false)} className="p-1 text-on-surface-variant hover:text-primary">
                <Icon name="close" className="" />
              </button>
            </div>
            <div className="p-6 pb-2">
              <label className="block text-xs text-on-surface-variant mb-1">Дата *</label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => handleBulkDateChange(e.target.value)}
                className="w-full h-10 px-3 border border-outline-variant rounded focus:border-primary"
              />
            </div>
            <div className="px-6 pb-4 overflow-y-auto flex-1">
              <p className="text-xs text-on-surface-variant mb-2">
                {activeType === "COMPLAINT" ? "Количество отзывов на каждого сотрудника за эту дату." : "Сколько клиентов отправлено на 2 этаж за эту дату."}
              </p>
              <div className="divide-y divide-outline-variant border border-outline-variant rounded">
                {activeEmployees.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm truncate">{emp.fullName}</span>
                    <input
                      type="number"
                      min={0}
                      value={bulkCounts[emp.id] ?? 0}
                      onChange={(e) => setBulkCounts((prev) => ({ ...prev, [emp.id]: Number(e.target.value) || 0 }))}
                      className="w-20 h-9 px-2 border border-outline-variant rounded text-sm text-right focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 px-6 pb-6 pt-2 border-t border-outline-variant">
              {bulkError && <p className="text-sm text-error">{bulkError}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setBulkOpen(false)} className="h-10 px-4 border border-outline-variant rounded text-sm hover:bg-gray-50">
                  Отмена
                </button>
                <button onClick={handleBulkSave} disabled={bulkPending} className="h-10 px-4 bg-primary text-white rounded text-sm hover:opacity-90 disabled:opacity-60">
                  {bulkPending ? "Сохраняем..." : "Сохранить всё"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

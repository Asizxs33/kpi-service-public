import Icon from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getEmployeeById, getLogsForEmployee, getSettings, getMonthlyPlans, getDaysOffForEmployee, getCustomMetrics, getCustomMetricEntries } from "@/lib/data";
import CustomKpiSummary from "@/components/CustomKpiSummary";
import { CUSTOM_KPI_COLUMNS, customKpiRows } from "@/lib/custom-kpi-report";
import type { ExportSheet } from "@/lib/export-xlsx";
import { departmentScope } from "@/lib/require-auth";
import { computeKpi, currentMonthKey, initials, weightsList, findPlanAmount } from "@/lib/kpi";
import RevenueTrendChart from "../../dashboard/RevenueTrendChart";
import ProfileExportButton from "./ProfileExportButton";
import SevenStepsToggle from "@/components/SevenStepsToggle";
import FullServiceRating from "@/components/FullServiceRating";
import AuditHistoryButton from "@/components/AuditHistoryButton";

function parseReasons(raw: unknown): Record<number, string> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[Number(k)] = v;
  }
  return out;
}

function formatReasons(raw: unknown): string {
  const reasons = parseReasons(raw);
  if (!reasons) return "";
  return Object.entries(reasons)
    .map(([i, text]) => `${Number(i) + 1}: ${text}`)
    .join("; ");
}

export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const employee = await getEmployeeById(id);
  if (!employee) notFound();
  const scope = departmentScope(session);
  if (scope && !scope.includes(employee.department)) notFound();

  const [logs, settings, plans, daysOff, metrics, metricEntries] = await Promise.all([getLogsForEmployee(id), getSettings(), getMonthlyPlans(), getDaysOffForEmployee(id), getCustomMetrics(), getCustomMetricEntries()]);
  const monthKey = currentMonthKey();
  const daysOffSet = new Set(daysOff.map((d) => d.date));
  const isTodayOff = daysOffSet.has(new Date().toISOString().slice(0, 10));
  const salesTarget = findPlanAmount(plans, monthKey, { employeeId: employee.id });
  const employeeDaysOffDates = daysOff.map((d) => d.date);
  const kpi = computeKpi(employee, logs, settings, salesTarget, undefined, employeeDaysOffDates, { metrics, entries: metricEntries });
  const customRows = customKpiRows(employee.fullName, kpi.custom);
  const weights = [...weightsList(settings).map(w => ({ ...w, weight: w.key === "personal" ? kpi.personalSalesWeight : w.weight })), ...kpi.custom.map(m => ({ key: m.id, label: m.name, color: "bg-primary", weight: m.weight }))];
  const upsellLogs = logs.filter((l) => l.type === "UPSELL");
  const complaintLogs = logs.filter((l) => l.type === "COMPLAINT");
  const disciplineLogs = logs.filter((l) => l.type === "DISCIPLINE");
  const referralLogs = logs.filter((l) => l.type === "REFERRAL");

  // Динамика личных продаж по дням текущего месяца.
  const dailySales = new Map<string, number>();
  upsellLogs.forEach((l) => {
    if (l.date.slice(0, 7) !== monthKey) return;
    dailySales.set(l.date, (dailySales.get(l.date) || 0) + (l.salesAmount || 0));
  });
  const now = new Date();
  const daysSoFar = now.getDate();
  const dailyTrend = Array.from({ length: daysSoFar }, (_, i) => {
    const day = i + 1;
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    return { day, amount: dailySales.get(date) || 0 };
  });

  const exportSheets: ExportSheet[] = [
    {
      name: "Допродажи",
      columns: [
        { header: "Дата", key: "date", width: 12 },
        { header: "Продажи, ₸", key: "sales", width: 14 },
        { header: "Обслужено", key: "served", width: 12 },
        { header: "Допродано", key: "upsold", width: 12 },
        { header: "7 шагов", key: "sevenSteps", width: 10 },
        { header: "Полное обслуживание", key: "fullService", width: 18 },
        { header: "Причины отклонений", key: "fullServiceReasons", width: 30 },
        { header: "Заметки", key: "notes", width: 30 },
      ],
      rows: upsellLogs.map((l) => ({
        date: l.date,
        sales: l.salesAmount ?? 0,
        served: l.customersServed ?? 0,
        upsold: l.successfulUpsells ?? 0,
        sevenSteps: l.sevenSteps ? "Да" : "Нет",
        fullService: `${l.fullServiceCount ?? 0} из ${l.customersServed ?? 0}`,
        fullServiceReasons: formatReasons(l.fullServiceReasons),
        notes: l.notes ?? "",
      })),
    },
    {
      name: "Жалобы и отзывы",
      columns: [
        { header: "Дата", key: "date", width: 12 },
        { header: "Тип", key: "kind", width: 12 },
        { header: "Кол-во", key: "count", width: 10 },
        { header: "Заметки", key: "notes", width: 30 },
      ],
      rows: complaintLogs.map((l) => ({
        date: l.date,
        kind: l.kind === "COMPLAINT" ? "Жалоба" : "Отзыв",
        count: l.kind === "REVIEW" ? l.count ?? 1 : "",
        notes: l.notes ?? "",
      })),
    },
    {
      name: "Дисциплина",
      columns: [
        { header: "Дата", key: "date", width: 12 },
        { header: "Нарушение", key: "violationType", width: 20 },
        { header: "Штраф, ₸", key: "fine", width: 12 },
        { header: "Заметки", key: "notes", width: 30 },
      ],
      rows: disciplineLogs.map((l) => ({
        date: l.date,
        violationType: l.violationType ?? "",
        fine: l.fine ?? 0,
        notes: l.notes ?? "",
      })),
    },
    {
      name: "Отправки на 2 этаж",
      columns: [
        { header: "Дата", key: "date", width: 12 },
        { header: "Кол-во", key: "count", width: 10 },
        { header: "Заметки", key: "notes", width: 30 },
      ],
      rows: referralLogs.map((l) => ({ date: l.date, count: l.count ?? 0, notes: l.notes ?? "" })),
    },
  ];

  if (customRows.length) exportSheets.push({ name: "Дополнительные KPI", columns: CUSTOM_KPI_COLUMNS, rows: customRows });
  const kpiLabel = kpi.total >= 95 ? "Отлично" : kpi.total >= 85 ? "Хорошо" : kpi.total >= 75 ? "Средне" : "Низко";
  const circumference = 282.7;
  const dashOffset = circumference * (1 - kpi.total / 100);

  function fmt(n: number) {
    return `₸${n.toLocaleString("ru-RU")}`;
  }

  return (
    <>
      <Topbar title="Профиль сотрудника" userName={session?.user?.name ?? ""} />
      <main className="profile-page flex-1 overflow-y-auto p-6">
        <div className="max-w-container-max mx-auto w-full flex flex-col gap-6">
          <div className="profile-breadcrumb flex items-center gap-2 text-on-surface-variant text-sm">
            <Link href="/employees" className="flex items-center hover:text-primary">
              <Icon name="arrow_back" className="text-[18px]" />
            </Link>
            <Link href="/employees" className="hover:text-primary">
              Сотрудники
            </Link>
            <Icon name="chevron_right" className="text-[16px]" />
            <span className="text-primary font-medium">{employee.fullName}</span>
            <div className="ml-auto">
              <ProfileExportButton fullName={employee.fullName} sheets={exportSheets} />
            </div>
          </div>

              <div className="profile-hero bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-6">
                  <div className="profile-avatar w-20 h-20 rounded-2xl bg-surface-container-highest flex items-center justify-center text-primary text-2xl font-bold border border-outline-variant">
                    {initials(employee.fullName)}
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-on-surface mb-1">{employee.fullName}</h1>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-on-surface-variant">{employee.position}</p>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">{employee.department}</span>
                      {!employee.active && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-error-container text-error">Неактивен</span>}
                      {isTodayOff && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-error-container text-error">Сегодня выходной</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-on-surface-variant mb-1 uppercase">Общий KPI</p>
                    <p className="text-lg font-bold text-secondary">{kpiLabel}</p>
                  </div>
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle className="stroke-surface-container-high" cx="50" cy="50" fill="none" r="45" strokeWidth="8" />
                      <circle
                        className="stroke-secondary transition-all duration-1000 ease-out"
                        cx="50"
                        cy="50"
                        fill="none"
                        r="45"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        strokeWidth="8"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-on-surface">{kpi.total}%</span>
                    </div>
                  </div>
                </div>
              </div>

          <div className="profile-metrics">
            {[
              { label: "Продажи за месяц", value: fmt(kpi.raw.totalSales), icon: "payments", tone: "blue" },
              { label: "Обслужено клиентов", value: kpi.raw.totalServed.toLocaleString("ru-RU"), icon: "group", tone: "purple" },
              { label: "Средний чек", value: fmt(kpi.raw.totalServed > 0 ? Math.round(kpi.raw.totalSales / kpi.raw.totalServed) : 0), icon: "point_of_sale", tone: "green" },
              { label: "Жалобы за месяц", value: String(kpi.raw.complaintsCount), icon: "receipt_long", tone: "amber" },
            ].map(item => <section key={item.label} className="profile-metric" data-tone={item.tone}><span className="color-icon"><Icon name={item.icon} /></span><div><p>{item.label}</p><strong>{item.value}</strong></div></section>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 min-w-0 flex flex-col gap-5">
              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <h3 className="text-lg font-bold text-on-surface">Структура KPI</h3>
                <div className="w-full h-3 flex rounded-full overflow-hidden border border-outline-variant mt-2">
                  {weights.map((w) => (
                    <div key={w.key} className={`${w.color} h-full`} style={{ width: `${w.weight}%` }} title={`${w.label}: ${w.weight}%`} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2 text-sm text-on-surface-variant">
                  {weights.map((w) => (
                    <div key={w.key} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${w.color}`} />
                      <span>
                        {w.label} ({w.weight}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <CustomKpiSummary rows={customRows} />
                <h3 className="text-lg font-bold text-on-surface">Динамика продаж по дням</h3>
                {dailyTrend.every((d) => d.amount === 0) ? (
                  <p className="text-sm text-on-surface-variant">Нет данных за текущий месяц.</p>
                ) : (
                  <RevenueTrendChart data={dailyTrend} monthLabel={now.toLocaleString("ru-RU", { month: "long" })} />
                )}
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface">Дневной журнал допродаж</h3>
                  <Link href="/logs" className="bg-primary-container text-on-primary text-xs font-bold uppercase px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
                    <Icon name="add" className="text-[16px]" />
                    Добавить запись
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table sticky-name-table w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Дата</th>
                        <th className="py-3 px-4 text-right">Продажи</th>
                        <th className="py-3 px-4 text-right">Обслужено</th>
                        <th className="py-3 px-4 text-right">Допродано</th>
                        <th className="py-3 px-4">7 шагов</th>
                        <th className="py-3 px-4">Полное обслуживание</th>
                        <th className="py-3 px-4">Заметки</th>
                        <th className="py-3 px-4 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {upsellLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-on-surface-variant">
                            Записей пока нет.
                          </td>
                        </tr>
                      ) : (
                        upsellLogs.map((log, i) => (
                          <tr key={log.id} className={`border-b border-outline-variant ${i % 2 === 1 ? "bg-surface" : ""}`}>
                            <td className="py-3 px-4 text-on-surface font-medium">
                              {log.date}
                              {daysOffSet.has(log.date) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error align-middle">Выходной</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">{fmt(log.salesAmount ?? 0)}</td>
                            <td className="py-3 px-4 text-right">{log.customersServed ?? 0}</td>
                            <td className="py-3 px-4 text-right">{log.successfulUpsells ?? 0}</td>
                            <td className="py-3 px-4">
                              <SevenStepsToggle id={log.id} initial={log.sevenSteps ?? false} />
                            </td>
                            <td className="py-3 px-4">
                              <FullServiceRating
                                id={log.id}
                                servedCount={log.customersServed ?? 0}
                                initial={log.fullServiceCount ?? 0}
                                initialReasons={parseReasons(log.fullServiceReasons)}
                              />
                            </td>
                            <td className="py-3 px-4 text-on-surface-variant">{log.notes || "—"}</td>
                            <td className="py-3 px-4 text-right">
                              <AuditHistoryButton logEntryId={log.id} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface">Жалобы и отзывы</h3>
                  <Link href="/logs" className="bg-primary-container text-on-primary text-xs font-bold uppercase px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
                    <Icon name="add" className="text-[16px]" />
                    Добавить запись
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table sticky-name-table w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Дата</th>
                        <th className="py-3 px-4">Тип</th>
                        <th className="py-3 px-4 text-right">Кол-во</th>
                        <th className="py-3 px-4">Заметки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complaintLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                            Записей пока нет.
                          </td>
                        </tr>
                      ) : (
                        complaintLogs.map((log, i) => (
                          <tr key={log.id} className={`border-b border-outline-variant ${i % 2 === 1 ? "bg-surface" : ""}`}>
                            <td className="py-3 px-4 text-on-surface font-medium">
                              {log.date}
                              {daysOffSet.has(log.date) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error align-middle">Выходной</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {log.kind === "COMPLAINT" ? (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold">Жалоба</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">Отзыв</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">{log.kind === "REVIEW" ? log.count ?? 1 : "—"}</td>
                            <td className="py-3 px-4 text-on-surface-variant">{log.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface">Нарушения дисциплины</h3>
                  <Link href="/logs" className="bg-primary-container text-on-primary text-xs font-bold uppercase px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
                    <Icon name="add" className="text-[16px]" />
                    Добавить запись
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table sticky-name-table w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Дата</th>
                        <th className="py-3 px-4">Нарушение</th>
                        <th className="py-3 px-4 text-right">Штраф</th>
                        <th className="py-3 px-4">Заметки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplineLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-on-surface-variant">
                            Записей пока нет.
                          </td>
                        </tr>
                      ) : (
                        disciplineLogs.map((log, i) => (
                          <tr key={log.id} className={`border-b border-outline-variant ${i % 2 === 1 ? "bg-surface" : ""}`}>
                            <td className="py-3 px-4 text-on-surface font-medium">
                              {log.date}
                              {daysOffSet.has(log.date) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error align-middle">Выходной</span>
                              )}
                            </td>
                            <td className="py-3 px-4">{log.violationType || "—"}</td>
                            <td className="py-3 px-4 text-right">{fmt(log.fine ?? 0)}</td>
                            <td className="py-3 px-4 text-on-surface-variant">{log.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-on-surface">Отправки на 2 этаж</h3>
                  <Link href="/logs" className="bg-primary-container text-on-primary text-xs font-bold uppercase px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
                    <Icon name="add" className="text-[16px]" />
                    Добавить запись
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table sticky-name-table w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant text-on-surface-variant text-xs font-semibold uppercase">
                        <th className="py-3 px-4">Дата</th>
                        <th className="py-3 px-4 text-right">Кол-во</th>
                        <th className="py-3 px-4">Заметки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralLogs.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-on-surface-variant">
                            Записей пока нет.
                          </td>
                        </tr>
                      ) : (
                        referralLogs.map((log, i) => (
                          <tr key={log.id} className={`border-b border-outline-variant ${i % 2 === 1 ? "bg-surface" : ""}`}>
                            <td className="py-3 px-4 text-on-surface font-medium">
                              {log.date}
                              {daysOffSet.has(log.date) && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error align-middle">Выходной</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">{log.count ?? 0}</td>
                            <td className="py-3 px-4 text-on-surface-variant">{log.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 min-w-0 flex flex-col gap-5">
              <div className="bg-surface-container-lowest border border-outline-variant p-6 rounded-xl flex flex-col gap-6">
                <h3 className="text-lg font-bold text-on-surface">Цели и факт</h3>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-medium text-on-surface">Продажи за месяц</span>
                    <span className="text-on-surface-variant">
                      <strong className="text-on-surface">{fmt(kpi.raw.totalSales)}</strong> / {fmt(salesTarget)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary-container rounded-full" style={{ width: `${kpi.personal}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-medium text-on-surface">Отзывы</span>
                    <span className="text-on-surface-variant">
                      <strong className="text-on-surface">{kpi.raw.reviewsCount}</strong> / {kpi.raw.reviewsTarget} ({kpi.reviewsPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: `${kpi.reviewsPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-medium text-on-surface">Отправки на 2 этаж</span>
                    <span className="text-on-surface-variant">
                      <strong className="text-on-surface">{kpi.raw.referralsCount}</strong> / {kpi.raw.referralsTarget} ({kpi.referralsPct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary-fixed-dim rounded-full" style={{ width: `${kpi.referralsPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-end text-sm">
                    <span className="font-medium text-on-surface">Дисциплина</span>
                    <span className="text-on-surface-variant">
                      <strong className="text-on-surface">{kpi.discipline}%</strong> / 100%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary-fixed-dim rounded-full" style={{ width: `${kpi.discipline}%` }} />
                  </div>
                </div>
              </div>

              <div className="profile-insight bg-surface text-on-surface border border-outline-variant p-6 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-10">
                  <Icon name="military_tech" className="text-[100px]" />
                </div>
                <h4 className="text-lg font-bold relative z-10">Результат месяца</h4>
                <p className="text-sm opacity-80 relative z-10">
                  {kpi.total >= 90
                    ? `${employee.fullName} показывает высокий KPI (${kpi.total}%) за текущий месяц.`
                    : `${employee.fullName} — текущий KPI ${kpi.total}%, план продаж ${fmt(salesTarget)}.`}
                </p>
              </div>
            </div>
          </div>

          <div className="h-8 w-full" />
        </div>
      </main>
    </>
  );
}

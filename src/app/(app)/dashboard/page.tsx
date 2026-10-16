import PeriodPicker from "./PeriodPicker";
import MetricSparkline from "@/components/MetricSparkline";
import RevenueCard from "@/components/RevenueCard";
import Icon from "@/components/Icon";
import Link from "next/link";
import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getEmployees, getAllLogs, getSettings, getStoreDailyRevenue, getMonthlyPlans, getDaysOff, getStoreDailyDebt, getCustomMetrics, getCustomMetricEntries } from "@/lib/data";
import { ticketResults } from "@/lib/custom-kpi-report";
import { departmentScope } from "@/lib/require-auth";
import { computeKpi, initials, planMonthKey, findPlanAmount, dailyPlanAmount, isFullMonthRange, daysInRangeInclusive } from "@/lib/kpi";
import DashboardExportButton from "./DashboardExportButton";
import RevenueTrendChart from "./RevenueTrendChart";
import SyncButton from "./SyncButton";
import ResultsTable, { type ResultsTableRow } from "./ResultsTable";
import { WHOLESALE_DEPARTMENT } from "@/lib/departments";

function statusBadge(kpi: number) {
  if (kpi >= 95) return { label: "Топ", cls: "bg-[#2EA84A]/10 text-[#2EA84A]" };
  if (kpi >= 85) return { label: "Хорошо", cls: "bg-[#2EA84A]/10 text-[#2EA84A]" };
  if (kpi >= 75) return { label: "Средне", cls: "bg-tertiary-fixed-dim/20 text-on-surface" };
  return { label: "Низко", cls: "bg-error-container text-error" };
}

// Серверное действие «Полная синхронизация» вызывает бота по одному дню;
// день может занять до минуты.
export const maxDuration = 60;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ department?: string; from?: string; to?: string }> }) {
  const session = await auth();
  const scope = departmentScope(session);
  const { department: departmentParam, from, to } = await searchParams;
  // scope — отделы, доступные РОП (может быть несколько). Явно выбранная
  // вкладка (departmentParam) допускается только если входит в scope;
  // если scope не задан (ADMIN/MANAGER) — допускается любая. Если scope
  // сужен ровно до одного отдела и вкладка не выбрана — сразу показываем
  // его (без смысла показывать переключатель вкладок из одного пункта).
  const department =
    departmentParam && (!scope || scope.includes(departmentParam))
      ? departmentParam
      : scope && scope.length === 1
        ? scope[0]
        : undefined;
  const range = from && to ? { from, to } : undefined;
  const [employees, logs, settings, dailyRevenue, plans, daysOff, storeDailyDebt, metrics, metricEntries] = await Promise.all([
    getEmployees(),
    getAllLogs(),
    getSettings(),
    getStoreDailyRevenue(),
    getMonthlyPlans(),
    getDaysOff(),
    getStoreDailyDebt(),
    getCustomMetrics(), getCustomMetricEntries(),
  ]);
  const allDepartments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const departments = scope ? allDepartments.filter((d) => scope.includes(d)) : allDepartments;
  // Детский отдел — отдельный магазин (своя выручка, свои продавцы), поэтому на
  // вкладке «Все отделы» он не подмешивается в общие цифры Розница —
  // только через собственную вкладку «Детский отдел».
  const active = employees.filter(
    (e) => e.active && (department ? e.department === department : (!scope || scope.includes(e.department)) && e.department !== "Детский отдел")
  );

  const kpiMonthKey = planMonthKey(range);
  // Подпись периода для экспорта (PDF/Excel) — «Отчёт за <месяц год>» для
  // всего месяца (не выбран период или выбран месяц целиком), иначе
  // «Отчёт за DD.MM.YYYY» (один день) / «Отчёт за DD.MM.YYYY – DD.MM.YYYY»
  // (произвольный диапазон короче месяца).
  function formatRu(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  }
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const monthName = (mk: string) => new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)) - 1, 1).toLocaleString("ru-RU", { month: "long", year: "numeric" });
  const reportPeriodLabel = !range
    ? `Отчёт за ${monthName(kpiMonthKey)} (${formatRu(`${kpiMonthKey}-01`)} – ${formatRu(todayDateStr)})`
    : isFullMonthRange(range, kpiMonthKey)
      ? `Отчёт за ${monthName(kpiMonthKey)} (${formatRu(range.from)} – ${formatRu(range.to)})`
      : range.from === range.to
        ? `Отчёт за ${formatRu(range.from)}`
        : `Отчёт за ${formatRu(range.from)} – ${formatRu(range.to)}`;
  const results = active.map((emp) => {
    const employeeDaysOff = daysOff.filter((d) => d.employeeId === emp.id).map((d) => d.date);
    // «План, ₸» — всегда полный план на месяц (как на странице «Планы»),
    // без пересчёта под выбранный период: явное решение, при коротком
    // периоде «% плана» ожидаемо выглядит заниженным (продажи за часть
    // месяца против плана на весь месяц), но так плана нигде не «плывёт».
    const plan = findPlanAmount(plans, kpiMonthKey, { employeeId: emp.id });
    // Сколько выходных реально отмечено в текущем месяце — справочно, в
    // экспорт (не влияет на план и не влияет на норму отзывов/2 этажа,
    // у которой фиксированная квота, см. workingDaysForPeriod в lib/kpi.ts).
    const daysOffThisMonthCount = employeeDaysOff.filter((d) => d.slice(0, 7) === kpiMonthKey).length;
    return { emp, plan, daysOffThisMonthCount, kpi: computeKpi(emp, logs, settings, plan, range, employeeDaysOff, { metrics, entries: metricEntries }) };
  });
  const wholesalePlan = findPlanAmount(plans, kpiMonthKey, { department: WHOLESALE_DEPARTMENT });
  const wholesaleSales = results.filter(r => r.emp.department === WHOLESALE_DEPARTMENT).reduce((sum, r) => sum + r.kpi.raw.totalSales, 0);

  const totals = results.reduce(
    (acc, r) => {
      acc.sales += r.kpi.raw.totalSales;
      acc.served += r.kpi.raw.totalServed;
      acc.disciplineSum += r.kpi.discipline;
      return acc;
    },
    { sales: 0, served: 0, disciplineSum: 0 }
  );
  const n = results.length || 1;
  const avgCheck = totals.served > 0 ? Math.round(totals.sales / totals.served) : 0;
  const disciplineAvg = Math.round(totals.disciplineSum / n);

  let reviewsSum = 0;
  let referralSum = 0;
  results.forEach(({ kpi }) => {
    reviewsSum += kpi.reviewsPct;
    referralSum += kpi.referralsPct;
  });
  const reviewsAvg = Math.round(reviewsSum / n);
  const referralAvg = Math.round(referralSum / n);

  const teamAvg = results.length ? Math.round(results.reduce((s, r) => s + r.kpi.total, 0) / results.length) : 0;
  const buckets = { top: 0, good: 0, avg: 0, low: 0 };
  results.forEach(({ kpi }) => {
    if (kpi.total >= 95) buckets.top++;
    else if (kpi.total >= 85) buckets.good++;
    else if (kpi.total >= 75) buckets.avg++;
    else buckets.low++;
  });
  const pTop = (buckets.top / n) * 100;
  const pGood = (buckets.good / n) * 100;
  const pAvg = (buckets.avg / n) * 100;
  const c1 = pTop;
  const c2 = c1 + pGood;
  const c3 = c2 + pAvg;
  const donutBg =
    results.length === 0
      ? "conic-gradient(#e5e2e1 0% 100%)"
      : `conic-gradient(#2EA84A 0% ${c1}%, #85fb92 ${c1}% ${c2}%, #ffb955 ${c2}% ${c3}%, #ba1a1a ${c3}% 100%)`;

  const periodNote = range ? `за ${range.from} — ${range.to}, по журналам` : "за текущий месяц, по журналам";

  const cards: { title: string; value: string; note: string; subNote?: string; icon: string }[] = [
    { title: "Обслужено клиентов", value: totals.served.toLocaleString("ru-RU"), note: periodNote, icon: "receipt" },
    { title: "Средний чек", value: `₸ ${avgCheck.toLocaleString("ru-RU")}`, note: "продажи / обслужено клиентов", icon: "point_of_sale" },
  ];

  // Продажи по дням текущего месяца (для активных сотрудников текущего
  // фильтра-отдела) — используется для "Выручка сегодня"/прогноза, которые
  // всегда о текущем месяце независимо от выбранного диапазона дат.
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysSoFar = now.getDate();
  const activeIds = new Set(active.map((e) => e.id));
  const dailySales = new Map<string, number>();
  logs.forEach((l) => {
    if (l.type !== "UPSELL" || !activeIds.has(l.employeeId) || l.date.slice(0, 7) !== monthKey) return;
    dailySales.set(l.date, (dailySales.get(l.date) || 0) + (l.salesAmount || 0));
  });
  // Выручка сегодня — отдельно от месячного итога.
  const todayStr = `${monthKey}-${String(daysSoFar).padStart(2, "0")}`;
  const todayRevenue = dailySales.get(todayStr) || 0;
  // Бейдж «Выходной» у сотрудника в таблице результатов — про выбранный
  // период фильтра, а не жёстко про сегодня: если выбран диапазон дат
  // (например, конкретный прошлый/будущий день), проверяем выходные
  // внутри него; без диапазона (текущий месяц) — как раньше, про сегодня.
  // Бейдж «Выходной» имеет смысл только для ОДНОГО конкретного дня (по
  // умолчанию — сегодня, либо явно выбранный однодневный диапазон дат) —
  // «выходной когда-то внутри широкого периода» вводит в заблуждение
  // (почти у каждого есть хотя бы 1-3 выходных за месяц, из-за чего при
  // выборе всего месяца бейдж загорался почти у всех). Для многодневного
  // диапазона бейдж не показываем вовсе.
  const periodFrom = range?.from ?? todayStr;
  const periodTo = range?.to ?? todayStr;
  const todayOffEmployeeIds =
    periodFrom === periodTo ? new Set(daysOff.filter((d) => d.date === periodFrom).map((d) => d.employeeId)) : new Set<string>();

  // Данные для графика "Динамика выручки по дням" — показывает выбранный
  // диапазон дат, если он задан, иначе текущий месяц по сегодняшний день.
  function enumerateDays(fromStr: string, toStr: string): string[] {
    const days: string[] = [];
    const cur = new Date(`${fromStr}T00:00:00`);
    const end = new Date(`${toStr}T00:00:00`);
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }
  const chartDates = range ? enumerateDays(range.from, range.to) : Array.from({ length: daysSoFar }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
  const chartSales = new Map<string, number>();
  logs.forEach((l) => {
    if (l.type !== "UPSELL" || !activeIds.has(l.employeeId)) return;
    if (range ? l.date < range.from || l.date > range.to : l.date.slice(0, 7) !== monthKey) return;
    chartSales.set(l.date, (chartSales.get(l.date) || 0) + (l.salesAmount || 0));
  });
  const dailyTrend = chartDates.map((date) => ({ day: Number(date.slice(8, 10)), amount: chartSales.get(date) || 0 }));

  const servedByDate = new Map<string, number>();
  logs.forEach((log) => {
    if (log.type === "UPSELL" && activeIds.has(log.employeeId)) servedByDate.set(log.date, (servedByDate.get(log.date) ?? 0) + (log.customersServed ?? 0));
  });
  const metricTrends = [
    dailyTrend.map(d => d.amount),
    chartDates.map(date => servedByDate.get(date) ?? 0),
    chartDates.map(date => { const served = servedByDate.get(date) ?? 0; return served > 0 ? Math.round((chartSales.get(date) ?? 0) / served) : 0; }),
  ];

  // Прогноз к концу месяца — линейная экстраполяция по текущему темпу
  // (сумма за месяц / прошедшие дни * дней в месяце). Считается по
  // текущему календарному месяцу всегда, независимо от выбранного
  // диапазона дат (totals.sales выше может отражать другой период).
  const monthlySalesTotal = Array.from(dailySales.values()).reduce((s, v) => s + v, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const forecastRevenue = daysSoFar > 0 ? Math.round((monthlySalesTotal / daysSoFar) * daysInMonth) : 0;

  // Топ/анти-топ дня — по личным продажам за сегодня среди активных
  // сотрудников текущего фильтра-отдела.
  const todayByEmployee = new Map<string, number>();
  logs.forEach((l) => {
    if (l.type !== "UPSELL" || !activeIds.has(l.employeeId) || l.date !== todayStr) return;
    todayByEmployee.set(l.employeeId, (todayByEmployee.get(l.employeeId) || 0) + (l.salesAmount || 0));
  });
  const todayEntries = Array.from(todayByEmployee.entries()).filter(([, amt]) => amt > 0);
  const empNameById = (id: string) => active.find((e) => e.id === id)?.fullName ?? "—";
  const topToday = todayEntries.length ? todayEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const bottomToday = todayEntries.length ? todayEntries.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;
  const showBottomToday = bottomToday && topToday && bottomToday[0] !== topToday[0];

  // «Выручка сегодня» — точная выручка магазина целиком за сегодня (как в
  // отчёте UMAG), а не сумма по отслеживаемым сотрудникам, если для этого
  // отдела есть store_daily_revenue за сегодня; иначе (Колл-центр, или пока
  // бот не синхронизировал сегодняшний день) — запасной вариант, сумма по
  // сотрудникам.
  const todayStoreDept = department === "Детский отдел" ? "Детский отдел" : department === "Розница" || !department ? "Розница" : null;
  const todayStoreRow = todayStoreDept ? dailyRevenue.find((d) => d.department === todayStoreDept && d.date === todayStr) : undefined;
  const todayRevenueDisplay = todayStoreRow ? todayStoreRow.amount : todayRevenue;
  // Долг — сумма ещё не оплаченных продаж (накладные с остатком) в составе
  // выручки за сегодня; «чистая» — выручка без долга, реальные деньги в
  // кассе. Считается только там, где есть данные UMAG (todayStoreRow) —
  // запасной вариант по журналам долг не отслеживает.
  const todayDebt = todayStoreRow?.debtAmount ?? 0;
  const todayNet = todayRevenueDisplay - todayDebt;

  cards.push(
    {
      title: "Выручка сегодня",
      value: `₸ ${todayRevenueDisplay.toLocaleString("ru-RU")}`,
      note: todayStoreRow ? "по данным UMAG за сегодня" : "по журналам за сегодня",
      subNote: todayDebt > 0 ? `минус долг ₸${todayDebt.toLocaleString("ru-RU")} = чистая ₸${todayNet.toLocaleString("ru-RU")}` : undefined,
      icon: "today",
    },
    { title: "Прогноз к концу месяца", value: `₸ ${forecastRevenue.toLocaleString("ru-RU")}`, note: "по текущему темпу продаж", icon: "trending_up" }
  );

  // Общая выручка отдела (Розница/Детский отдел) — факт тянется ботом напрямую из
  // UMAG за точку целиком (все каналы, включая неоплаченные продажи — как
  // в отчёте UMAG "Прибыль/убытки"), а НЕ суммой личных продаж сотрудников
  // (та отдельно показана в карточке «Общие продажи» и не включает
  // неразнесённые по сотрудникам продажи). Долговые накладные уже входят
  // в личные продажи после синхронизации; долг повторно не прибавляем.
  // Следует выбранному периоду в фильтре: если период не выбран — месяц
  // текущий по сегодня; если выбран (например, другой месяц целиком или
  // один день) — план и факт берутся за этот период, а не за текущий месяц.
  const revenueMonthKey = range ? range.from.slice(0, 7) : monthKey;
  const revenueFrom = range ? range.from : `${monthKey}-01`;
  const revenueTo = range ? range.to : todayStr;

  function sumDailyRevenue(dept: string) {
    return dailyRevenue.filter((d) => d.department === dept && d.date >= revenueFrom && d.date <= revenueTo).reduce((s, d) => s + d.amount, 0);
  }

  // Долг — сумма ещё не оплаченных продаж за выбранный период (та же
  // логика, что и в карточке «Выручка сегодня»).
  function sumDailyDebt(dept: string) {
    return dailyRevenue.filter((d) => d.department === dept && d.date >= revenueFrom && d.date <= revenueTo).reduce((s, d) => s + d.debtAmount, 0);
  }

  const totalRevenueActual = sumDailyRevenue("Розница");
  const totalRevenueDebt = sumDailyDebt("Розница");
  const totalRevenuePlan = findPlanAmount(plans, revenueMonthKey, { department: "Розница" });
  const totalRevenuePct = totalRevenuePlan > 0 ? Math.round((totalRevenueActual / totalRevenuePlan) * 100) : 0;

  const kidsOnlinePlan = findPlanAmount(plans, revenueMonthKey, { department: "Детский отдел" });
  const kidsRevenueActual = sumDailyRevenue("Детский отдел");
  const kidsRevenueDebt = sumDailyDebt("Детский отдел");
  const kidsOnlinePct = kidsOnlinePlan > 0 ? Math.round((kidsRevenueActual / kidsOnlinePlan) * 100) : 0;

  // Разбивка долга (по клику на "Минус долг" в карточке): кто должен и
  // сколько — те же строки, что в «Отчёте для WhatsApp» кассового сайта
  // (долги продавца «Сардор К» одной суммой, остальные по контрагентам).
  // Строки берутся из store_daily_debt, их пишет полная синхронизация; за
  // дни, где её не было, остаток показывается строкой «Нет разбивки».
  function debtBreakdown(dept: string, totalDebt: number) {
    const sums = new Map<string, number>();
    for (const row of storeDailyDebt) {
      if (row.department !== dept || row.date < revenueFrom || row.date > revenueTo) continue;
      sums.set(row.name, (sums.get(row.name) ?? 0) + row.amount);
    }
    const items = Array.from(sums.entries())
      .map(([fullName, amount]) => ({ fullName, amount }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const assigned = items.reduce((s, x) => s + x.amount, 0);
    const rest = totalDebt - assigned;
    if (rest > 0) items.push({ fullName: "Нет разбивки (нажмите «Полная синхронизация»)", amount: rest });
    return items;
  }

  const totalRevenueDebtBreakdown = debtBreakdown("Розница", totalRevenueDebt);
  const kidsRevenueDebtBreakdown = debtBreakdown("Детский отдел", kidsRevenueDebt);

  // Сравнение «год к году»: те же даты на год раньше. Выручка точки не
  // зависит от продавцов; по сотрудникам берутся только те, кто работает
  // сейчас и найден среди продавцов UMAG (см. backfill_history.py в боте).
  // null = за тот период в базе ничего нет (не показываем «0» как факт).
  const yearAgo = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
  const lastYearFrom = yearAgo(revenueFrom);
  const lastYearTo = yearAgo(revenueTo);
  function sumLastYearRevenue(dept: string) {
    const rows = dailyRevenue.filter((d) => d.department === dept && d.date >= lastYearFrom && d.date <= lastYearTo);
    return rows.length ? rows.reduce((s, d) => s + d.amount, 0) : null;
  }
  const totalRevenueLastYear = sumLastYearRevenue("Розница");
  const kidsRevenueLastYear = sumLastYearRevenue("Детский отдел");
  const lastYearSalesByEmployee = new Map<string, number>();
  for (const l of logs) {
    if (l.type === "UPSELL" && l.date >= lastYearFrom && l.date <= lastYearTo) {
      lastYearSalesByEmployee.set(l.employeeId, (lastYearSalesByEmployee.get(l.employeeId) ?? 0) + (l.salesAmount ?? 0));
    }
  }

  const showRetailBanner = (!department || department === "Розница") && (!scope || scope.includes("Розница"));
  const showKidsBanner = (!department || department === "Детский отдел") && (!scope || scope.includes("Детский отдел"));
  // «Отзывы» и «2 этаж» — метрики розничного зала 1 этажа (Розница), норма
  // 2/2 в день не применима к колл-центру и Детский отдел (нет физического «2 этажа»
  // и отзывов в этом смысле), поэтому карточки для них не показываем.
  const showReviewsReferralCards = (!department || department === "Розница") && (!scope || scope.includes("Розница"));

  function dashboardHref(deptOverride?: string) {
    const params = new URLSearchParams();
    if (deptOverride) params.set("department", deptOverride);
    if (range) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    const qs = params.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  }

  function dashboardHrefNoRange(deptOverride?: string) {
    const params = new URLSearchParams();
    if (deptOverride) params.set("department", deptOverride);
    const qs = params.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  }

  const exportRows = results.map(({ emp, plan, daysOffThisMonthCount, kpi }) => {
    const avgCheckRow = kpi.raw.totalServed > 0 ? Math.round(kpi.raw.totalSales / kpi.raw.totalServed) : 0;
    const dailyPlan = dailyPlanAmount(plan, kpiMonthKey);
    // «Отклонение»/«% плана» сравниваются с полным месячным планом, если
    // период не выбран ИЛИ выбранный период — это ровно весь календарный
    // месяц целиком (1-е число по последний день). Если же выбран
    // конкретный день или произвольный диапазон короче месяца —
    // сравнение идёт с дневным планом, умноженным на число дней в этом
    // диапазоне (для одного дня — просто дневной план).
    const comparisonPlan = isFullMonthRange(range, kpiMonthKey) ? plan : dailyPlan * (range ? daysInRangeInclusive(range) : 1);
    const planPct = comparisonPlan > 0 ? Math.round((kpi.raw.totalSales / comparisonPlan) * 100) : 0;
    return {
      fullName: emp.fullName,
      department: emp.department,
      dayOff: todayOffEmployeeIds.has(emp.id) ? "Выходной" : "",
      daysOffCount: daysOffThisMonthCount,
      plan,
      dailyPlan,
      sales: kpi.raw.totalSales,
      lastYear: lastYearSalesByEmployee.get(emp.id) ?? null,
      deviation: kpi.raw.totalSales - comparisonPlan,
      planPct,
      served: kpi.raw.totalServed,
      avgCheck: avgCheckRow,
      reviews: kpi.raw.reviewsCount,
      reviewsPct: kpi.reviewsPct,
      complaints: kpi.raw.complaintsCount,
      referrals: kpi.raw.referralsCount,
      referralsPct: kpi.referralsPct,
      ...ticketResults(kpi.custom),
      discipline: kpi.discipline,
      kpi: kpi.total,
      status: statusBadge(kpi.total).label,
    };
  });

  const tableRows: ResultsTableRow[] = results.map(({ emp, plan, daysOffThisMonthCount, kpi }) => {
    const badge = statusBadge(kpi.total);
    const dailyPlan = dailyPlanAmount(plan, kpiMonthKey);
    const comparisonPlan = isFullMonthRange(range, kpiMonthKey) ? plan : dailyPlan * (range ? daysInRangeInclusive(range) : 1);
    const planPct = comparisonPlan > 0 ? Math.round((kpi.raw.totalSales / comparisonPlan) * 100) : 0;
    return {
      id: emp.id,
      fullName: emp.fullName,
      department: emp.department,
      dayOff: todayOffEmployeeIds.has(emp.id),
      daysOffCount: daysOffThisMonthCount,
      plan,
      dailyPlan,
      deviation: kpi.raw.totalSales - comparisonPlan,
      planPct,
      sales: kpi.raw.totalSales,
      lastYear: lastYearSalesByEmployee.get(emp.id) ?? null,
      served: kpi.raw.totalServed,
      avgCheck: kpi.raw.totalServed > 0 ? Math.round(kpi.raw.totalSales / kpi.raw.totalServed) : 0,
      reviews: kpi.raw.reviewsCount,
      reviewsPct: kpi.reviewsPct,
      complaints: kpi.raw.complaintsCount,
      referrals: kpi.raw.referralsCount,
      referralsPct: kpi.referralsPct,
      ...ticketResults(kpi.custom),
      discipline: kpi.discipline,
      kpi: kpi.total,
      statusLabel: badge.label,
      statusCls: badge.cls,
    };
  });

  const forecastPlan = active.reduce((sum, employee) => sum + findPlanAmount(plans, monthKey, { employeeId: employee.id }), 0);
  const forecastPercent = forecastPlan > 0 ? Math.round(forecastRevenue / forecastPlan * 100) : 0;
  const forecastProgress = Math.max(0, Math.min(100, forecastPercent));

  return (
    <>
      <Topbar title="KPI Дашборд" userName={session?.user?.name ?? ""} />
      <main className="dashboard-page flex-1 max-w-container-max mx-auto w-full flex flex-col gap-4">
        <div className="dashboard-title"><div><h1>KPI Дашборд</h1><p>Актуальные показатели вашей команды</p></div><PeriodPicker department={department} from={range?.from} to={range?.to} monthLabel={now.toLocaleString("ru-RU", { month: "long", year: "numeric" })} resetHref={dashboardHrefNoRange(department)} /></div>
        {departments.length > 1 && (
          <div className="department-tabs">
            <Link
              href={dashboardHref()}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${!department ? "bg-primary text-on-primary border-primary" : "bg-surface border-outline-variant text-on-surface-variant hover:border-primary"}`}
            >
              Все отделы
            </Link>
            {departments.map((d) => (
              <Link
                key={d}
                href={dashboardHref(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${department === d ? "bg-primary text-on-primary border-primary" : "bg-surface border-outline-variant text-on-surface-variant hover:border-primary"}`}
              >
                {d}
              </Link>
            ))}
          </div>
        )}



        {(showRetailBanner || showKidsBanner) && <div className={showRetailBanner && showKidsBanner ? "grid grid-cols-1 lg:grid-cols-2 gap-5" : "grid grid-cols-1"}>
          {showRetailBanner && <RevenueCard department="Розница" actual={totalRevenueActual} plan={totalRevenuePlan} debt={totalRevenueDebt} percent={totalRevenuePct} debtBreakdown={totalRevenueDebtBreakdown} lastYear={totalRevenueLastYear} lastYearLabel={`${lastYearFrom.split("-").reverse().join(".")} – ${lastYearTo.split("-").reverse().join(".")}`} />}
          {showKidsBanner && <RevenueCard department="Детский отдел" actual={kidsRevenueActual} plan={kidsOnlinePlan} debt={kidsRevenueDebt} percent={kidsOnlinePct} debtBreakdown={kidsRevenueDebtBreakdown} lastYear={kidsRevenueLastYear} lastYearLabel={`${lastYearFrom.split("-").reverse().join(".")} – ${lastYearTo.split("-").reverse().join(".")}`} />}
        </div>}

        {department === WHOLESALE_DEPARTMENT && <section className="bg-white border border-outline-variant rounded-xl p-5">
          <h2 className="text-lg font-bold">Оптовый отдел — план на месяц</h2>
          <p className="text-2xl font-bold mt-2">₸ {wholesaleSales.toLocaleString("ru-RU")}</p>
          <p className="text-sm text-on-surface-variant mt-1">{wholesalePlan > 0 ? `из ₸ ${wholesalePlan.toLocaleString("ru-RU")} (${Math.round(wholesaleSales / wholesalePlan * 100)}%)` : "План отдела пока не задан"} · продажи сотрудников отдела за выбранный период</p>
          <Link href="/plans" className="inline-block text-primary text-sm font-semibold mt-3">Перейти к планам продаж</Link>
        </section>}
        <div className="summary-grid">
          {cards.filter(c => c.icon !== "trending_up").map((c, index) => (
            <section key={c.title} className="summary-card" data-tone={["purple", "blue", "green", "amber"][index]}>
              <div className="summary-heading"><span className="color-icon"><Icon name={c.icon} /></span><h2>{c.title}</h2></div>
              <div className="summary-value">{c.value}</div>
              <p className="summary-note">{c.note}</p>
              {c.subNote && <p className="summary-detail">{c.subNote}</p>}
              {index < 3 && <MetricSparkline values={metricTrends[index]} />}
            </section>
          ))}
        </div>

        <div className="analytics-grid">
          <section className="analytics-chart dashboard-panel">
            <div className="panel-heading"><h2>Динамика выручки</h2><span className="chart-legend"><i />По журналам</span></div>
            <p className="panel-subtitle">{range ? range.from + " — " + range.to : "По дням текущего месяца"}</p>
            {dailyTrend.every(d => d.amount === 0) ? <div className="chart-empty"><Icon name="trending_up" /><p>Нет продаж за выбранный период</p></div> : <RevenueTrendChart data={dailyTrend} monthLabel={(range ? new Date(range.to) : now).toLocaleString("ru-RU", { month: "long" })} />}
          </section>

          <section className="forecast-panel dashboard-panel">
            <div className="panel-heading"><h2>Прогноз к концу месяца</h2></div>
            <div className="forecast-ring" style={{ background: "conic-gradient(from -90deg, #246bff 0%, #37c6ef " + forecastProgress + "%, #eaf0fc " + forecastProgress + "% 100%)" }}>
              <div><strong>₸ {forecastRevenue.toLocaleString("ru-RU")}</strong><span>Прогноз выручки</span></div>
            </div>
            <div className="forecast-caption"><span>План команды</span><strong>₸ {forecastPlan.toLocaleString("ru-RU")}</strong></div>
            <p className="panel-subtitle">{forecastPlan > 0 ? forecastPercent + "% плана при текущем темпе" : "Месячный план не задан"}</p>
          </section>

          <div className="quality-stack">
            {showReviewsReferralCards && <section className="dashboard-panel goal-panel">
              <div className="panel-heading"><h2>Отзывы к цели</h2><Icon name="star_rate" className="text-[#f4ba48]" /></div>
              <strong className="goal-value">{reviewsAvg}%</strong><div className="goal-track"><div style={{ width: reviewsAvg + "%" }} /></div>
              <div className="goal-secondary"><span>Отправки на 2 этаж</span><strong>{referralAvg}%</strong></div>
            </section>}
            <section className="dashboard-panel goal-panel">
              <div className="panel-heading"><h2>Дисциплина команды</h2><Icon name="verified_user" className="text-primary" /></div>
              <strong className="goal-value">{disciplineAvg}%</strong><div className="goal-track goal-track--blue"><div style={{ width: disciplineAvg + "%" }} /></div>
              <p className="panel-subtitle">За выбранный период</p>
            </section>
          </div>
        </div>

        <div className="day-highlights">
          <div><span className="color-icon"><Icon name="military_tech" /></span><div><span>Топ дня</span><strong>{topToday ? empNameById(topToday[0]) : "Нет продаж сегодня"}</strong></div>{topToday && <b>₸ {topToday[1].toLocaleString("ru-RU")}</b>}</div>
          {showBottomToday && <div><Icon name="trending_down" /><div><span>Анти-топ дня</span><strong>{empNameById(bottomToday![0])}</strong></div><b>₸ {bottomToday![1].toLocaleString("ru-RU")}</b></div>}
        </div>

        <div className="flex flex-col xl:flex-row gap-8 pb-8">
          <div className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-lg font-bold text-on-surface">Результаты по сотрудникам</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <SyncButton from={range?.from ?? `${monthKey}-01`} to={range?.to ?? todayStr} />
                <DashboardExportButton department={department} rows={exportRows} period={reportPeriodLabel} />
              </div>
            </div>
            {/* Десктоп/планшет — таблица, с переключателем видимости столбцов */}
            <ResultsTable rows={tableRows} teamAvg={teamAvg} department={department} />

            {/* Мобильный — карточки вместо горизонтально скроллящейся таблицы */}
            <div className="md:hidden divide-y divide-outline-variant">
              {results.length === 0 ? (
                <div className="p-6 text-center text-sm text-on-surface-variant">Нет активных сотрудников. Добавьте сотрудника на странице «Сотрудники».</div>
              ) : (
                <>
                  <div className="p-4 bg-primary/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs shrink-0">СР</div>
                      <span className="font-semibold text-sm">Среднее по команде</span>
                    </div>
                    <span className="font-bold text-primary">{teamAvg}%</span>
                  </div>
                  {results.map(({ emp, kpi }) => {
                    const tickets = ticketResults(kpi.custom);
                    const avgCheckRow = kpi.raw.totalServed > 0 ? Math.round(kpi.raw.totalSales / kpi.raw.totalServed) : 0;
                    const badge = statusBadge(kpi.total);
                    return (
                      <div key={emp.id} className="p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 min-w-0 hover:text-primary">
                            <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center text-xs font-bold shrink-0">
                              {initials(emp.fullName)}
                            </div>
                            <span className="font-semibold truncate">{emp.fullName}</span>
                          </Link>
                          <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        </div>
                        {todayOffEmployeeIds.has(emp.id) && (
                          <span className="self-start px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-error-container text-error">Выходной</span>
                        )}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div>
                            <span className="text-xs text-on-surface-variant block">Продажи ₸</span>
                            {kpi.raw.totalSales.toLocaleString("ru-RU")}
                          </div>
                          <div>
                            <span className="text-xs text-on-surface-variant block">Обслужено</span>
                            {kpi.raw.totalServed}
                          </div>
                          <div>
                            <span className="text-xs text-on-surface-variant block">Ср. чек</span>
                            {avgCheckRow.toLocaleString("ru-RU")}
                          </div>
                          {emp.department !== WHOLESALE_DEPARTMENT && <><div>
                            <span className="text-xs text-on-surface-variant block">Отзывы</span>
                            {kpi.raw.reviewsCount} <span className={kpi.reviewsPct < 100 ? "text-error font-medium" : "text-on-surface-variant"}>({kpi.reviewsPct}%)</span>
                          </div>
                          <div>
                            <span className="text-xs text-on-surface-variant block">Жалобы</span>
                            {kpi.raw.complaintsCount > 0 ? <span className="text-error font-medium">{kpi.raw.complaintsCount}</span> : 0}
                          </div>
                          <div>
                            <span className="text-xs text-on-surface-variant block">2 этаж</span>
                            {kpi.raw.referralsCount} <span className={kpi.referralsPct < 100 ? "text-error font-medium" : "text-on-surface-variant"}>({kpi.referralsPct}%)</span>
                          </div></>}
                          <div>
                            <span className="text-xs text-on-surface-variant block">Дисциплина</span>
                            {kpi.discipline}%
                          </div>
                          {emp.department !== WHOLESALE_DEPARTMENT && <><div>
                            <span className="text-xs text-on-surface-variant block">Билеты</span>
                            {tickets.tickets === null ? "—" : tickets.tickets.toLocaleString("ru-RU")}
                          </div>
                          <div>
                            <span className="text-xs text-on-surface-variant block">Билеты, %</span>
                            <span className={tickets.ticketsPct !== null && tickets.ticketsPct < 100 ? "text-error font-medium" : ""}>{tickets.ticketsPct === null ? "—" : `${tickets.ticketsPct.toLocaleString("ru-RU")}%`}</span>
                          </div></>}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                          <span className="text-xs text-on-surface-variant">KPI</span>
                          <span className="font-bold text-primary text-lg">{kpi.total}%</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          <aside className="w-full xl:w-80 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col shadow-sm">
            <h3 className="text-lg font-bold text-on-surface mb-6 border-b border-outline-variant pb-2">Распределение KPI по команде</h3>
            <div className="flex-1 flex flex-col items-center justify-center min-h-[250px] relative">
              <div className="w-48 h-48 rounded-full flex items-center justify-center relative" style={{ background: donutBg }}>
                <div className="w-32 h-32 bg-surface-container-lowest rounded-full flex flex-col items-center justify-center shadow-inner">
                  <span className="text-3xl font-bold text-primary">{teamAvg}%</span>
                  <span className="text-xs text-outline">Средний KPI</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-[#2EA84A]" />
                  <span>Топ (95-100%)</span>
                </div>
                <span className="font-semibold">{buckets.top}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-secondary-fixed" />
                  <span>Хорошо (85-94%)</span>
                </div>
                <span className="font-semibold">{buckets.good}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-tertiary-fixed-dim" />
                  <span>Средне (75-84%)</span>
                </div>
                <span className="font-semibold">{buckets.avg}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-error" />
                  <span>Низко (&lt;75%)</span>
                </div>
                <span className="font-semibold">{buckets.low}</span>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

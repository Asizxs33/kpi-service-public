import assert from "node:assert/strict";
import { computeKpi, DEFAULT_WEIGHTS } from "../src/lib/kpi";
import { validateMetric, validateMetricBudget, type CustomMetric, type CustomMetricEntry } from "../src/lib/custom-kpi";
import { CUSTOM_KPI_COLUMNS, customKpiRows, ticketResults } from "../src/lib/custom-kpi-report";
import { buildExportWorkbook, buildPrintHtml } from "../src/lib/export-xlsx";
import type { Employee, LogEntry } from "../src/generated/prisma/client";

async function main() {
  const employee: Employee = { id: "alice", fullName: "Консультант", department: "Розница", position: "Консультант", email: null, hireDate: null, active: true, createdAt: new Date() };
  const makeLog = (overrides: Partial<LogEntry>): LogEntry => ({
    id: "log", type: "UPSELL", date: "2026-10-10", employeeId: employee.id,
    notes: null, source: null, salesAmount: null, customersServed: null, successfulUpsells: null,
    sevenSteps: null, fullServiceCount: null, fullServiceReasons: null, kind: null,
    violationType: null, fine: null, count: null, createdAt: new Date(), ...overrides,
  });
  const logs = [
    makeLog({ salesAmount: 1000, customersServed: 2, fullServiceCount: 2 }),
    makeLog({ type: "COMPLAINT", kind: "REVIEW", count: 4 }),
    makeLog({ type: "REFERRAL", count: 4 }),
  ];
  const metric: CustomMetric = { id: "tickets", name: "Билеты на розыгрыш", dailyTarget: 2, weight: 5, departments: ["Розница"], startsOn: "2026-10-10", endsOn: null };
  const range = { from: "2026-10-10", to: "2026-10-11" };
  const calculate = (entries: CustomMetricEntry[], who = employee, metrics = [metric], daysOff: string[] = []) => computeKpi(who, logs, DEFAULT_WEIGHTS, 1000, range, daysOff, { metrics, entries, today: "2026-10-11" });
  const fact = (date: string, amount: number, employeeId = "alice") => ({ metricId: "tickets", employeeId, date, amount });

  assert.equal(computeKpi(employee, logs, DEFAULT_WEIGHTS, 1000, range).total, 100);
  assert.equal(calculate([]).total, 95);
  assert.equal(calculate([]).personalSalesWeight, 25);
  assert.equal(calculate([fact(range.from, 2), fact(range.to, 2)]).total, 100);
  const half = calculate([fact(range.from, 4), fact(range.to, 0)]);
  assert.equal(half.custom[0].score, 50); // Overperformance does not erase a missed day.
  assert.equal(half.custom[0].shortfall, 2);
  assert.deepEqual(ticketResults(half.custom), { tickets: 4, ticketsPct: 50 });
  assert.deepEqual(ticketResults([]), { tickets: null, ticketsPct: null });
  assert.deepEqual(ticketResults([...half.custom, { ...half.custom[0], name: "Другая норма", actual: 100 }]), { tickets: 4, ticketsPct: 50 });
  assert.equal(half.total, 98); // Existing overall KPI uses whole-number rounding.
  assert.equal(calculate([fact(range.from, 2)], employee, [metric], [range.to]).total, 100);
  assert.equal(calculate([], employee, [metric], [range.from, range.to]).custom.length, 0);
  assert.equal(calculate([fact(range.from, 2, "bob"), fact(range.to, 2, "bob")]).total, 95);
  assert.equal(calculate([], employee, [{ ...metric, startsOn: "2026-11-01" }]).total, 100);
  assert.equal(calculate([], employee, [{ ...metric, endsOn: "2026-10-09", startsOn: "2026-10-01" }]).total, 100);
  const kids = { ...employee, department: "Детский отдел" };
  assert.equal(calculate([], kids).total, computeKpi(kids, logs, DEFAULT_WEIGHTS, 1000, range).total);
  validateMetric(metric);
  assert.throws(() => validateMetric({ ...metric, weight: NaN }));
  assert.throws(() => validateMetric({ ...metric, dailyTarget: 1.5 }));
  assert.throws(() => validateMetric({ ...metric, departments: [] }));
  assert.throws(() => validateMetricBudget([metric], 4));
  assert.throws(() => validateMetricBudget([metric, { ...metric, id: "second", weight: 26 }], 30));
  validateMetricBudget([metric, { ...metric, id: "second", weight: 30, departments: ["Детский отдел"] }], 30);

  const rows = customKpiRows(employee.fullName, half.custom);
  assert.equal(rows[0].points, 2.5);
  assert.equal(rows[0].lostPoints, 2.5);
  const sheet = { name: "Дополнительные KPI", columns: CUSTOM_KPI_COLUMNS, rows };
  const book = await buildExportWorkbook([sheet]);
  assert.equal(book.worksheets[0].getCell("H6").value, 2.5);
  assert.equal(book.worksheets[0].getCell("H6").numFmt, "0.##");
  assert.equal(book.worksheets[0].getCell("I6").value, 2.5);
  assert.ok(buildPrintHtml("KPI", [sheet]).includes("Билеты на розыгрыш"));
  console.log("Custom KPI checks passed: individual scope, 5% allocation, strict daily targets, dates, days off, validation and exports.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });

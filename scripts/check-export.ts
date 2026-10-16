import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildExportWorkbook, buildPrintHtml, printSections, type ExportSheet } from "../src/lib/export-xlsx";

async function main() {
  const report: ExportSheet = {
    name: "Результаты",
    columns: [
      { header: "Сотрудник", key: "fullName", width: 28 },
      { header: "Продажи, ₸", key: "sales" },
      { header: "KPI %", key: "kpi" },
      { header: "Отклонение", key: "deviation" },
      ...Array.from({ length: 15 }, (_, i) => ({ header: `Показатель ${i}`, key: `metric${i}` })),
    ],
    rows: [{ fullName: '<Иван & "Анна">', sales: 1234567, kpi: 85, deviation: -500, metric0: 0, metric1: "=1+1", metric2: "Длинный комментарий\nВторая строка" }],
  };
  const workbook = await buildExportWorkbook([report, { ...report, rows: [] }], { subtitle: "Период: 2026-09" }, new Date("2026-09-05T12:00:00Z"));
  // Serialize and reload: validate the file that Excel receives, not only builder state.
  const bytes = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(bytes);
  const sheet = restored.worksheets[0];
  assert.equal(sheet.getCell("B6").value, 1234567);
  assert.equal(sheet.getCell("C6").value, 85);
  assert.equal(sheet.getCell("C6").numFmt, '0"%"');
  assert.equal(sheet.getCell("D6").value, -500);
  assert.equal(sheet.getCell("E6").value, 0);
  assert.equal(sheet.getCell("F6").value, "=1+1");
  assert.equal(sheet.getCell("A5").value, "Сотрудник");
  assert.ok(sheet.getCell("A2").text.includes("2026-09"));
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(restored.worksheets[1].getCell("A6").value, "Нет данных за выбранный период");
  assert.notEqual(restored.worksheets[0].name, restored.worksheets[1].name);
  const sections = printSections(report);
  assert.equal(sections.length, 1);
  assert.deepEqual(sections[0].columns, report.columns);
  const html = buildPrintHtml("Отчёт <тест>", [report], { subtitle: "Период: 2026-09" });
  assert.ok(html.includes("Отчёт &lt;тест&gt;"));
  assert.ok(html.includes("&lt;Иван &amp; &quot;Анна&quot;&gt;"));
  assert.ok(html.includes("85%"));
  assert.ok(!html.includes("Часть 2 из 2"));
  assert.ok(!html.includes("Записей:"));
  assert.ok(html.includes("A4 landscape"));
  console.log("Export checks passed: XLSX round trip, numeric types, formats, frozen headers, empty sheets, complete PDF columns and escaped content.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });

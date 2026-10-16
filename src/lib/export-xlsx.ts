export type ExportColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
  render?: (value: unknown, row: Record<string, unknown>) => string;
  align?: "left" | "right" | "center";
};
export type ExportSheet = { name: string; columns: ExportColumn[]; rows: Record<string, unknown>[]; subtitle?: string };
export type ExportOptions = { title?: string; subtitle?: string };

const BLUE = "FF245BDC";
const INK = "FF172747";
function isPercent(column: ExportColumn) { return column.header.includes("%") || /Pct$/.test(column.key); }
function isMoney(column: ExportColumn) { return column.header.includes("₸") || column.key === "deviation"; }

export async function buildExportWorkbook(sheets: ExportSheet[], options: ExportOptions = {}, createdAt = new Date()) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "KPI Service";
  workbook.created = createdAt;
  workbook.title = options.title ?? "KPI Service — отчёт";
  const usedNames = new Set<string>();
  for (const source of sheets) {
    const base = source.name.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31) || "Отчёт";
    let name = base, suffix = 1;
    while (usedNames.has(name)) { const tail = " " + (++suffix); name = base.slice(0, 31 - tail.length) + tail; }
    usedNames.add(name);
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: 1, ySplit: 5, showGridLines: false }], properties: { defaultRowHeight: 28 } });
    const n = source.columns.length;
    if (!n) continue;
    sheet.columns = source.columns.map(column => ({ key: column.key, width: column.width ?? 16 }));
    for (let r = 1; r <= 3; r++) if (n > 1) sheet.mergeCells(r, 1, r, n);
    sheet.getCell(1, 1).value = "KPI SERVICE  /  " + (options.title ?? source.name);
    sheet.getRow(1).height = 38;
    sheet.getCell(1, 1).font = { name: "Calibri", size: 19, bold: true, color: { argb: INK } };
    sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAF1FF" } };
    sheet.getCell(1, 1).alignment = { vertical: "middle", indent: 1 };
    sheet.getCell(2, 1).value = [source.name, source.subtitle ?? options.subtitle].filter(Boolean).join(" · ");
    sheet.getCell(3, 1).value = "Сформировано: " + createdAt.toLocaleString("ru-RU") + " · Записей: " + source.rows.length;
    for (const r of [2, 3]) {
      sheet.getCell(r, 1).font = { name: "Calibri", size: 11, color: { argb: "FF637697" } };
      sheet.getCell(r, 1).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    }
    sheet.getRow(2).height = 32;
    sheet.getRow(4).height = 9;
    const header = sheet.getRow(5);
    header.values = source.columns.map(column => column.header);
    header.height = 36;
    header.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    });
    source.rows.forEach((record, index) => {
      const row = sheet.getRow(index + 6);
      let lines = 1;
      source.columns.forEach((column, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        const value = record[column.key];
        cell.value = typeof value === "number" && Number.isFinite(value) ? value : typeof value === "boolean" ? (value ? "Да" : "Нет") : String(value ?? "");
        cell.font = { name: "Calibri", size: 11, color: { argb: INK }, bold: colIndex === 0 || column.key === "kpi" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFF4F7FC" : "FFFFFFFF" } };
        cell.border = { bottom: { style: "hair", color: { argb: "FFE2E9F4" } } };
        cell.alignment = { vertical: "middle", wrapText: true, horizontal: column.align ?? (typeof value === "number" ? "right" : "left"), indent: 1 };
        if (typeof value === "number") {
          cell.numFmt = column.numFmt ?? (isPercent(column) ? '0"%"' : isMoney(column) ? '#,##0" ₸";[Red](#,##0)" ₸";0" ₸"' : '#,##0');
          if (column.key === "deviation") cell.font = { ...cell.font, bold: true, color: { argb: value < 0 ? "FFAE4949" : "FF078259" } };
        }
        const status = String(value ?? "");
        let tone: "green" | "amber" | "red" | undefined;
        if (column.key === "kpi" && typeof value === "number") tone = value >= 85 ? "green" : value >= 75 ? "amber" : "red";
        if (column.key === "status") tone = ["Топ", "Хорошо", "Активен"].includes(status) ? "green" : status === "Средне" ? "amber" : ["Низко", "Неактивен"].includes(status) ? "red" : undefined;
        if (tone) {
          const colors = { green: ["FFE8F7EF", "FF087C53"], amber: ["FFFFF5DF", "FF926419"], red: ["FFFFEEEE", "FFA7464E"] }[tone];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors[0] } };
          cell.font = { ...cell.font, bold: true, color: { argb: colors[1] } };
        }
        const chunks = String(value ?? "").split("\n");
        lines = Math.max(lines, chunks.reduce((sum, chunk) => sum + Math.max(1, Math.ceil(chunk.length / Math.max(8, (column.width ?? 16) - 2))), 0));
      });
      row.height = Math.max(28, Math.min(409, lines * 16 + 10));
    });
    if (!source.rows.length) { if (n > 1) sheet.mergeCells(6, 1, 6, n); sheet.getCell(6, 1).value = "Нет данных за выбранный период"; sheet.getCell(6, 1).font = { color: { argb: "FF7486A5" }, italic: true }; }
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, source.rows.length + 5), column: n } };
    sheet.pageSetup = { paperSize: 9, orientation: n > 5 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:5", printArea: "A1:" + sheet.getCell(Math.max(6, source.rows.length + 5), n).address, margins: { left: .25, right: .25, top: .35, bottom: .35, header: .15, footer: .15 } };
    sheet.headerFooter.oddFooter = "&LKPI Service · мониторинг&RСтраница &P из &N";
  }
  return workbook;
}

async function downloadWorkbook(workbook: import("exceljs").Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[<>:"/\\|?*]/g, "_");
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportToExcel(filename: string, sheetName: string, columns: ExportColumn[], rows: Record<string, unknown>[], options: ExportOptions = {}) {
  await downloadWorkbook(await buildExportWorkbook([{ name: sheetName, columns, rows }], options), filename);
}
export async function exportMultiSheetExcel(filename: string, sheets: ExportSheet[], options: ExportOptions = {}) {
  await downloadWorkbook(await buildExportWorkbook(sheets, options), filename);
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function cellHtml(col: ExportColumn, row: Record<string, unknown>): string {
  if (col.render) return col.render(row[col.key], row);
  const value = row[col.key];
  return typeof value === "number" ? escapeHtml(value.toLocaleString("ru-RU")) + (isPercent(col) ? "%" : "") : escapeHtml(value);
}

export function printSections(sheet: ExportSheet) {
  return [sheet];
}

export function buildPrintHtml(title: string, sheets: ExportSheet[], options: ExportOptions = {}, createdAt = new Date()) {
  const landscape = sheets.some(sheet => sheet.columns.length > 5);
  // Размер шрифта растёт, когда колонок меньше: ширина страницы делится на
  // число колонок (≈115/n), в пределах 6.5–12.5px.
  const colCount = Math.max(1, ...sheets.map(sheet => sheet.columns.length));
  const fontPx = Math.round(Math.max(6.5, Math.min(12.5, 115 / colCount + 0.5)) * 2) / 2;
  const tables = sheets.flatMap(sheet => {
    const sections = printSections(sheet);
    return sections.map(section => `<section class="report-section"><div class="section-heading"><h2>${escapeHtml(section.name)}</h2></div>${section.subtitle ? `<p class="subtitle">${escapeHtml(section.subtitle)}</p>` : ""}<div class="table-wrap"><table><thead><tr>${section.columns.map(column => `<th class="al-${column.align ?? "left"}">${escapeHtml(column.header)}</th>`).join("")}</tr></thead><tbody>${section.rows.length ? section.rows.map(row => `<tr>${section.columns.map(column => `<td class="al-${column.align ?? (typeof row[column.key] === "number" ? "right" : "left")}">${cellHtml(column, row)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${section.columns.length}" class="empty">Нет данных за выбранный период</td></tr>`}</tbody></table></div></section>`);
  }).join("");
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{font-family:"Segoe UI",Arial,sans-serif;margin:0;color:#10182f;background:#e8edf6;font-size:12px}.report{max-width:1500px;margin:28px auto;background:#fff;padding:30px;border:1px solid #cbd5e6;border-radius:16px;box-shadow:0 18px 50px #1b2d4d1a}header{background:linear-gradient(135deg,#101d3b,#183b78);color:#fff;padding:22px 26px;margin:-30px -30px 24px;border-radius:15px 15px 0 0}.brand{font-weight:800;letter-spacing:2px;font-size:14px;color:#8db7ff}h1{font-size:25px;letter-spacing:-.6px;margin:10px 0 6px}.subtitle,.date{color:#c4d2ea;font-size:12px}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 10px}h2{font-size:15px;margin:0;color:#111c38}.table-wrap{width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:${fontPx}px;table-layout:fixed}th{background:#172b55;color:#fff;font-weight:600;text-align:left}th,td{padding:${colCount > 9 ? "7px 4px" : "9px 8px"};border:1px solid #ccd6e7;overflow-wrap:anywhere;white-space:pre-wrap}td{vertical-align:top;color:#182542}tbody tr:nth-child(even){background:#edf2f9}thead{display:table-header-group}tr{break-inside:avoid}.al-right{text-align:right;font-variant-numeric:tabular-nums}.al-center{text-align:center}.empty{text-align:center;color:#637697;padding:30px}.badge{display:inline-block;padding:3px 6px;border-radius:6px;font-size:.85em;font-weight:700}.badge-green{background:#d7f1e4;color:#056644}.badge-amber{background:#f9e7bb;color:#75500e}.badge-red{background:#f6d9dc;color:#8d3038}.pos{color:#056f4a;font-weight:700}.neg{color:#9e303b;font-weight:700}.report-section+.report-section{margin-top:28px;break-before:page}.toolbar{display:flex;justify-content:flex-end;gap:12px;margin-bottom:15px}.toolbar button{border:0;border-radius:9px;background:#163f90;color:white;padding:10px 18px;cursor:pointer;font:inherit}.toolbar p{margin:0;align-self:center;color:#526582}footer{margin-top:20px;color:#5f718e;font-size:10px}@page{size:A4 ${landscape ? "landscape" : "portrait"};margin:8mm}@media print{body{background:white}.report{margin:0;padding:0;max-width:none;border:0;border-radius:0;box-shadow:none}header{margin:0 0 18px;border-radius:0}.toolbar{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}table{font-size:${fontPx}px}@media screen and (max-width:700px){.report{margin:10px;padding:16px}.report header{margin:-16px -16px 20px}.table-wrap{overflow-x:auto}table{min-width:1100px}}
  </style></head><body><main class="report"><div class="toolbar"><p>В окне печати выберите «Сохранить как PDF»</p><button id="print-button" type="button">Печать / PDF</button></div><header><div class="brand">KPI SERVICE</div><h1>${escapeHtml(title)}</h1>${options.subtitle ? `<p class="subtitle">${escapeHtml(options.subtitle)}</p>` : ""}<p class="date">${escapeHtml(createdAt.toLocaleString("ru-RU"))}</p></header>${tables}<footer>KPI Service · мониторинг результатов</footer></main></body></html>`;
}
export function exportToPdf(title: string, sheets: ExportSheet[], options: ExportOptions = {}) {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Разрешите открытие нового окна для экспорта PDF");
  win.document.write(buildPrintHtml(title, sheets, options));
  win.document.close();
  win.document.getElementById("print-button")?.addEventListener("click", () => win.print());
  win.focus();
  // Leave a readable preview open; printing starts only when the user is ready.
}

import { CUSTOM_KPI_COLUMNS, type CustomKpiReportRow } from "@/lib/custom-kpi-report";

export default function CustomKpiSummary({ rows }: { rows: CustomKpiReportRow[] }) {
  if (!rows.length) return null;
  return <section className="border border-outline-variant bg-white rounded-xl overflow-hidden">
    <div className="p-4 border-b border-outline-variant">
      <h2 className="font-bold text-lg">Дополнительные показатели KPI</h2>
      <p className="text-sm text-on-surface-variant mt-1">Норма учитывает рабочие дни с даты введения по сегодняшний день в выбранном периоде. Недобор считается отдельно за каждый день.</p>
    </div>
    <div className="overflow-x-auto"><table className="w-full text-sm text-left">
      <thead><tr>{CUSTOM_KPI_COLUMNS.map(c => <th key={c.key} className="p-3 whitespace-nowrap">{c.header}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index} className="border-t border-outline-variant">{CUSTOM_KPI_COLUMNS.map(c => {
        const value = row[c.key as keyof CustomKpiReportRow];
        const alert = (c.key === "shortfall" || c.key === "lostPoints" || c.key === "missingDays") && Number(value) > 0;
        return <td key={c.key} className={`p-3 ${alert ? "text-error font-semibold" : ""}`}>{typeof value === "number" ? value.toLocaleString("ru-RU", { maximumFractionDigits: 2 }) : value}</td>;
      })}</tr>)}</tbody>
    </table></div>
    <p className="px-4 py-3 text-xs text-outline">Баллы входят в общий KPI сотрудника. Потеря показывает разницу с полным выполнением этого показателя. Дни без ввода считаются нулевым фактом; сегодняшний день обновляется по мере ввода.</p>
  </section>;
}

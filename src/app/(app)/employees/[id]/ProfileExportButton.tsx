"use client";

import { useState } from "react";
import { useFeedback } from "@/components/FeedbackProvider";
import Icon from "@/components/Icon";


import { exportMultiSheetExcel, exportToPdf, type ExportSheet } from "@/lib/export-xlsx";

export default function ProfileExportButton({ fullName, sheets }: { fullName: string; sheets: ExportSheet[] }) {
  const notify = useFeedback();
  const [exporting, setExporting] = useState(false);
  const options = { title: fullName, subtitle: "Журналы сотрудника · Все даты" };
  async function handleExportExcel() {
    setExporting(true);
    try { await exportMultiSheetExcel(`${fullName}_${new Date().toISOString().slice(0, 10)}.xlsx`, sheets, options); notify("Excel готов"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось создать Excel", true); } finally { setExporting(false); }
  }

  function handleExportPdf() {
    try { exportToPdf(fullName, sheets, options); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось открыть PDF", true); }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleExportExcel} disabled={exporting} className="bg-surface-container-high text-on-surface text-xs font-bold uppercase px-4 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2">
        <Icon name="download" className="text-[16px]" />
        {exporting ? "Подготовка…" : "Excel"}
      </button>
      <button onClick={handleExportPdf} className="bg-surface-container-high text-on-surface text-xs font-bold uppercase px-4 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2">
        <Icon name="picture_as_pdf" className="text-[16px]" />
        PDF
      </button>
    </div>
  );
}

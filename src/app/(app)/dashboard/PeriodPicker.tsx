import Link from "next/link";
import Icon from "@/components/Icon";

export default function PeriodPicker({ department, from, to, monthLabel, resetHref }: { department?: string; from?: string; to?: string; monthLabel: string; resetHref: string }) {
  const formatDate = (date: string) => date.split("-").reverse().join(".");
  return <details className="period-picker">
    <summary className="period-shortcut"><Icon name="today" /><span>Период<strong>{from && to ? `${formatDate(from)} — ${formatDate(to)}` : monthLabel}</strong></span><Icon name="chevron_right" className="ml-auto rotate-90 text-[16px]" /></summary>
    <form action="/dashboard" method="get" className="period-popover">
      {department && <input type="hidden" name="department" value={department} />}
      <label>Начало периода<input type="date" name="from" required defaultValue={from ?? ""} className="w-full border border-outline-variant p-2 mt-1 text-sm" /></label>
      <label>Конец периода<input type="date" name="to" required defaultValue={to ?? ""} className="w-full border border-outline-variant p-2 mt-1 text-sm" /></label>
      <button type="submit" className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold">Показать</button>
      {from && to && <Link href={resetHref} className="text-primary text-sm self-center">Текущий месяц</Link>}
    </form>
  </details>;
}

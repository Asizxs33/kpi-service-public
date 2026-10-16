"use client";

import type { CustomMetric } from "@/lib/custom-kpi";

const inputClass = "w-full border border-outline-variant rounded-lg px-3 py-2 text-sm bg-white";

export default function CustomMetricEditor({ metrics, departments, today, personalWeight, disabled, onChange }: {
  metrics: CustomMetric[]; departments: string[]; today: string; personalWeight: number;
  disabled: boolean; onChange: (metrics: CustomMetric[]) => void;
}) {
  function update(id: string, values: Partial<CustomMetric>) {
    onChange(metrics.map(metric => metric.id === id ? { ...metric, ...values } : metric));
  }
  function add(tickets: boolean) {
    onChange([...metrics, {
      id: `new:${crypto.randomUUID()}`, name: tickets ? "Билеты на розыгрыш" : "",
      dailyTarget: tickets ? 2 : 1, weight: 5,
      departments: departments.includes("Розница") ? ["Розница"] : departments.slice(0, 1),
      startsOn: today, endsOn: null,
    }]);
  }
  return <section className="mt-6 bg-surface border border-outline-variant rounded-xl p-4 sm:p-6 space-y-5">
    <div>
      <h2 className="text-lg font-bold">Дополнительные показатели KPI</h2>
      <p className="text-sm text-on-surface-variant mt-1">Создавайте ежедневные нормы для сотрудников выбранных отделов. Вес выделяется из доли «Личный результат» ({personalWeight}%), общая сумма остаётся 100%.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={() => add(false)} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50">+ Добавить показатель</button>
      <button type="button" disabled={disabled} onClick={() => add(true)} className="px-4 py-2 rounded-lg border border-primary text-primary text-sm font-semibold disabled:opacity-50">Билеты: 2 в день · 5%</button>
    </div>
    {metrics.length === 0 && <p className="text-sm text-outline">Показателей пока нет. Для розыгрыша используйте готовый пример выше и сохраните изменения.</p>}
    {metrics.map(metric => <fieldset disabled={disabled} key={metric.id} className="border border-outline-variant rounded-xl p-4 space-y-4 disabled:opacity-60">
      <legend className="px-2 text-sm font-semibold">{metric.name || "Новый показатель"}{metric.endsOn && metric.endsOn < today ? " · Завершён" : metric.startsOn > today ? " · Запланирован" : ""}</legend>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm sm:col-span-2">Название<input aria-label="Название показателя" value={metric.name} maxLength={100} onChange={e => update(metric.id, { name: e.target.value })} className={inputClass} placeholder="Например, билеты на розыгрыш" /></label>
        <label className="text-sm">Норма на рабочий день<input type="number" min={1} max={100000} step={1} value={metric.dailyTarget} onChange={e => update(metric.id, { dailyTarget: Number(e.target.value) })} className={inputClass} /></label>
        <label className="text-sm">Вес в общем KPI, %<input type="number" min={1} max={personalWeight} step={1} value={metric.weight} onChange={e => update(metric.id, { weight: Number(e.target.value) })} className={inputClass} /></label>
        <label className="text-sm">Действует с<input type="date" value={metric.startsOn} onChange={e => update(metric.id, { startsOn: e.target.value })} className={inputClass} /></label>
        <label className="text-sm">Действует по (необязательно)<input type="date" min={metric.startsOn} value={metric.endsOn ?? ""} onChange={e => update(metric.id, { endsOn: e.target.value || null })} className={inputClass} /></label>
      </div>
      <div className="flex flex-wrap gap-4" role="group" aria-label="Отделы показателя">
        {departments.map(department => <label key={department} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={metric.departments.includes(department)} onChange={e => update(metric.id, { departments: e.target.checked ? [...metric.departments, department] : metric.departments.filter(d => d !== department) })} />{department}</label>)}
      </div>
      <p className="text-xs text-on-surface-variant">Невыполнение влияет только на этого сотрудника. Каждый рабочий день оценивается отдельно: перевыполнение другого дня недобор не закрывает. Выходные отмечаются в «Планах продаж».</p>
      {metric.id.startsWith("new:") && <button type="button" onClick={() => onChange(metrics.filter(m => m.id !== metric.id))} className="text-sm text-error">Удалить черновик</button>}
    </fieldset>)}
    {metrics.length > 0 && <>
      <div className="rounded-lg bg-surface-container-low p-3 space-y-1 text-sm">
        {departments.map(department => {
          const reserved = metrics.filter(m => m.departments.includes(department) && m.startsOn <= today && (!m.endsOn || m.endsOn >= today)).reduce((sum, m) => sum + m.weight, 0);
          return <p key={department}><strong>{department}:</strong> продажи {personalWeight - reserved}% + дополнительные показатели {reserved}%</p>;
        })}
      </div>
      <p className="text-xs text-on-surface-variant">При весе 5%: 2 из 2 дают 5 баллов KPI, 1 из 2 — 2,5, 0 из 2 — 0. За период берётся среднее выполнение дневных норм. Пустой факт считается нулём, включая сегодняшний день. Изменение правила пересчитывает период его действия. Для завершения укажите дату окончания; история факта сохранится.</p>
    </>}
  </section>;
}

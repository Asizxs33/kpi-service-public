"use client";
import { useFeedback } from "@/components/FeedbackProvider";

import Icon from "@/components/Icon";


import { useState, useTransition } from "react";
import { WEIGHTS_META, weightsTotal, type Weights } from "@/lib/kpi";
import { resetWeights, saveWeights } from "./actions";
import CustomMetricEditor from "./CustomMetricEditor";
import { validateMetric, validateMetricBudget, type CustomMetric } from "@/lib/custom-kpi";

const SOURCE_HINTS: Record<string, string> = {
  base: "Начисляется полностью — фиксированная часть оклада",
  discipline: "Журнал дисциплинарных нарушений (−25% за каждое)",
  personal: "Выполнение плана продаж и дополнительные показатели ниже",
  upsell: "Полное обслуживание / обслуженные клиенты",
  quality: "Отзывы и отправки на 2 этаж к цели, минус жалобы",
};
const ICONS: Record<string, string> = { base: "payments", discipline: "verified_user", personal: "shopping_cart", upsell: "add_shopping_cart", quality: "star" };

export default function SettingsClient({ initialWeights, initialMetrics, departments, today }: { initialWeights: Weights; initialMetrics: CustomMetric[]; departments: string[]; today: string }) {
  const notify = useFeedback();
  const [weights, setWeights] = useState(initialWeights);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const total = weightsTotal(weights);
  let metricError = "";
  try { metrics.forEach(validateMetric); validateMetricBudget(metrics, weights.personal); }
  catch (error) { metricError = error instanceof Error ? error.message : "Проверьте показатели"; }
  const ok = total === 100 && Object.values(weights).every(w => Number.isSafeInteger(w) && w >= 0 && w <= 100) && !metricError;

  function update(key: keyof Weights, value: number) {
    setWeights((w) => ({ ...w, [key]: value }));
    setMessage(null);
  }

  function handleSave() {
    if (!ok) return;
    startTransition(async () => {
      try { const saved = await saveWeights(weights, metrics); setMetrics(saved); setMessage("Сохранено. Новые веса применяются в расчёте KPI."); notify("Настройки KPI сохранены"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось сохранить настройки", true); }
    });
  }

  function handleReset() {
    startTransition(async () => {
      try {
      await resetWeights();
      const defaults: Weights = { base: 35, discipline: 15, personal: 30, upsell: 10, quality: 10 };
      setWeights(defaults);
      setMessage(null);
      notify("Стандартные веса восстановлены");
      } catch (error) { notify(error instanceof Error ? error.message : "Не удалось сбросить настройки", true); }
    });
  }

  return (
    <main className="flex-1 p-6 max-w-container-max mx-auto w-full pb-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-on-surface mb-2">Настройки KPI</h1>
        <p className="text-sm text-on-surface-variant max-w-2xl">
          Настройте веса для всех показателей эффективности. Изменения пересчитывают KPI% на Дашборде и в профилях сотрудников.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant bg-surface flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface">Настройка показателей</h3>
            </div>
            {/* Мобильный — карточки */}
            <div className="md:hidden divide-y divide-outline-variant">
              {WEIGHTS_META.map((m) => (
                <div key={m.key} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Icon name={ICONS[m.key]} className="text-outline text-[20px]" />
                    <span className="font-medium text-on-surface">{m.label}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{SOURCE_HINTS[m.key]}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">Вес, %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={weights[m.key as keyof Weights]}
                      onChange={(e) => update(m.key as keyof Weights, Number(e.target.value) || 0)}
                      className="flex-1 bg-surface border border-outline-variant rounded px-2 py-1.5 text-sm text-right focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              ))}
              <div className="p-4 flex items-center justify-between bg-surface">
                <span className="font-bold text-on-surface">Итого распределено:</span>
                <span className={`font-bold ${ok ? "text-secondary" : "text-error"}`}>{total}%</span>
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="py-3 px-4 text-sm text-on-surface-variant font-medium">Название показателя</th>
                    <th className="py-3 px-4 text-sm text-on-surface-variant font-medium">Откуда берётся балл</th>
                    <th className="py-3 px-4 text-sm text-on-surface-variant font-medium w-32">Вес (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {WEIGHTS_META.map((m) => (
                    <tr key={m.key} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Icon name={ICONS[m.key]} className="text-outline text-[20px]" />
                          <span className="font-medium text-on-surface">{m.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-on-surface-variant text-sm">{SOURCE_HINTS[m.key]}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={weights[m.key as keyof Weights]}
                          onChange={(e) => update(m.key as keyof Weights, Number(e.target.value) || 0)}
                          className="w-full bg-surface border border-outline-variant rounded px-2 py-1 text-sm text-right focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface border-t-2 border-outline-variant">
                    <td className="py-4 px-4 text-right font-bold text-on-surface" colSpan={2}>
                      Итого распределено:
                    </td>
                    <td className={`py-4 px-4 font-bold ${ok ? "text-secondary" : "text-error"}`}>{total}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <CustomMetricEditor metrics={metrics} departments={departments} today={today} personalWeight={weights.personal} disabled={pending} onChange={next => { setMetrics(next); setMessage(null); }} />
          {metricError && <p role="alert" className="text-sm text-error mt-3">{metricError}</p>}
        </div>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6">
            <h4 className="text-lg font-bold text-on-surface mb-1">Планы продаж</h4>
            <p className="text-sm text-on-surface-variant mb-4">
              Личные планы сотрудников и общие планы отделов (Розница/Детский отдел) теперь помесячные — настраиваются на отдельной странице.
            </p>
            <a href="/plans" className="inline-flex h-10 px-4 bg-primary text-on-primary rounded-lg text-sm font-semibold items-center hover:opacity-90">
              Перейти к «Планы продаж»
            </a>
          </div>

          <div className="bg-surface-container-low border border-outline-variant border-l-4 border-l-primary rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <Icon name="info" className="text-primary text-2xl" />
              <h4 className="text-lg font-bold text-on-surface">Влияние распределения весов</h4>
            </div>
            <p className="text-sm text-on-surface-variant mb-4">
              Сумма весов KPI должна быть ровно 100%, прежде чем изменения можно сохранить.
            </p>
            <div className="bg-surface rounded-lg p-3 border border-outline-variant">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-on-surface-variant">Текущий статус распределения</span>
                <span className={`text-xs font-semibold ${ok ? "text-secondary" : "text-error"}`}>{ok ? "Готово" : "Не сходится"}</span>
              </div>
              <div className="w-full bg-surface-container-high rounded-full h-2 mb-1 overflow-hidden">
                <div className={`${ok ? "bg-secondary" : "bg-error"} h-2 rounded-full`} style={{ width: `${Math.min(100, total)}%` }} />
              </div>
              <span className="text-sm text-on-surface-variant">
                {message ?? `Распределено ${total}% из 100%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 right-0 w-full md:w-[calc(100%-var(--spacing-sidebar-width))] bg-surface border-t border-outline-variant p-3 sm:p-4 z-40 shadow-lg">
        <div className="max-w-container-max mx-auto flex flex-wrap justify-between items-center gap-2">
          <button
            onClick={handleReset}
            disabled={pending}
            className="px-3 sm:px-6 py-2 border border-outline-variant text-on-surface text-[11px] sm:text-xs font-semibold rounded-lg hover:bg-surface-container-low h-9 sm:h-10 whitespace-nowrap"
          >
            СБРОСИТЬ ПО УМОЛЧАНИЮ
          </button>
          <div className="flex gap-2 sm:gap-4 items-center">
            {!ok && <span className="text-sm text-error hidden sm:block">{metricError ? "Проверьте дополнительные показатели" : `Сумма весов: ${total}% (нужно 100%)`}</span>}
            <button
              onClick={handleSave}
              disabled={!ok || pending}
              className={`px-3 sm:px-6 py-2 text-[11px] sm:text-xs font-semibold rounded-lg h-9 sm:h-10 whitespace-nowrap transition-colors ${
                ok ? "bg-primary text-on-primary hover:opacity-90 cursor-pointer" : "bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60"
              }`}
            >
              СОХРАНИТЬ ИЗМЕНЕНИЯ
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

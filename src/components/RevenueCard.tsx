"use client";

import { useState } from "react";
import Icon from "./Icon";

export type DebtBreakdownItem = { fullName: string; amount: number };

export default function RevenueCard({
  department,
  actual,
  plan,
  debt,
  percent,
  debtBreakdown,
  lastYear,
  lastYearLabel,
}: {
  department: string;
  actual: number;
  plan: number;
  debt: number;
  percent: number;
  debtBreakdown?: DebtBreakdownItem[];
  lastYear?: number | null;
  lastYearLabel?: string;
}) {
  const yoy = lastYear ? Math.round(((actual - lastYear) / lastYear) * 100) : null;
  const green = department === "Детский отдел";
  const money = (amount: number) => amount.toLocaleString("ru-RU");
  const progress = Math.max(0, Math.min(100, percent));
  const [showDebt, setShowDebt] = useState(false);
  const hasBreakdown = debt > 0 && (debtBreakdown?.length ?? 0) > 0;

  return (
    <section className={`revenue-card ${green ? "revenue-card--green" : ""}`} aria-label={`Выручка ${department}`}>
      <div className="revenue-heading">
        <span className="color-icon"><Icon name="trending_up" /></span>
        <h2>Общая выручка {department} <span>— план на месяц</span></h2>
      </div>
      <div className="revenue-content">
        <div className="min-w-0 flex-1">
          <div className="revenue-value">₸ {money(actual)}</div>
          <p className="revenue-plan">из ₸ {money(plan)} ({percent}%)</p>
          {lastYear != null && (
            <p className="revenue-note">
              Год назад{lastYearLabel ? ` (${lastYearLabel})` : ""}: ₸ {money(lastYear)}
              {yoy !== null && <strong className={yoy >= 0 ? "text-[#2EA84A]" : "text-error"}> · {yoy >= 0 ? "+" : ""}{yoy}%</strong>}
            </p>
          )}
          <div role="progressbar" aria-label={`Выполнение плана ${department}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="revenue-track"><div style={{ width: `${progress}%` }} /></div>
          {debt > 0 ? (
            <button
              type="button"
              onClick={() => hasBreakdown && setShowDebt((v) => !v)}
              className={`revenue-note text-left ${hasBreakdown ? "underline decoration-dotted cursor-pointer hover:text-primary" : "cursor-default"}`}
            >
              Минус долг ₸ {money(debt)} · Чистая ₸ {money(actual - debt)}
              {hasBreakdown && <Icon name={showDebt ? "expand_less" : "expand_more"} className="align-middle text-[16px] ml-1" />}
            </button>
          ) : (
            <p className="revenue-note">Выручка по данным UMAG за текущий месяц</p>
          )}
          {showDebt && hasBreakdown && (
            <ul className="mt-2 rounded-lg border border-outline-variant bg-surface-container-low divide-y divide-outline-variant text-sm">
              {debtBreakdown!.map((item) => (
                <li key={item.fullName} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-on-surface-variant">{item.fullName}</span>
                  <span className="font-semibold text-error">₸ {money(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="revenue-ring" aria-hidden="true">
          <svg viewBox="0 0 100 100"><circle className="ring-track" cx="50" cy="50" r="40" /><circle className="ring-value" cx="50" cy="50" r="40" strokeDasharray={`${progress * 2.5133} 251.33`} /></svg>
          <span>{percent}%</span>
        </div>
      </div>
    </section>
  );
}

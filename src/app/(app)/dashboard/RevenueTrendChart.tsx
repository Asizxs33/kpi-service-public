"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useId } from "react";

type Point = { day: number; amount: number };

function fmtTick(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} тыс`;
  return `${n}`;
}

function CustomTooltip({ active, payload, label, monthLabel }: { active?: boolean; payload?: { value: number }[]; label?: number; monthLabel: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-outline-variant rounded-lg shadow-lg px-3 py-2 text-sm">
      <div className="text-on-surface-variant text-xs mb-0.5">
        {label} {monthLabel}
      </div>
      <div className="font-bold text-primary">₸ {payload[0].value.toLocaleString("ru-RU")}</div>
    </div>
  );
}

export default function RevenueTrendChart({ data, monthLabel }: { data: Point[]; monthLabel: string }) {
  const fillId = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={238}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#338aff" stopOpacity={0.24} />
            <stop offset="100%" stopColor="#338aff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical stroke="#edf1f9" />
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-on-surface-variant)", fontSize: 11 }} tickFormatter={fmtTick} width={48} />
        <Tooltip content={<CustomTooltip monthLabel={monthLabel} />} cursor={{ stroke: "var(--color-primary)", strokeWidth: 1, strokeDasharray: "3 3" }} />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#2674ff"
          strokeWidth={2}
          fill={`url(#${fillId})`}
          dot={false}
          activeDot={{ r: 5, fill: "var(--color-primary)", stroke: "var(--color-surface)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

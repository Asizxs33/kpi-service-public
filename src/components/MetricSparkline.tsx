// A compact view of the same daily data shown on the dashboard.
export default function MetricSparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every(value => value === 0)) return null;
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, i) => `${(i / (values.length - 1)) * 130},${44 - ((value - min) / span) * 36}`).join(" ");
  return <svg className="metric-sparkline" viewBox="0 0 132 50" aria-hidden="true"><polygon points={`0,50 ${points} 130,50`} fill="currentColor" opacity=".07" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

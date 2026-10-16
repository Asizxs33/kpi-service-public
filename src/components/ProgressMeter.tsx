export default function ProgressMeter({ value, label }: { value: number; label: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return <div className="progress-meter" data-complete={value >= 100}>
    <div><span>{label}</span><strong>{value}%</strong></div>
    <div className="progress-meter-track" role="progressbar" aria-label={label} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>
  </div>;
}

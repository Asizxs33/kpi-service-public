/** Dates in the business timezone, independent of the server's timezone. */
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Qyzylorda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export type DailyTargetInput = {
  from: string;
  to: string;
  startsOn: string;
  endsOn?: string | null;
  hireDate?: string | null;
  today: string;
  dailyTarget: number;
  daysOff: string[];
  entries: { date: string; amount: number }[];
  allowCarryover: boolean;
};

/** Shared assessment for any count-based daily KPI; no salary policy here. */
export function assessDailyTarget(input: DailyTargetInput) {
  const dates = [input.from, input.to, input.startsOn, input.today];
  if (input.endsOn) dates.push(input.endsOn);
  if (input.hireDate) dates.push(input.hireDate);
  if (!dates.every(isValidDate)) throw new Error("Некорректная дата нормы KPI");
  if (!Number.isSafeInteger(input.dailyTarget) || input.dailyTarget <= 0) {
    throw new Error("Дневная норма должна быть положительным целым числом");
  }
  const from = [input.from, input.startsOn, input.hireDate || input.from].sort().at(-1)!;
  const to = [input.to, input.today, input.endsOn || input.to].sort()[0];
  const off = new Set(input.daysOff);
  const amounts = new Map<string, number>();
  for (const entry of input.entries) {
    if (!isValidDate(entry.date) || !Number.isSafeInteger(entry.amount) || entry.amount < 0) {
      throw new Error("Факт должен быть неотрицательным целым числом с корректной датой");
    }
    amounts.set(entry.date, (amounts.get(entry.date) ?? 0) + entry.amount);
  }

  let actual = 0;
  let credited = 0;
  let workingDays = 0;
  let missingDays = 0;
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (off.has(date)) continue;
    workingDays++;
    if (!amounts.has(date)) missingDays++;
    const amount = amounts.get(date) ?? 0;
    actual += amount;
    credited += Math.min(amount, input.dailyTarget);
  }
  const target = workingDays * input.dailyTarget;
  if (input.allowCarryover) credited = Math.min(actual, target);
  return {
    actual,
    target,
    credited,
    shortfall: target - credited,
    workingDays,
    missingDays,
    // null distinguishes a period without an obligation from fulfilled work.
    score: target > 0 ? credited / target * 100 : null,
  };
}

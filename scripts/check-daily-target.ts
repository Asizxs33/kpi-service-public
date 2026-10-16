import assert from "node:assert/strict";
import { assessDailyTarget, businessDate, isValidDate, type DailyTargetInput } from "../src/lib/daily-target";

const input: DailyTargetInput = {
  from: "2026-10-01", to: "2026-10-31", startsOn: "2026-10-10", today: "2026-10-11",
  dailyTarget: 2, daysOff: [], entries: [], allowCarryover: false,
};

assert.equal(businessDate(new Date("2026-10-10T20:00:00Z")), "2026-10-11");
assert.equal(isValidDate("2026-02-29"), false);
assert.equal(isValidDate("2028-02-29"), true);
const empty = assessDailyTarget(input);
assert.equal(empty.target, 4); // No obligation before launch or in future days.
assert.equal(empty.missingDays, 2);
assert.equal(empty.score, 0);

const entries = [{ date: "2026-10-10", amount: 4 }, { date: "2026-10-11", amount: 0 }];
assert.equal(assessDailyTarget({ ...input, entries }).score, 50);
assert.equal(assessDailyTarget({ ...input, entries, allowCarryover: true }).score, 100);
assert.equal(assessDailyTarget({ ...input, entries }).missingDays, 0);
assert.equal(assessDailyTarget({ ...input, entries, daysOff: ["2026-10-11"] }).score, 100);
assert.equal(assessDailyTarget({ ...input, hireDate: "2026-10-11" }).target, 2);
assert.equal(assessDailyTarget({ ...input, endsOn: "2026-10-10" }).target, 2);
assert.equal(assessDailyTarget({ ...input, startsOn: "2026-11-01" }).score, null);
assert.equal(assessDailyTarget({ ...input, from: "2026-09-01", to: "2026-09-30" }).target, 0);
assert.equal(assessDailyTarget({ ...input, daysOff: ["2026-10-10", "2026-10-11"] }).score, null);
assert.equal(assessDailyTarget({ ...input, entries: [{ date: "2026-10-10", amount: 1 }, { date: "2026-10-10", amount: 1 }] }).credited, 2);
assert.throws(() => assessDailyTarget({ ...input, dailyTarget: -2 }));
assert.throws(() => assessDailyTarget({ ...input, entries: [{ date: "2026-10-10", amount: -1 }] }));
assert.throws(() => assessDailyTarget({ ...input, from: "2026-02-30" }));
console.log("Daily target checks passed");

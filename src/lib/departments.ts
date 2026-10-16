export const WHOLESALE_DEPARTMENT = "Оптовый";

const RETAIL_RESULT_COLUMNS = new Set(["reviews", "reviewsPct", "complaints", "referrals", "referralsPct", "tickets", "ticketsPct"]);

export function showResultColumn(key: string, department?: string) {
  return department !== WHOLESALE_DEPARTMENT || !RETAIL_RESULT_COLUMNS.has(key);
}

export const DEPARTMENTS = ["Розница", "Колл-центр", "Детский отдел", WHOLESALE_DEPARTMENT];

// Wholesale uses the Розница store in UMAG; its department total is the
// sum of its own employees' sales, not the full store's revenue.
export const DEPARTMENTS_WITH_PLANS = ["Розница", "Детский отдел", WHOLESALE_DEPARTMENT];

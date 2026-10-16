import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getEmployees, getAllLogs, getMonthlyPlans, getStoreDailyRevenue, getDaysOff } from "@/lib/data";
import { departmentScope } from "@/lib/require-auth";
import { currentMonthKey, findPlanAmount } from "@/lib/kpi";
import PlansClient, { type PlanRow } from "./PlansClient";
import { DEPARTMENTS_WITH_PLANS, WHOLESALE_DEPARTMENT } from "@/lib/departments";

const ALL_DEPARTMENTS = DEPARTMENTS_WITH_PLANS;

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await auth();
  const scope = departmentScope(session);
  const { month } = await searchParams;
  const monthKey = month || currentMonthKey();

  const [allEmployees, logs, plans, dailyRevenue, daysOff] = await Promise.all([getEmployees(), getAllLogs(), getMonthlyPlans(), getStoreDailyRevenue(), getDaysOff()]);
  const employees = (scope ? allEmployees.filter((e) => scope.includes(e.department)) : allEmployees).filter((e) => e.active);
  const departments = scope ? ALL_DEPARTMENTS.filter((d) => scope.includes(d)) : ALL_DEPARTMENTS;

  const daysOffByEmployee = new Map<string, string[]>();
  daysOff
    .filter((d) => d.date.slice(0, 7) === monthKey)
    .forEach((d) => {
      const arr = daysOffByEmployee.get(d.employeeId) ?? [];
      arr.push(d.date);
      daysOffByEmployee.set(d.employeeId, arr);
    });

  const monthLogs = logs.filter((l) => l.type === "UPSELL" && l.date.slice(0, 7) === monthKey);
  const factByEmployee = new Map<string, number>();
  monthLogs.forEach((l) => {
    factByEmployee.set(l.employeeId, (factByEmployee.get(l.employeeId) || 0) + (l.salesAmount || 0));
  });

  const factByDepartment = new Map<string, number>();
  dailyRevenue
    .filter((d) => d.date.slice(0, 7) === monthKey)
    .forEach((d) => {
      factByDepartment.set(d.department, (factByDepartment.get(d.department) || 0) + d.amount);
    });

  const departmentRows: PlanRow[] = departments.map((dept) => ({
    kind: "department",
    id: dept,
    label: `Общая выручка ${dept}`,
    department: dept,
    plan: findPlanAmount(plans, monthKey, { department: dept }),
    fact: dept === WHOLESALE_DEPARTMENT
      ? employees.filter(e => e.department === dept).reduce((sum, e) => sum + (factByEmployee.get(e.id) ?? 0), 0)
      : factByDepartment.get(dept) ?? 0,
  }));

  const employeeRows: PlanRow[] = employees.map((e) => ({
    kind: "employee",
    id: e.id,
    label: e.fullName,
    department: e.department,
    plan: findPlanAmount(plans, monthKey, { employeeId: e.id }),
    fact: factByEmployee.get(e.id) ?? 0,
    daysOff: daysOffByEmployee.get(e.id) ?? [],
  }));

  return (
    <>
      <Topbar title="Планы продаж" userName={session?.user?.name ?? ""} />
      <PlansClient
        monthKey={monthKey}
        departmentRows={departmentRows}
        employeeRows={employeeRows}
        canManageDaysOff={session?.user?.role === "ADMIN" || session?.user?.role === "ROP"}
      />
    </>
  );
}

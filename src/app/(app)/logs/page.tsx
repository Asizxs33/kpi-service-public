import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getEmployees, getAllLogs, getDaysOff, getCustomMetrics, getCustomMetricEntries } from "@/lib/data";
import { businessDate } from "@/lib/daily-target";
import { departmentScope } from "@/lib/require-auth";
import LogsClient from "./LogsClient";

export default async function LogsPage() {
  const session = await auth();
  const scope = departmentScope(session);
  const [allEmployees, allLogs, daysOff, allMetrics, allEntries] = await Promise.all([getEmployees(), getAllLogs(), getDaysOff(), getCustomMetrics(), getCustomMetricEntries()]);
  const employees = scope ? allEmployees.filter((e) => scope.includes(e.department)) : allEmployees;
  const employeeIds = new Set(employees.map((e) => e.id));
  const logs = scope ? allLogs.filter((l) => employeeIds.has(l.employeeId)) : allLogs;

  const daysOffByEmployee: Record<string, string[]> = {};
  daysOff.forEach((d) => {
    if (!employeeIds.has(d.employeeId)) return;
    (daysOffByEmployee[d.employeeId] ??= []).push(d.date);
  });

  return (
    <>
      <Topbar title="Журналы контроля" userName={session?.user?.name ?? ""} />
      <LogsClient employees={employees} logs={logs} daysOffByEmployee={daysOffByEmployee}
        metrics={allMetrics.filter(m => !scope || m.departments.some(d => scope.includes(d)))}
        metricEntries={allEntries.filter(e => employeeIds.has(e.employeeId))} today={businessDate()} />
    </>
  );
}

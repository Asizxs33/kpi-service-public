import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getEmployees } from "@/lib/data";
import { departmentScope } from "@/lib/require-auth";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  const session = await auth();
  const scope = departmentScope(session);
  const allEmployees = await getEmployees();
  const employees = scope ? allEmployees.filter((e) => scope.includes(e.department)) : allEmployees;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <>
      <Topbar title="Сотрудники" userName={session?.user?.name ?? ""} />
      <EmployeesClient employees={employees} canManage={isAdmin} allowedDepartments={scope} />
    </>
  );
}

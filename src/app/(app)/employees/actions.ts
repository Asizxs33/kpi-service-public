"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireDepartmentAccess } from "@/lib/require-auth";

export type EmployeeInput = {
  fullName: string;
  email: string;
  position: string;
  department: string;
  hireDate: string;
  active: boolean;
};

export async function addEmployee(data: EmployeeInput) {
  await requireAdmin();
  if (!data.fullName.trim()) throw new Error("ФИО обязательно");
  await prisma.employee.create({ data });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/plans");
  revalidatePath("/logs");
  revalidatePath("/settings");
}

export async function updateEmployee(id: string, data: EmployeeInput) {
  if (!data.fullName.trim()) throw new Error("ФИО обязательно");
  const existing = await prisma.employee.findUniqueOrThrow({ where: { id }, select: { department: true } });
  await requireDepartmentAccess(existing.department);
  // ROP не может перекинуть сотрудника в чужой отдел.
  if (data.department !== existing.department) {
    await requireDepartmentAccess(data.department);
  }
  await prisma.employee.update({ where: { id }, data });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/plans");
  revalidatePath("/logs");
  revalidatePath("/settings");
}

export async function deleteEmployee(id: string) {
  await requireAdmin();
  await prisma.employee.delete({ where: { id } });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
}

export async function toggleEmployeeActive(id: string) {
  const emp = await prisma.employee.findUniqueOrThrow({ where: { id } });
  await requireDepartmentAccess(emp.department);
  await prisma.employee.update({ where: { id }, data: { active: !emp.active } });
  revalidatePath("/employees");
  revalidatePath("/dashboard");
}

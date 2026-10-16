"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import type { Role } from "@/generated/prisma/client";

export async function saveEditBackdateLimit(days: number) {
  await requireAdmin();
  const clamped = Math.max(0, Math.floor(days) || 0);
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { editBackdateLimitDays: clamped },
    create: { id: "singleton", editBackdateLimitDays: clamped },
  });
  revalidatePath("/access");
}

export async function listUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, departments: true, createdAt: true },
  });
}

export async function createUser(data: { name: string; email: string; password: string; role: Role; departments?: string[] }) {
  await requireAdmin();
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  if (!name || !email || !data.password) throw new Error("Имя, email и пароль обязательны");
  if (data.password.length < 6) throw new Error("Пароль должен быть не короче 6 символов");
  if (data.role === "ROP" && !data.departments?.length) throw new Error("Для роли РОП нужно выбрать хотя бы один отдел");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Пользователь с таким email уже существует");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.user.create({
    data: { name, email, passwordHash, role: data.role, departments: data.role === "ROP" ? (data.departments ?? []) : [] },
  });
  revalidatePath("/access");
}

export async function updateUser(id: string, data: { name: string; role: Role; departments?: string[]; password?: string }) {
  const session = await requireAdmin();
  const name = data.name.trim();
  if (!name) throw new Error("Имя обязательно");
  if (data.role === "ROP" && !data.departments?.length) throw new Error("Для роли РОП нужно выбрать хотя бы один отдел");
  if (data.password && data.password.length > 0 && data.password.length < 6) throw new Error("Пароль должен быть не короче 6 символов");

  if (id === session.user?.id && data.role !== "ADMIN") {
    throw new Error("Нельзя снять роль администратора с самого себя");
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      role: data.role,
      departments: data.role === "ROP" ? (data.departments ?? []) : [],
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
  });
  revalidatePath("/access");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (id === session.user?.id) {
    throw new Error("Нельзя удалить самого себя");
  }
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  const target = await prisma.user.findUniqueOrThrow({ where: { id }, select: { role: true } });
  if (target.role === "ADMIN" && admins <= 1) {
    throw new Error("Нельзя удалить последнего администратора");
  }
  await prisma.user.delete({ where: { id } });
  revalidatePath("/access");
}

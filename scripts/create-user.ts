/**
 * Создать/обновить пользователя дашборда (ADMIN, MANAGER или ROP).
 * Основной способ — страница «Доступы» в самом дашборде (ADMIN); этот
 * скрипт остаётся как запасной вариант.
 *
 * Использование:
 *   npx tsx --env-file=.env scripts/create-user.ts <email> <пароль> <имя> <ADMIN|MANAGER|ROP> [отделы через запятую]
 *
 * Отделы обязательны и должны совпадать с Employee.department (Розница /
 * Колл-центр / Детский отдел) только для роли ROP — она видит и редактирует
 * только сотрудников и логи этих отделов (можно несколько сразу).
 *
 * Пример — завести демонстрационного РОПа на Розница и Детский отдел:
 *   npx tsx --env-file=.env scripts/create-user.ts rop@example.com "уникальный-пароль" "Демо Руководитель" ROP "Розница,Детский отдел"
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [email, password, name, role, departmentsArg] = process.argv.slice(2);
  if (!email || !password || !name || !role) {
    console.log("Использование: npx tsx --env-file=.env scripts/create-user.ts <email> <пароль> <имя> <ADMIN|MANAGER|ROP> [отделы через запятую]");
    process.exit(1);
  }
  if (!["ADMIN", "MANAGER", "ROP"].includes(role)) {
    console.log("Роль должна быть ADMIN, MANAGER или ROP");
    process.exit(1);
  }
  const departments = departmentsArg ? departmentsArg.split(",").map((d) => d.trim()).filter(Boolean) : [];
  if (role === "ROP" && departments.length === 0) {
    console.log("Для роли ROP обязательно нужно указать хотя бы один отдел (Розница / Колл-центр / Детский отдел)");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: role as "ADMIN" | "MANAGER" | "ROP", departments: role === "ROP" ? departments : [] },
    create: { email, passwordHash, name, role: role as "ADMIN" | "MANAGER" | "ROP", departments: role === "ROP" ? departments : [] },
  });
  console.log("Готово:", user.email, "/", role, departments.length ? `(${departments.join(", ")})` : "");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

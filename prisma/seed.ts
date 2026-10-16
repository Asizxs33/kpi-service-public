import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

function requiredEnv(name: "SEED_ADMIN_EMAIL" | "SEED_ADMIN_PASSWORD") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set before seeding`);
  return value;
}

const adminEmail = requiredEnv("SEED_ADMIN_EMAIL");
const adminPassword = requiredEnv("SEED_ADMIN_PASSWORD");
if (adminPassword.length < 12) {
  throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters");
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

// Synthetic records for the public demo. They are not real employees or plans.
const EMPLOYEES: { fullName: string; position: string; department: string; salesTarget: number }[] = [
  { fullName: "Демо Сотрудник 01", position: "Старший продавец", department: "Розница", salesTarget: 24_000_000 },
  { fullName: "Демо Сотрудник 02", position: "Старший продавец", department: "Розница", salesTarget: 22_000_000 },
  { fullName: "Демо Сотрудник 03", position: "Продавец", department: "Розница", salesTarget: 20_000_000 },
  { fullName: "Демо Сотрудник 04", position: "Продавец", department: "Розница", salesTarget: 18_000_000 },
  { fullName: "Демо Сотрудник 05", position: "Продавец", department: "Розница", salesTarget: 16_000_000 },
  { fullName: "Демо Сотрудник 06", position: "Продавец", department: "Розница", salesTarget: 14_000_000 },
  { fullName: "Демо Сотрудник 07", position: "Оператор", department: "Колл-центр", salesTarget: 12_000_000 },
  { fullName: "Демо Сотрудник 08", position: "Оператор", department: "Колл-центр", salesTarget: 10_000_000 },
  { fullName: "Демо Сотрудник 09", position: "Продавец", department: "Детский отдел", salesTarget: 9_000_000 },
  { fullName: "Демо Сотрудник 10", position: "Продавец", department: "Детский отдел", salesTarget: 9_000_000 },
  { fullName: "Демо Сотрудник 11", position: "Продавец", department: "Оптовый", salesTarget: 15_000_000 },
];

async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        name: "Демо Администратор",
        role: "ADMIN",
      },
    });
    console.log("Demo administrator created:", adminEmail);
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  if ((await prisma.employee.count()) === 0) {
    for (const employee of EMPLOYEES) {
      const created = await prisma.employee.create({
        data: {
          fullName: employee.fullName,
          position: employee.position,
          department: employee.department,
          active: true,
        },
      });
      await prisma.monthlyPlan.create({
        data: { monthKey, employeeId: created.id, amount: employee.salesTarget },
      });
    }

    await prisma.monthlyPlan.createMany({
      data: [
        { monthKey, department: "Розница", amount: 120_000_000 },
        { monthKey, department: "Детский отдел", amount: 24_000_000 },
      ],
    });
    console.log("Synthetic demo employees and plans created");
  }

  if (!(await prisma.settings.findUnique({ where: { id: "singleton" } }))) {
    await prisma.settings.create({
      data: { id: "singleton", base: 35, discipline: 15, personal: 30, upsell: 10, quality: 10 },
    });
    console.log("Default KPI weights created");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

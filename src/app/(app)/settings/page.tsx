import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getSettings, getCustomMetrics, getEmployees } from "@/lib/data";
import { businessDate } from "@/lib/daily-target";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const [settings, metrics, employees] = await Promise.all([getSettings(), getCustomMetrics(), getEmployees()]);

  return (
    <>
      <Topbar title="Настройки KPI" userName={session?.user?.name ?? ""} />
      <SettingsClient
        initialMetrics={metrics} departments={[...new Set(employees.map(e => e.department))]} today={businessDate()}
        initialWeights={{ base: settings.base, discipline: settings.discipline, personal: settings.personal, upsell: settings.upsell, quality: settings.quality }}
      />
    </>
  );
}

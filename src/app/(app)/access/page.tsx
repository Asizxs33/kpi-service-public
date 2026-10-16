import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Topbar from "@/components/Topbar";
import { getSettings } from "@/lib/data";
import { listUsers } from "./actions";
import AccessClient from "./AccessClient";

export default async function AccessPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const settings = await getSettings();
  const users = await listUsers();

  return (
    <>
      <Topbar title="Доступы" userName={session?.user?.name ?? ""} />
      <AccessClient
        initialEditBackdateLimitDays={settings.editBackdateLimitDays}
        initialUsers={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={session.user?.id ?? ""}
      />
    </>
  );
}

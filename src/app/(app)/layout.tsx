import { requireAuth } from "@/lib/require-auth";
import Sidebar from "@/components/Sidebar";
import { FeedbackProvider } from "@/components/FeedbackProvider";
import { MobileNavProvider } from "@/components/MobileNavContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  return (
    <MobileNavProvider>
      <FeedbackProvider>
      <div className="app-shell flex min-h-screen bg-background">
        <Sidebar isAdmin={session.user?.role === "ADMIN"} />
        <div className="flex-1 md:ml-sidebar-width flex flex-col min-h-screen min-w-0">{children}</div>
      </div>
      </FeedbackProvider>
    </MobileNavProvider>
  );
}

"use client";

import { signOutAction } from "@/app/(app)/actions";
import { useMobileNav } from "./MobileNavContext";
import Icon from "./Icon";

export default function Topbar({ title, userName }: { title: string; userName: string }) {
  const { setOpen } = useMobileNav();
  const initials = userName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <header className="sticky top-0 h-topbar-height w-full z-40 bg-white/95 backdrop-blur-md border-b border-outline-variant flex justify-between items-center px-4 sm:px-8 gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={() => setOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low" aria-label="Открыть меню"><Icon name="menu" /></button>
      <div className="min-w-0"><p className="text-sm text-on-surface-variant truncate">KPI Service <span className="mx-2 text-outline/40">/</span> {title === "KPI Дашборд" ? "Обзор результатов" : title}</p></div>
    </div>
    <div className="flex items-center gap-3 sm:gap-5 shrink-0">
      <div className="flex items-center gap-2.5"><div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#3ca0ff] to-[#1252ff] text-white flex items-center justify-center text-xs font-bold">{initials || "И"}</div><span className="text-sm font-semibold text-on-surface-variant hidden lg:inline max-w-48 truncate">{userName}</span></div>
      <form action={signOutAction}><button type="submit" aria-label="Выйти из системы" className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary border border-outline-variant px-2.5 sm:px-3 py-2 rounded-xl hover:bg-surface-container-low"><Icon name="logout" className="text-[17px]" /><span className="hidden sm:inline">Выйти</span></button></form>
    </div>
  </header>;
}

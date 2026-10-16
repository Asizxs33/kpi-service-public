"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon from "./Icon";
import { useMobileNav } from "./MobileNavContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Дашборд", icon: "dashboard" },
  { href: "/employees", label: "Сотрудники", icon: "group" },
  { href: "/logs", label: "Журналы контроля", icon: "receipt_long" },
  { href: "/plans", label: "Планы продаж", icon: "target" },
  { href: "/settings", label: "Настройки KPI", icon: "settings", adminOnly: true },
  { href: "/access", label: "Доступы", icon: "admin_panel_settings", adminOnly: true },
];

function Brand() {
  return <Link href="/dashboard" className="flex items-center gap-3 px-2 py-3" aria-label="KPI Service — главная">
    <div aria-hidden="true" className="h-[42px] w-[42px] rounded-xl bg-gradient-to-br from-[#2d5bff] to-[#10b981] text-white flex items-center justify-center font-bold text-lg shadow-sm">K</div>
    <div><div className="text-xl font-bold tracking-tight text-[#111739]">KPI Service</div><div className="text-xs text-outline">Мониторинг результатов</div></div>
  </Link>;
}

function NavLinks({ isAdmin, pathname, onNavigate }: { isAdmin: boolean; pathname: string; onNavigate?: () => void }) {
  return <div className="flex-1 space-y-2 pt-7">
    {NAV_ITEMS.filter(item => !item.adminOnly).map(item => <Link key={item.href} href={item.href} onClick={onNavigate} className="sidebar-link" data-active={pathname.startsWith(item.href)} aria-current={pathname.startsWith(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}
    {isAdmin && <>
    {NAV_ITEMS.filter(item => item.adminOnly).map(item => <Link key={item.href} href={item.href} onClick={onNavigate} className="sidebar-link" data-active={pathname.startsWith(item.href)} aria-current={pathname.startsWith(item.href) ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</>}
  </div>;
}

export default function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <nav aria-label="Основная навигация" className="hidden md:flex fixed inset-y-0 left-0 w-sidebar-width bg-white border-r border-outline-variant z-50 flex-col px-4 py-5">
      <Brand /><NavLinks isAdmin={isAdmin} pathname={pathname} />
      <div className="mx-2 border-t border-outline-variant pt-5 pb-1 text-xs text-outline">Демонстрационный проект</div>
    </nav>
    <dialog ref={dialogRef} aria-label="Меню навигации" onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={e => { if(e.target === e.currentTarget) setOpen(false); }} className="fixed inset-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-0 p-0 bg-white text-on-surface backdrop:bg-slate-900/25 backdrop:backdrop-blur-sm">
      <nav className="min-h-full flex flex-col p-4" aria-label="Мобильная навигация">
        <div className="flex justify-between items-center"><Brand /><button aria-label="Закрыть меню" onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-surface-container-low"><Icon name="close" /></button></div>
        <NavLinks isAdmin={isAdmin} pathname={pathname} onNavigate={() => setOpen(false)} />
      </nav>
    </dialog>
  </>;
}

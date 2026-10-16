"use client";
import { useModalFocus } from "@/lib/use-modal-focus";
import ResponsiveFilters from "@/components/ResponsiveFilters";
import { useFeedback } from "@/components/FeedbackProvider";

import Icon from "@/components/Icon";


import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Employee } from "@/generated/prisma/client";
import { addEmployee, deleteEmployee, toggleEmployeeActive, updateEmployee, type EmployeeInput } from "./actions";
import { exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export-xlsx";
import { DEPARTMENTS } from "@/lib/departments";

function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const EMPTY: EmployeeInput = {
  fullName: "",
  email: "",
  position: "Продавец",
  department: "Розница",
  hireDate: "",
  active: true,
};

export default function EmployeesClient({
  employees,
  canManage = true,
  allowedDepartments = null,
}: {
  employees: Employee[];
  canManage?: boolean;
  // null = все отделы доступны (ADMIN/MANAGER). Массив — только эти
  // (РОП, привязан к одному или нескольким отделам); при ровно одном
  // отделе поле «Отдел» в форме блокируется, как и раньше.
  allowedDepartments?: string[] | null;
}) {
  const notify = useFeedback();
  const departmentOptions = allowedDepartments ?? DEPARTMENTS;
  const isDepartmentLocked = !!allowedDepartments && allowedDepartments.length === 1;
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useModalFocus(drawerOpen, setDrawerOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeInput>(EMPTY);
  const [pending, startTransition] = useTransition();

  const positions = useMemo(() => Array.from(new Set(employees.map((e) => e.position).filter(Boolean))), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))), [employees]);

  const filtered = employees.filter((e) => {
    const matchesQuery = !query || e.fullName.toLowerCase().includes(query.toLowerCase()) || e.position.toLowerCase().includes(query.toLowerCase());
    const matchesPosition = !positionFilter || e.position === positionFilter;
    const matchesDepartment = !departmentFilter || e.department === departmentFilter;
    return matchesQuery && matchesPosition && matchesDepartment;
  });

  const exportColumns: ExportColumn[] = [
    { header: "ФИО", key: "fullName", width: 28 },
    { header: "Отдел", key: "department", width: 16 },
    { header: "Должность", key: "position", width: 16 },
    { header: "Дата найма", key: "hireDate", width: 14 },
    { header: "Статус", key: "status", width: 12 },
  ];

  const exportRows = filtered.map((e) => ({
    fullName: e.fullName,
    department: e.department,
    position: e.position || "",
    hireDate: e.hireDate || "",
    status: e.active ? "Активен" : "Неактивен",
  }));

  const [exporting, setExporting] = useState(false);
  async function handleExportExcel() {
    setExporting(true);
    try {
    await exportToExcel(`Сотрудники_${new Date().toISOString().slice(0, 10)}.xlsx`, "Сотрудники", exportColumns, exportRows, { subtitle: [departmentFilter || "Все отделы", positionFilter, query ? `Поиск: ${query}` : ""].filter(Boolean).join(" · ") });
    notify("Excel готов"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось создать Excel", true); } finally { setExporting(false); }
  }

  function handleExportPdf() {
    try { exportToPdf("Сотрудники", [{ name: "Сотрудники", columns: exportColumns, rows: exportRows }], { subtitle: [departmentFilter || "Все отделы", positionFilter, query ? `Поиск: ${query}` : ""].filter(Boolean).join(" · ") }); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось открыть PDF", true); }
  }

  function openAdd() {
    setEditingId(null);
    setForm(isDepartmentLocked ? { ...EMPTY, department: allowedDepartments![0] } : EMPTY);
    setDrawerOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({
      fullName: emp.fullName,
      email: emp.email ?? "",
      position: emp.position,
      department: emp.department,
      hireDate: emp.hireDate ?? "",
      active: emp.active,
    });
    setDrawerOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    startTransition(async () => {
      try {
      if (editingId) {
        await updateEmployee(editingId, form);
      } else {
        await addEmployee(form);
      }
      setDrawerOpen(false);
      notify("Данные сотрудника сохранены");
      } catch (error) { notify(error instanceof Error ? error.message : "Не удалось сохранить", true); }
    });
  }

  function handleDelete(emp: Employee) {
    if (!confirm(`Удалить сотрудника "${emp.fullName}"?`)) return;
    startTransition(async () => {
      try { await deleteEmployee(emp.id); notify("Сотрудник удалён"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось удалить", true); }
    });
  }

  function handleToggle(emp: Employee) {
    startTransition(async () => {
      try { await toggleEmployeeActive(emp.id); notify("Статус обновлён"); } catch (error) { notify(error instanceof Error ? error.message : "Не удалось изменить статус", true); }
    });
  }

  return (
    <main className="employees-page flex-1 p-6 max-w-container-max mx-auto w-full relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-on-surface">Сотрудники</h1>
            <span className="px-2 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-semibold border border-secondary/20 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary" /> {employees.filter((e) => e.active).length} активных
            </span>
          </div>
          <p className="text-sm text-on-surface-variant mt-1">Управление командой, целями KPI и статусами сотрудников.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          <ResponsiveFilters active={!!departmentFilter || !!positionFilter}>
          <select
            aria-label="Отдел сотрудника"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="pl-4 pr-8 py-2 h-10 bg-surface border border-outline-variant rounded-lg text-sm appearance-none cursor-pointer"
          >
            <option value="">Все отделы</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            aria-label="Должность сотрудника"
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="pl-4 pr-8 py-2 h-10 bg-surface border border-outline-variant rounded-lg text-sm appearance-none cursor-pointer"
          >
            <option value="">Все должности</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          </ResponsiveFilters>
          <button onClick={handleExportExcel} disabled={exporting} className="h-10 px-4 border border-outline-variant text-on-surface-variant rounded-lg font-bold flex items-center gap-2 hover:bg-surface-container-low">
            <Icon name="download" className="text-[20px]" />
            Экспорт
          </button>
          <button onClick={handleExportPdf} className="h-10 px-4 border border-outline-variant text-on-surface-variant rounded-lg font-bold flex items-center gap-2 hover:bg-surface-container-low">
            <Icon name="picture_as_pdf" className="text-[20px]" />
            PDF
          </button>
          {canManage && (
            <button onClick={openAdd} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-bold flex items-center gap-2 hover:opacity-90">
              <Icon name="add" className="text-[20px]" />
              Добавить сотрудника
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface border border-outline-variant rounded-lg overflow-hidden flex flex-col shadow-sm">
        <div className="p-4 border-b border-outline-variant flex flex-wrap justify-between items-center gap-2 bg-surface-container-lowest">
          <span className="text-xs text-on-surface-variant">{filtered.length} сотрудников</span>
          <div className="relative w-full sm:w-72">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Поиск сотрудников" placeholder="Поиск по имени или должности"
              className="w-full pl-9 pr-3 py-1.5 h-8 bg-surface-container-low border border-transparent rounded text-sm focus:outline-none focus:border-primary focus:bg-surface transition-all"
            />
          </div>
        </div>

        {/* Мобильный — карточки */}
        <div className="md:hidden divide-y divide-outline-variant">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-on-surface-variant">Сотрудники не найдены</div>
          ) : (
            filtered.map((emp) => (
              <div key={emp.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80">
                    <div className="employee-avatar w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold text-xs shrink-0">
                      {initials(emp.fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-on-surface truncate">{emp.fullName}</div>
                      <div className="text-xs text-on-surface-variant truncate">{emp.email || "—"}</div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(emp)} className="p-1.5 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-high" title="Редактировать">
                      <Icon name="edit" className="text-[18px]" />
                    </button>
                    {canManage && (
                      <button onClick={() => handleDelete(emp)} className="p-1.5 text-on-surface-variant hover:text-error rounded hover:bg-error-container/50" title="Удалить">
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">{emp.department}</span>
                  <span className="text-xs text-on-surface-variant">{emp.position || "—"}</span>
                </div>
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-xs text-on-surface-variant block">Найм</span>
                    {emp.hireDate || "—"}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                  <span className="text-xs text-on-surface-variant">Активен</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label={`Активный статус: ${emp.fullName}`} checked={emp.active} onChange={() => handleToggle(emp)} className="sr-only peer" disabled={pending} />
                    <div className="w-9 h-5 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary" />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px] data-table sticky-name-table">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-xs font-semibold text-on-surface-variant">
                <th className="py-3 px-4">Сотрудник</th>
                <th className="py-3 px-4">Отдел</th>
                <th className="py-3 px-4">Должность</th>
                <th className="py-3 px-4">Дата найма</th>
                <th className="py-3 px-4 text-center">Статус</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-on-surface-variant">
                    Сотрудники не найдены
                  </td>
                </tr>
              ) : (
                filtered.map((emp, i) => (
                  <tr key={emp.id} className={`${i % 2 === 1 ? "bg-surface-container-low/30" : ""} border-b border-outline-variant hover:bg-surface-container-low/50 transition-colors group`}>
                    <td className="py-3 px-4">
                      <Link href={`/employees/${emp.id}`} className="flex items-center gap-3 hover:opacity-80">
                        <div className="employee-avatar w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold text-xs">
                          {initials(emp.fullName)}
                        </div>
                        <div>
                          <div className="font-semibold text-on-surface">{emp.fullName}</div>
                          <div className="text-xs text-on-surface-variant">{emp.email || "—"}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">{emp.department}</span>
                    </td>
                    <td className="py-3 px-4">{emp.position || "—"}</td>
                    <td className="py-3 px-4 text-on-surface-variant">{emp.hireDate || "—"}</td>
                    <td className="py-3 px-4 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" aria-label={`Активный статус: ${emp.fullName}`} checked={emp.active} onChange={() => handleToggle(emp)} className="sr-only peer" disabled={pending} />
                        <div className="w-9 h-5 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary" />
                      </label>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 row-actions">
                        <button onClick={() => openEdit(emp)} className="p-1.5 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-high" title="Редактировать">
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        {canManage && (
                          <button onClick={() => handleDelete(emp)} className="p-1.5 text-on-surface-variant hover:text-error rounded hover:bg-error-container/50" title="Удалить">
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawerOpen && (
        <div ref={drawerRef} className="edit-overlay fixed inset-0 bg-primary/20 backdrop-blur-sm z-50 flex justify-end" onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label={editingId ? "Редактировать сотрудника" : "Новый сотрудник"} className="edit-drawer w-full max-w-[480px] bg-surface h-full shadow-xl border-l border-outline-variant flex flex-col">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <h2 className="text-xl font-bold text-on-surface">{editingId ? "Редактировать сотрудника" : "Новый сотрудник"}</h2>
              <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high">
                <Icon name="close" className="text-[24px]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
              <section>
                <h3 className="text-lg font-bold text-on-surface mb-4 pb-2 border-b border-surface-container-high">Основная информация</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">ФИО *</label>
                    <input
                      required
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Фамилия Имя"
                      className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Email / телефон</label>
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Отдел</label>
                      <select
                        value={form.department}
                        disabled={isDepartmentLocked}
                        onChange={(e) => setForm({ ...form, department: e.target.value })}
                        className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary disabled:opacity-60"
                      >
                        {departmentOptions.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Должность</label>
                      <select
                        value={form.position}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                        className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
                      >
                        <option value="Продавец">Продавец</option>
                        <option value="Ст-прод">Ст-прод</option>
                        <option value="Т-Продавец">Т-Продавец</option>
                        <option value="РОП">РОП</option>
                        <option value="Оператор">Оператор</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Дата найма</label>
                    <input
                      type="date"
                      value={form.hireDate}
                      onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                      className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-lg font-bold text-on-surface mb-4 pb-2 border-b border-surface-container-high">Цели KPI (за период)</h3>
                <p className="text-xs text-on-surface-variant">
                  Помесячный план продаж настраивается на странице{" "}
                  <Link href="/plans" className="text-primary hover:underline">
                    «Планы продаж»
                  </Link>
                  . Для Розница норма отзывов и отправок на 2 этаж — 2 в день на каждый рабочий день.
                </p>
              </section>

              <section>
                <div className="flex items-center justify-between p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
                  <div>
                    <div className="font-semibold text-on-surface">Активный статус</div>
                    <div className="text-xs text-on-surface-variant">Сотрудник учитывается в KPI-отчётах.</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label="Активный сотрудник" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-surface-dim rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary" />
                  </label>
                </div>
              </section>

              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant sticky bottom-0 bg-surface pb-2">
                <button type="button" onClick={() => setDrawerOpen(false)} className="h-10 px-4 border border-outline-variant text-on-surface rounded-lg font-bold hover:bg-surface-container-low">
                  Отмена
                </button>
                <button type="submit" disabled={pending} className="h-10 px-6 bg-primary text-on-primary rounded-lg font-bold hover:opacity-90 disabled:opacity-60">
                  {pending ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}

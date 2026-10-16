"use client";
import { useFeedback } from "@/components/FeedbackProvider";

import { useState, useTransition } from "react";
import { saveEditBackdateLimit, createUser, updateUser, deleteUser } from "./actions";
import { DEPARTMENTS } from "@/lib/departments";

type Role = "ADMIN" | "MANAGER" | "ROP";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  departments: string[];
  createdAt: string;
};

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Администратор", MANAGER: "Менеджер", ROP: "РОП" };

function emptyForm() {
  return { name: "", email: "", password: "", role: "MANAGER" as Role, departments: [] as string[] };
}

// Чекбоксы вместо одного select — РОП теперь может отвечать за несколько
// отделов сразу (например, Розница + Детский отдел одному человеку).
function DepartmentCheckboxes({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      {DEPARTMENTS.map((d) => (
        <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={value.includes(d)}
            onChange={(e) => onChange(e.target.checked ? [...value, d] : value.filter((x) => x !== d))}
            className="accent-primary"
          />
          {d}
        </label>
      ))}
    </div>
  );
}

export default function AccessClient({
  initialEditBackdateLimitDays,
  initialUsers,
  currentUserId,
}: {
  initialEditBackdateLimitDays: number;
  initialUsers: UserRow[];
  currentUserId: string;
}) {
  const notify = useFeedback();
  const [limitInput, setLimitInput] = useState(String(initialEditBackdateLimitDays));
  const [limitPending, startLimitTransition] = useTransition();
  const [limitSaved, setLimitSaved] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(emptyForm());
  const [createError, setCreateError] = useState<string | null>(null);
  const [createPending, startCreateTransition] = useTransition();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "MANAGER" as Role, departments: [] as string[], password: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEditTransition] = useTransition();

  const [deletePending, startDeleteTransition] = useTransition();

  function saveLimit() {
    setLimitError(null);
    setLimitSaved(false);
    const n = Math.max(0, Number(limitInput) || 0);
    setLimitInput(String(n));
    startLimitTransition(async () => {
      try {
        await saveEditBackdateLimit(n);
        setLimitSaved(true);
        notify("Ограничение сохранено");
        setTimeout(() => setLimitSaved(false), 2000);
      } catch (e) {
        setLimitError(e instanceof Error ? e.message : "Ошибка сохранения");
      }
    });
  }

  function submitCreate() {
    setCreateError(null);
    startCreateTransition(async () => {
      try {
        await createUser(form);
        setForm(emptyForm());
        window.location.reload();
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Ошибка создания пользователя");
      }
    });
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditError(null);
    setEditForm({ name: u.name, role: u.role, departments: u.departments, password: "" });
  }

  function submitEdit(id: string) {
    setEditError(null);
    startEditTransition(async () => {
      try {
        await updateUser(id, editForm);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, name: editForm.name, role: editForm.role, departments: editForm.role === "ROP" ? editForm.departments : [] } : u
          )
        );
        setEditingId(null);
        notify("Доступы пользователя сохранены");
      } catch (e) {
        setEditError(e instanceof Error ? e.message : "Ошибка сохранения");
      }
    });
  }

  function handleDelete(u: UserRow) {
    if (!confirm(`Удалить пользователя ${u.name} (${u.email})?`)) return;
    startDeleteTransition(async () => {
      try {
        await deleteUser(u.id);
        setUsers((prev) => prev.filter((x) => x.id !== u.id));
        notify("Пользователь удалён");
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка удаления");
      }
    });
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Ограничение редактирования задним числом */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-5">
        <h3 className="text-base font-bold text-on-surface mb-1">Редактирование задним числом</h3>
        <p className="text-sm text-on-surface-variant mb-4">
          Сколько дней назад менеджер или РОП ещё может добавлять, менять или удалять записи в журнале контроля. 0 — без ограничения.
          Администратора это ограничение не касается.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={0}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className="w-24 h-10 px-3 border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-primary"
          />
          <span className="text-sm text-on-surface-variant">дней</span>
          <button
            onClick={saveLimit}
            disabled={limitPending}
            className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
          >
            {limitPending ? "Сохранение…" : "Сохранить"}
          </button>
          {limitSaved && <span className="text-sm text-green-600">Сохранено</span>}
          {limitError && <span className="text-sm text-error">{limitError}</span>}
        </div>
      </section>

      {/* Управление пользователями */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-5">
        <h3 className="text-base font-bold text-on-surface mb-1">Пользователи</h3>
        <p className="text-sm text-on-surface-variant mb-4">Создание и редактирование логинов для входа в систему.</p>

        {/* Список — desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-on-surface-variant border-b border-outline-variant">
                <th className="py-2 pr-3">Имя</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Роль</th>
                <th className="py-2 pr-3">Отдел</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-outline-variant/50 align-top">
                  {editingId === u.id ? (
                    <td colSpan={5} className="py-3">
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">Имя</label>
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-9 px-2 border border-outline-variant rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">Роль</label>
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                            className="h-9 px-2 border border-outline-variant rounded text-sm"
                          >
                            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </div>
                        {editForm.role === "ROP" && (
                          <div>
                            <label className="block text-xs text-on-surface-variant mb-1">Отделы</label>
                            <DepartmentCheckboxes value={editForm.departments} onChange={(departments) => setEditForm({ ...editForm, departments })} />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-on-surface-variant mb-1">Новый пароль</label>
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            placeholder="не менять"
                            className="h-9 px-2 border border-outline-variant rounded text-sm w-32"
                          />
                        </div>
                        <button
                          onClick={() => submitEdit(u.id)}
                          disabled={editPending}
                          className="h-9 px-3 rounded bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
                        >
                          Сохранить
                        </button>
                        <button onClick={() => setEditingId(null)} className="h-9 px-3 rounded border border-outline-variant text-sm">
                          Отмена
                        </button>
                        {editError && <span className="text-sm text-error">{editError}</span>}
                      </div>
                    </td>
                  ) : (
                    <>
                      <td className="py-2 pr-3">{u.name}</td>
                      <td className="py-2 pr-3 text-on-surface-variant">{u.email}</td>
                      <td className="py-2 pr-3">{ROLE_LABELS[u.role]}</td>
                      <td className="py-2 pr-3">{u.departments.length ? u.departments.join(", ") : "—"}</td>
                      <td className="py-2 pr-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(u)} className="text-primary text-sm font-medium hover:underline">
                            Изменить
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={deletePending}
                              className="text-error text-sm font-medium hover:underline disabled:opacity-60"
                            >
                              Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Список — mobile cards */}
        <div className="md:hidden divide-y divide-outline-variant">
          {users.map((u) => (
            <div key={u.id} className="py-3">
              {editingId === u.id ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Имя</label>
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="h-9 w-full px-2 border border-outline-variant rounded text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Роль</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                        className="h-9 w-full px-2 border border-outline-variant rounded text-sm"
                      >
                        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {editForm.role === "ROP" && (
                    <div>
                      <label className="block text-xs text-on-surface-variant mb-1">Отделы</label>
                      <DepartmentCheckboxes value={editForm.departments} onChange={(departments) => setEditForm({ ...editForm, departments })} />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-on-surface-variant mb-1">Новый пароль</label>
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      placeholder="не менять"
                      className="h-9 w-full px-2 border border-outline-variant rounded text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitEdit(u.id)}
                      disabled={editPending}
                      className="h-9 px-3 rounded bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
                    >
                      Сохранить
                    </button>
                    <button onClick={() => setEditingId(null)} className="h-9 px-3 rounded border border-outline-variant text-sm">
                      Отмена
                    </button>
                  </div>
                  {editError && <p className="text-sm text-error">{editError}</p>}
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-on-surface">{u.name}</p>
                    <p className="text-xs text-on-surface-variant">{u.email}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {ROLE_LABELS[u.role]}
                      {u.departments.length ? ` · ${u.departments.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => startEdit(u)} className="text-primary text-xs font-medium hover:underline">
                      Изменить
                    </button>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletePending}
                        className="text-error text-xs font-medium hover:underline disabled:opacity-60"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Добавление нового пользователя */}
        <div className="mt-5 pt-4 border-t border-outline-variant">
          <h4 className="text-sm font-semibold text-on-surface mb-3">Новый пользователь</h4>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Имя</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-9 px-2 border border-outline-variant rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-9 px-2 border border-outline-variant rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Пароль</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="h-9 px-2 border border-outline-variant rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-on-surface-variant mb-1">Роль</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                className="h-9 px-2 border border-outline-variant rounded text-sm"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {form.role === "ROP" && (
              <div>
                <label className="block text-xs text-on-surface-variant mb-1">Отделы</label>
                <DepartmentCheckboxes value={form.departments} onChange={(departments) => setForm({ ...form, departments })} />
              </div>
            )}
            <button
              onClick={submitCreate}
              disabled={createPending}
              className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold disabled:opacity-60"
            >
              {createPending ? "Создание…" : "Создать"}
            </button>
          </div>
          {createError && <p className="text-sm text-error mt-2">{createError}</p>}
        </div>
      </section>
    </div>
  );
}

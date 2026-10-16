"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="login-page h-full min-h-screen flex items-center justify-center p-4">
      <div className="login-card bg-surface w-full max-w-[420px] rounded-3xl p-8 sm:p-10 border border-outline-variant relative">
        <div className="mb-8 flex flex-col items-center text-center mt-2">
          <div aria-hidden="true" className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br from-[#2d5bff] to-[#10b981] text-white text-2xl font-bold shadow-sm">
            K
          </div>
          <h1 className="text-2xl font-bold text-primary mb-1">KPI Service</h1>
          <p className="text-sm text-on-surface-variant mb-6">Мониторинг результатов</p>
          <h2 className="text-lg font-bold text-primary mb-2">Вход в систему</h2>
          <p className="text-sm text-on-surface-variant">Введите данные для входа в дашборд</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username" placeholder="admin@example.com"
              className="block w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface h-[44px] focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              name="password" autoComplete="current-password"
              type="password"
              required
              className="block w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface h-[44px] focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-shadow"
            />
          </div>

          {error && <p className="text-sm text-error text-center">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={pending}
              className="w-full flex justify-center items-center py-2 px-4 rounded-lg shadow-sm text-sm font-medium text-on-primary bg-primary hover:opacity-90 h-12 transition-colors disabled:opacity-60"
            >
              {pending ? "Входим..." : "Войти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

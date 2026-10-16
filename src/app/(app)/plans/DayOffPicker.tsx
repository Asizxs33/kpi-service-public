"use client";
import { useFeedback } from "@/components/FeedbackProvider";

import Icon from "@/components/Icon";


import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toggleDayOff, setDaysOffCount } from "./actions";

function daysInMonth(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function DayOffPicker({ employeeId, monthKey, initialDaysOff }: { employeeId: string; monthKey: string; initialDaysOff: string[] }) {
  const notify = useFeedback();
  const total = daysInMonth(monthKey);
  const [offSet, setOffSet] = useState(new Set(initialDaysOff));
  const [countInput, setCountInput] = useState(String(initialDaysOff.length));
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const POPOVER_WIDTH = 256; // w-64
  const POPOVER_HEIGHT = 310; // приблизительная высота попапа (заголовок + до 6 рядов дней)

  function openPicker() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Попап — position: fixed (координаты относительно окна просмотра),
      // поэтому scrollX/scrollY здесь добавлять НЕЛЬЗЯ — иначе при
      // прокрученной странице попап улетает далеко вниз/вбок от кнопки.
      const maxLeft = window.innerWidth - POPOVER_WIDTH - 8;
      const left = Math.max(8, Math.min(rect.left, maxLeft));
      // Если снизу не хватает места — открываем попап над кнопкой.
      const fitsBelow = rect.bottom + POPOVER_HEIGHT + 8 <= window.innerHeight;
      const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - POPOVER_HEIGHT - 4);
      setPos({ top, left });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open]);

  function handleToggle(day: number) {
    const date = `${monthKey}-${String(day).padStart(2, "0")}`;
    const next = new Set(offSet);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setOffSet(next);
    setCountInput(String(next.size));
    startTransition(async () => {
      try { await toggleDayOff(employeeId, date); notify("Выходные сохранены"); } catch (error) { setOffSet(offSet); setCountInput(String(offSet.size)); notify(error instanceof Error ? error.message : "Не удалось сохранить выходной", true); }
    });
  }

  // Быстрый путь: просто вписать число выходных за месяц — не нужно
  // кликать по каждому дню в календаре. Заменяет весь набор выходных на
  // последние N дней месяца; при желании даты можно донастроить через
  // календарь (кнопка справа).
  function saveCount() {
    const n = Math.max(0, Math.min(Math.floor(Number(countInput)) || 0, total));
    if (n === offSet.size) { setCountInput(String(n)); return; }
    setCountInput(String(n));
    const newOff = new Set<string>();
    for (let i = 0; i < n; i++) {
      const day = total - i;
      newOff.add(`${monthKey}-${String(day).padStart(2, "0")}`);
    }
    if (newOff.size === offSet.size && [...newOff].every((d) => offSet.has(d))) return;
    setOffSet(newOff);
    startTransition(async () => {
      try { await setDaysOffCount(employeeId, monthKey, n); notify("Выходные сохранены"); } catch (error) { setOffSet(offSet); setCountInput(String(offSet.size)); notify(error instanceof Error ? error.message : "Не удалось сохранить выходные", true); }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={total}
        value={countInput}
        onChange={(e) => setCountInput(e.target.value)}
        onBlur={saveCount}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        title="Количество выходных дней в этом месяце"
        className="w-14 h-8 px-2 border border-outline-variant rounded text-xs text-center focus:outline-none focus:border-primary disabled:opacity-60"
        disabled={pending}
      />
      <button
        ref={buttonRef}
        onClick={() => (open ? setOpen(false) : openPicker())}
        title="Выбрать конкретные дни в календаре"
        className={`h-8 w-8 flex items-center justify-center rounded border ${
          offSet.size > 0 ? "border-primary text-primary bg-primary/5" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        <Icon name="event_busy" className="text-[16px]" />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              className="days-off-popover fixed z-50 bg-white border border-outline-variant rounded-lg shadow-xl p-3 w-64"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-on-surface-variant">Выходные — {monthKey}</span>
                <button onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-primary">
                  <Icon name="close" className="text-[16px]" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-outline">{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => <span key={day}>{day}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (new Date(`${monthKey}-01T12:00:00`).getDay() + 6) % 7 }, (_, i) => <span key={`empty-${i}`} />)}
                {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
                  const date = `${monthKey}-${String(day).padStart(2, "0")}`;
                  const isOff = offSet.has(date);
                  return (
                    <button
                      key={day}
                      aria-label={`${date}${isOff ? ": выходной" : ": рабочий день"}`}
                      aria-pressed={isOff}
                      onClick={() => handleToggle(day)}
                      disabled={pending}
                      className={`h-7 w-7 rounded text-xs font-medium disabled:opacity-50 ${
                        isOff ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

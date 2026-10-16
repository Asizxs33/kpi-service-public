"use client";

import { useFeedback } from "./FeedbackProvider";
import Icon from "@/components/Icon";


import { useRef, useState, useTransition } from "react";
import { setFullServiceCount, setFullServiceReason } from "@/app/(app)/logs/actions";
import { holdScrollPosition } from "@/lib/hold-scroll";

/**
 * N отдельных кликабельных иконок (N = обслужено клиентов) — каждая
 * отмечает, получил ли соответствующий клиент полное обслуживание.
 * Левый клик по иконке i заполняет галочками все иконки до неё включительно
 * (i+1), либо, если она уже последняя закрашенная, снимает её (i) — как в
 * рейтинге со звёздами. Правый клик (контекстное меню) по любой иконке —
 * указать причину отклонения для этой позиции (сохраняется отдельно и
 * видна в тултипе, иконка с причиной подсвечена рамкой).
 */
export default function FullServiceRating({
  id,
  servedCount,
  initial,
  initialReasons,
}: {
  id: string;
  servedCount: number;
  initial: number;
  initialReasons?: Record<number, string>;
}) {
  const notify = useFeedback();
  const reasonDialog = useRef<HTMLDialogElement>(null);
  const [reasonIndex, setReasonIndex] = useState(0);
  const [reasonDraft, setReasonDraft] = useState("");
  const [count, setCount] = useState(Math.min(initial, servedCount));
  const [reasons, setReasons] = useState<Record<number, string>>(initialReasons ?? {});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick(index: number) {
    if (pending) return;
    const prev = count;
    const next = index + 1 === count ? index : index + 1;
    setCount(next);
    setError(null);
    holdScrollPosition();
    startTransition(async () => {
      try {
        await setFullServiceCount(id, next);
        notify("Обслуживание сохранено");
      } catch (e) {
        // Например, запись старше лимита «редактирование задним числом» —
        // откатываем и показываем причину, а не роняем всю страницу.
        setCount(prev);
        setError(e instanceof Error ? e.message : "Не удалось сохранить");
        setTimeout(() => setError(null), 5000);
      }
    });
  }

  function openReason(index: number) {
    if (pending) return;
    setReasonIndex(index);
    setReasonDraft(reasons[index] ?? "");
    setError(null);
    reasonDialog.current?.showModal();
  }

  function saveReason() {
    const index = reasonIndex;
    const trimmed = reasonDraft.trim();
    const prevReasons = reasons;
    const next = { ...reasons };
    if (trimmed) next[index] = trimmed;
    else delete next[index];
    setReasons(next);
    setError(null);
    holdScrollPosition();
    startTransition(async () => {
      try {
        await setFullServiceReason(id, index, trimmed || null);
        reasonDialog.current?.close();
        notify("Причина сохранена");
      } catch (e) {
        setReasons(prevReasons);
        setError(e instanceof Error ? e.message : "Не удалось сохранить");
        setTimeout(() => setError(null), 5000);
      }
    });
  }

  if (servedCount <= 0) {
    return <span className="text-on-surface-variant text-xs">—</span>;
  }

  return (
    <div className="service-rating relative inline-flex items-center gap-1 flex-wrap">
      {error && (
        <div className="absolute z-20 left-0 top-full mt-1 w-max max-w-[220px] px-2 py-1 rounded bg-error-container text-error text-xs shadow-lg">
          {error}
        </div>
      )}
      {Array.from({ length: servedCount }, (_, i) => {
        const filled = i < count;
        const reason = reasons[i];
        const title = reason ? `Причина: ${reason} (ПКМ — изменить)` : filled ? "Полное обслуживание — ПКМ, чтобы указать причину" : "Не отмечено — клик, ПКМ для причины";
        return (
          <button
            key={i}
            onClick={() => handleClick(i)}
            onContextMenu={(e) => { e.preventDefault(); openReason(i); }}
            aria-label={`Клиент ${i + 1}: ${filled ? "полное обслуживание" : "не отмечено"}`}
            aria-pressed={filled}
            disabled={pending}
            title={title}
            className={`inline-flex items-center justify-center rounded-lg h-7 w-7 transition-colors cursor-pointer ${pending ? "opacity-60" : ""} ${
              filled ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"
            } ${reason ? "ring-2 ring-amber-400" : ""}`}
          >
            <Icon name={filled ? "check" : "close"} className="text-[14px]" />
          </button>
        );
      })}
      <div className="service-meta"><span>{count} из {servedCount}</span><button type="button" disabled={pending} onClick={() => openReason(Math.min(count, servedCount - 1))}><Icon name="edit" />Причины</button></div>
      <dialog aria-label="Причина отклонения" ref={reasonDialog} className="reason-dialog" onClick={e => { if (e.target === e.currentTarget && !pending) reasonDialog.current?.close(); }}>
        <div className="flex items-center justify-between gap-4 mb-4"><h3 className="font-bold text-lg">Причина отклонения</h3><button type="button" disabled={pending} aria-label="Закрыть" onClick={() => reasonDialog.current?.close()}><Icon name="close" /></button></div>
        <label className="block text-sm text-on-surface-variant mb-4">Клиент<select value={reasonIndex} disabled={pending} onChange={e => { const index = Number(e.target.value); setReasonIndex(index); setReasonDraft(reasons[index] ?? ""); }} className="block w-full mt-1 p-2 border border-outline-variant">{Array.from({ length: servedCount }, (_, i) => <option key={i} value={i}>Клиент {i + 1}</option>)}</select></label>
        <label className="block text-sm text-on-surface-variant">Что помешало полному обслуживанию?<textarea value={reasonDraft} disabled={pending} onChange={e => setReasonDraft(e.target.value)} rows={3} className="block w-full mt-2 p-3 border border-outline-variant" placeholder="Укажите причину" /></label>
        {error && <p role="alert" className="text-error text-sm mt-2">{error}</p>}
        <div className="flex justify-end gap-3 mt-5"><button type="button" disabled={pending} onClick={() => reasonDialog.current?.close()} className="px-4 py-2 border border-outline-variant rounded-lg">Отмена</button><button type="button" disabled={pending} onClick={saveReason} className="px-4 py-2 bg-primary text-white rounded-lg">{pending ? "Сохранение…" : "Сохранить"}</button></div>
      </dialog>
    </div>
  );
}

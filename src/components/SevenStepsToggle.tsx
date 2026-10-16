"use client";

import { useFeedback } from "./FeedbackProvider";
import Icon from "@/components/Icon";


import { useState, useTransition } from "react";
import { toggleLogField } from "@/app/(app)/logs/actions";
import { holdScrollPosition } from "@/lib/hold-scroll";

export default function SevenStepsToggle({ id, initial }: { id: string; initial: boolean }) {
  const notify = useFeedback();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (pending) return;
    const prev = value;
    const next = !value;
    setValue(next);
    setError(null);
    holdScrollPosition();
    startTransition(async () => {
      try {
        await toggleLogField(id, "sevenSteps", next);
        notify("Отметка сохранена");
      } catch (e) {
        // Например, запись старше лимита «редактирование задним числом» —
        // откатываем оптимистичное изменение и показываем причину рядом с
        // кнопкой вместо падения всей страницы с неперехваченной ошибкой
        // server action.
        setValue(prev);
        setError(e instanceof Error ? e.message : "Не удалось сохранить");
        setTimeout(() => setError(null), 5000);
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleClick}
        aria-pressed={value}
        disabled={pending}
        title={value ? "7 шагов пройдены — нажмите, чтобы отменить" : "7 шагов не пройдены — нажмите, чтобы отметить"}
        className={`inline-flex items-center justify-center rounded-lg h-8 w-8 transition-colors cursor-pointer ${pending ? "opacity-60" : ""} ${
          value ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"
        }`}
      >
        <Icon name={value ? "check" : "close"} className="text-[14px]" />
      </button>
      {error && (
        <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-max max-w-[220px] px-2 py-1 rounded bg-error-container text-error text-xs shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

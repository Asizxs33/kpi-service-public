"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type Notify = (message: string, error?: boolean) => void;
const FeedbackContext = createContext<Notify>(() => {});

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const notify = useCallback<Notify>((message, error = false) => {
    clearTimeout(timer.current);
    setNotice({ message, error });
    timer.current = setTimeout(() => setNotice(null), error ? 7000 : 3500);
  }, []);
  return <FeedbackContext.Provider value={notify}>
    {children}
    <div className="feedback-region" aria-live="polite" aria-atomic="true">
      {notice && <div className="feedback-toast" data-error={notice.error}>
        <Icon name={notice.error ? "info" : "check"} /><span>{notice.message}</span>
        <button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice(null)}><Icon name="close" /></button>
      </div>}
    </div>
  </FeedbackContext.Provider>;
}

export function useFeedback() { return useContext(FeedbackContext); }

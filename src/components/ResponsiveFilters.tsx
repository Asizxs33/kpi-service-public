"use client";

import { useId, useState } from "react";
import Icon from "./Icon";

export default function ResponsiveFilters({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="responsive-filters" data-open={open}>
    <button type="button" className="filter-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name="settings" />Фильтры{active && <span className="filter-dot" />}<Icon name="chevron_right" className={open ? "-rotate-90" : "rotate-90"} /></button>
    <div id={id} className="filter-content">{children}</div>
  </div>;
}

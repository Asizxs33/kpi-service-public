import type { SVGProps } from "react";

// Small, consistent interface symbols. Inline SVG keeps icons independent of fonts.
const paths: Record<string, string> = {
  dashboard: "M3 3h7v7H3z M14 3h7v11h-7z M3 14h7v7H3z M14 18h7v3h-7z",
  group: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  receipt_long: "M6 3h12a1 1 0 0 1 1 1v17l-3-2-4 2-4-2-3 2V4a1 1 0 0 1 1-1 M9 7h6 M9 11h6 M9 15h3",
  target: "M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9 M16 3h5v5",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  admin_panel_settings: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M9 12l2 2 4-4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M6 18 18 6",
  check: "m5 12 4 4L19 6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  payments: "M3 5h18v14H3z M3 9h2 M19 15h2 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2z M9 7h6 M9 11h6 M9 15h3",
  point_of_sale: "M5 21h14 M7 21v-5h10v5 M4 3h16v9H4z M9 7h6",
  today: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16 M8 15h3v3H8z",
  trending_up: "m3 17 6-6 4 4 8-10 M15 5h6v6",
  trending_down: "m3 7 6 6 4-4 8 10 M15 19h6v-6",
  star_rate: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
  stairs: "M3 20h6v-6h6V8h6V3",
  verified_user: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M9 12l2 2 4-4",
  military_tech: "m8 3 4 5 4-5 M7 3h10 M17 13a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M9 18l-1 4 4-2 4 2-1-4",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  picture_as_pdf: "M14 2H5v20h14V7z M14 2v5h5 M8 12h8 M8 16h5",
  add: "M12 5v14 M5 12h14",
  search: "m21 21-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  edit: "m16 3 5 5-12 12-6 1 1-6z M13 6l5 5",
  delete: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  arrow_back: "M19 12H5 M12 5l-7 7 7 7",
  chevron_right: "m9 5 7 7-7 7",
  expand_more: "m6 9 6 6 6-6",
  expand_less: "m6 15 6-6 6 6",
  table_rows: "M3 4h18v16H3z M3 9h18 M3 14h18",
  event_busy: "M4 5h16v16H4z M8 3v4 M16 3v4 M4 11h16 M10 14l4 4 M14 14l-4 4",
  history: "M3 11a9 9 0 1 1 2.7 7 M3 4v7h7 M12 7v5l3 2",
  sync: "M20 7a9 9 0 0 0-15-2L2 8 M2 3v5h5 M4 17a9 9 0 0 0 15 2l3-3 M22 21v-5h-5",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01",
  shopping_cart: "M2 3h3l3 12h11l3-8H6 M10 20h.01 M18 20h.01",
  add_shopping_cart: "M2 3h3l3 12h11l3-8 M10 20h.01 M18 20h.01 M14 2v8 M10 6h8",
};
paths.star = paths.star_rate;

export default function Icon({ name, className = "", ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`ui-icon ${className}`} {...props}>
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}

import type { ReactNode } from "react";

export type NavId =
  | "new-download"
  | "goc-import"
  | "history"
  | "settings"
  | "diagnostics";

const NAV_ITEMS: { id: NavId; label: string }[] = [
  { id: "new-download", label: "New Download" },
  { id: "goc-import", label: "GoC Import" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
  { id: "diagnostics", label: "Diagnostics" },
];

interface ShellProps {
  active: NavId;
  onNavigate: (id: NavId) => void;
  children: ReactNode;
}

export function Shell({ active, onNavigate, children }: ShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <svg
            className="brand-mark"
            viewBox="0 0 64 64"
            role="img"
            aria-label="Game of Creators"
          >
            <rect width="64" height="64" rx="8" fill="#170337" />
            <path
              d="M12 40 L32 12 L52 40 Z"
              fill="none"
              stroke="#C9A227"
              strokeWidth="3"
            />
            <circle cx="32" cy="36" r="6" fill="#C9A227" />
          </svg>
          <p className="brand-name">Game of Creators</p>
          <p className="brand-sub">Downloader</p>
        </div>
        <nav className="nav" aria-label="Sections">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-btn"
              aria-current={active === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

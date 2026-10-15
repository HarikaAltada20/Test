"use client";

import { useEffect, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "You're in" banner for a creator who opens a campaign from an approval or
 * access notification (the link carries ?welcome=1).
 */
export function WelcomeBanner({ isDark }: { isDark: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("welcome") !== "1") return;
    setShow(true);
    // Drop the flag so a refresh doesn't show it again.
    params.delete("welcome");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  if (!show) return null;
  return (
    <div
      role="status"
      className={cn(
        "mb-6 flex items-start gap-3 rounded-xl border p-4",
        isDark
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-green-200 bg-green-50 text-green-900",
      )}
    >
      <PartyPopper className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-semibold">You&apos;re in!</p>
        <p className="text-sm opacity-90">
          The brand approved you. Read the brief below, then submit your content.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setShow(false)}
        className="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

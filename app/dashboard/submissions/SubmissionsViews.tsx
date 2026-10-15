"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { listMyDrafts } from "@/components/content-drafts/api";
import { MyDraftsPanel } from "@/components/content-drafts/MyDraftsPanel";

/**
 * My Submissions: Published | Drafts. Drafts are videos sent for review on
 * campaigns that approve content before it's posted (?view=drafts). The
 * switch only shows once the creator has drafts.
 */
export function SubmissionsViews({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isDark = useDashboardDark();
  const view = params.get("view") === "drafts" ? "drafts" : "published";
  const [hasDrafts, setHasDrafts] = useState(false);
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyDrafts({ status: "all", offset: 0, limit: 1 })
      .then((page) => {
        if (cancelled) return;
        setHasDrafts(page.total > 0);
        setActionCount((page.counts.revision_requested ?? 0) + (page.counts.approved ?? 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const show = (next: "published" | "drafts") => {
    const query = new URLSearchParams(params.toString());
    for (const key of ["view", "status", "campaign", "draft"]) query.delete(key);
    if (next === "drafts") query.set("view", "drafts");
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const showSwitch = hasDrafts || view === "drafts";

  return (
    <>
      {showSwitch && (
        <div className={cn("mx-auto max-w-[1280px] px-[16px] pt-[24px]", isDark && "dark")}>
          <div
            role="group"
            aria-label="Show"
            className="inline-flex rounded-lg border border-gray-200 bg-white p-1 dark:border-white/10 dark:bg-white/5"
          >
            {(["published", "drafts"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => show(v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                  view === v
                    ? "bg-[#4211a1] text-white"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10",
                )}
              >
                {v === "published" ? "Published" : "Drafts"}
                {v === "drafts" && actionCount > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs",
                      view === v ? "bg-white/20" : "bg-purple-100 text-[#4A00BE] dark:bg-[#7F39EC]/30 dark:text-purple-100",
                    )}
                  >
                    {actionCount}
                    <span className="sr-only"> need your action</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div hidden={view === "drafts"}>{children}</div>

      {view === "drafts" && (
        <div className={cn("mx-auto flex max-w-[1280px] flex-col gap-[16px] px-[16px] py-[24px]", isDark && "dark")}>
          <div>
            <h1 className="text-[24px] font-semibold leading-tight text-slate-900 dark:text-white">My Drafts</h1>
            <p className="mt-1 text-[14px] leading-snug text-slate-500 dark:text-slate-400">
              Videos you sent to brands for approval before posting.
            </p>
          </div>
          <MyDraftsPanel isDark={isDark} onActionCountChange={setActionCount} />
        </div>
      )}
    </>
  );
}

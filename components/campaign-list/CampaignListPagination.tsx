"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignListPaginationProps {
  page: number;
  limit: number;
  total: number;
  loading: boolean;
  isDark: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function CampaignListPagination({
  page, limit, total, loading, isDark, onPageChange, onLimitChange,
}: CampaignListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);
  const pages: (number | string)[] = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : page <= 4
      ? [1, 2, 3, 4, 5, "end-gap", totalPages]
      : page >= totalPages - 3
        ? [1, "start-gap", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "start-gap", page - 1, page, page + 1, "end-gap", totalPages];
  const controlClass = cn(
    "h-11 rounded-xl border transition-colors motion-reduce:transition-none focus-visible:ring-violet-500 disabled:opacity-40",
    isDark
      ? "border-white/10 bg-transparent text-slate-300 hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-white"
      : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",
  );

  return (
    <div
      className={cn(
        "mt-6 flex flex-col gap-4 rounded-2xl border px-4 py-4 sm:px-5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between",
        isDark ? "border-white/10 bg-[#120D27]" : "border-slate-200/80 bg-white shadow-sm",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:justify-start">
        <p
          role="status"
          className={cn("text-sm tabular-nums", isDark ? "text-slate-400" : "text-slate-500")}
        >
          <span className={cn("font-semibold", isDark ? "text-slate-100" : "text-slate-900")}>
            {start}–{end}
          </span>{" "}
          of <span className={cn("font-medium", isDark ? "text-slate-200" : "text-slate-700")}>{total}</span>{" "}
          {total === 1 ? "campaign" : "campaigns"}
        </p>
        <div className={cn("flex items-center gap-3 sm:border-l sm:pl-6", isDark ? "border-white/10" : "border-slate-200")}>
          <label htmlFor="campaigns-per-page" className={cn("whitespace-nowrap text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
            Per page
          </label>
          <div className="relative">
            {/* Keep the native picker: portaled menus can shift the zoomed dashboard. */}
            <select
              id="campaigns-per-page"
              aria-label="Campaigns per page"
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              style={{ colorScheme: isDark ? "dark" : "light" }}
              className={cn(
                controlClass,
                "w-20 cursor-pointer appearance-none pl-3.5 pr-8 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isDark ? "bg-[#120D27] focus-visible:ring-offset-[#120D27]" : "focus-visible:ring-offset-white",
              )}
            >
              {[9, 15, 21, 30].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className={cn("pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2", isDark ? "text-slate-400" : "text-slate-500")} />
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Campaign pagination"
          className={cn("flex items-center justify-between gap-2 border-t pt-4 sm:justify-center lg:ml-auto lg:border-t-0 lg:pt-0", isDark ? "border-white/10" : "border-slate-100")}
        >
          <Button
            type="button"
            variant="outline"
            aria-label="Previous page"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className={cn(controlClass, "px-3")}
          >
            <ChevronLeft aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className={cn("text-sm tabular-nums lg:hidden", isDark ? "text-slate-400" : "text-slate-500")}>
            Page <span className={cn("font-semibold", isDark ? "text-white" : "text-slate-900")}>{page}</span> of {totalPages}
          </span>
          <div className="hidden items-center gap-1 lg:flex">
            {pages.map((item) => typeof item === "string" ? (
              <span key={item} aria-hidden="true" className={cn("w-8 text-center", isDark ? "text-slate-500" : "text-slate-400")}>…</span>
            ) : (
              <Button
                key={item}
                type="button"
                variant="ghost"
                aria-label={`Page ${item}`}
                aria-current={item === page ? "page" : undefined}
                disabled={loading}
                onClick={() => onPageChange(item)}
                className={cn(
                  controlClass,
                  "min-w-11 border-transparent px-3 tabular-nums",
                  item === page && (isDark
                    ? "bg-violet-500 font-semibold text-white shadow-sm hover:bg-violet-600 hover:text-white"
                    : "bg-[#4A00BE] font-semibold text-white shadow-sm hover:bg-[#3D00A0] hover:text-white"),
                )}
              >
                {item}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            aria-label="Next page"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className={cn(controlClass, "px-3")}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}

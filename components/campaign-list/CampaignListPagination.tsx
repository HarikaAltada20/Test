"use client";

import { ContestListIcon } from "@/components/campaign-list/contest-list-icons";
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
  page,
  limit,
  total,
  loading,
  isDark,
  onPageChange,
  onLimitChange,
}: CampaignListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);
  const pages: (number | string)[] =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, index) => index + 1)
      : page <= 4
        ? [1, 2, 3, 4, 5, "end-gap", totalPages]
        : page >= totalPages - 3
          ? [1, "start-gap", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
          : [1, "start-gap", page - 1, page, page + 1, "end-gap", totalPages];

  const pagerButton = cn(
    "inline-flex items-center justify-center gap-2 rounded-[10px] border px-3.5 py-[7px] text-[13px] font-semibold shadow-[0px_1px_1px_rgba(10,10,10,0.04)] disabled:opacity-40",
    isDark
      ? "border-white/10 bg-transparent text-white"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
  );

  return (
    <div
      className={cn(
        "mt-6 flex flex-col gap-4 rounded-2xl border px-5 py-3.5 shadow-[0px_1px_3px_rgba(10,10,10,0.04)] lg:flex-row lg:items-center lg:justify-between",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#e5e5e5] bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <p className={cn("text-[13px] font-medium tabular-nums", isDark ? "text-neutral-200" : "text-[#404040]")}>
          {start}–{end} of {total} {total === 1 ? "campaign" : "campaigns"}
        </p>
        <span className={cn("hidden h-[18px] w-px sm:block", isDark ? "bg-white/10" : "bg-[#e5e5e5]")} />
        <label
          htmlFor="campaigns-per-page"
          className={cn("text-[13px] font-medium", isDark ? "text-neutral-400" : "text-[#737373]")}
        >
          Per page
        </label>
        <div className="relative">
          <select
            id="campaigns-per-page"
            aria-label="Campaigns per page"
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            style={{ colorScheme: isDark ? "dark" : "light" }}
            className={cn(
              "cursor-pointer appearance-none rounded-lg border bg-transparent py-1.5 pl-3 pr-8 text-[13px] font-semibold outline-none",
              isDark ? "border-white/10 text-white" : "border-[#e5e5e5] text-[#0a0a0a]",
            )}
          >
            {[9, 15, 21, 30].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
            <ContestListIcon name="chevron-down-sm" alt="" />
          </span>
        </div>
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Campaign pagination" className="flex items-center gap-1.5">
          <button
            type="button"
            className={pagerButton}
            aria-label="Previous page"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            <ContestListIcon name="arrow-left" alt="" />
            Previous
          </button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {pages.map((item) =>
              typeof item === "string" ? (
                <span key={item} aria-hidden="true" className="w-6 text-center text-[#737373]">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  disabled={loading}
                  onClick={() => onPageChange(item)}
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-lg text-[13px] font-semibold",
                    item === page
                      ? "bg-[#0a0a0a] text-white"
                      : isDark
                        ? "border border-white/10 text-neutral-200"
                        : "border border-[#e5e5e5] text-[#404040]",
                  )}
                >
                  {item}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            className={pagerButton}
            aria-label="Next page"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ContestListIcon name="chevron-right" alt="" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

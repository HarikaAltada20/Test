"use client";

import { CampaignPlatformFilter } from "@/components/campaign-list/CampaignPlatformFilter";
import {
  ContestListIcon,
  ContestListSegmentIcon,
} from "@/components/campaign-list/contest-list-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OPPORTUNITY_ACCESS_FILTERS,
  OPPORTUNITY_ACCESS_FILTER_LABELS,
  type OpportunityAccessFilter,
} from "@/lib/campaign-access";
import type { CampaignFilterPlatform } from "@/lib/campaign-platform-filter";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  ["relevance_desc", "Relevance: Highest to Lowest"],
  ["start_date_asc", "Start Date: Soonest First"],
  ["start_date_desc", "Start Date: Furthest First"],
  ["end_date_asc", "End Date: Soonest First"],
  ["end_date_desc", "End Date: Furthest First"],
  ["value_desc", "Prize/Budget: High to Low"],
  ["value_asc", "Prize/Budget: Low to High"],
  ["budget_remaining_desc", "Budget Left: Most"],
  ["budget_remaining_asc", "Budget Left: Least"],
  ["budget_used_desc", "Budget Used: Most"],
  ["budget_used_asc", "Budget Used: Least"],
  ["views_desc", "Views: High to Low"],
  ["views_asc", "Views: Low to High"],
  ["cpm_rate_desc", "CPM Rate: High to Low"],
  ["cpm_rate_asc", "CPM Rate: Low to High"],
  ["submissions_desc", "Submissions: High to Low"],
  ["submissions_asc", "Submissions: Low to High"],
] as const;

const STATUS_TABS = [
  ["all", "All", "all"],
  ["live", "Live", "live"],
  ["upcoming", "Upcoming", "upcoming"],
  ["ended", "Ended", "ended"],
] as const;

function segmentClass(active: boolean, isDark: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-[7px] text-[13px] font-medium",
    active
      ? "bg-[#0a0a0a] text-white"
      : isDark
        ? "text-neutral-400 hover:text-white"
        : "text-[#737373] hover:text-[#0a0a0a]",
  );
}

function selectTriggerClass(isDark: boolean) {
  return cn(
    "h-auto w-full min-w-0 gap-2 rounded-xl px-3.5 py-2.5 shadow-none hover:bg-white [&>svg]:hidden",
    isDark
      ? "border-white/10 bg-[#161616] text-white hover:bg-[#161616]"
      : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
  );
}

export function CreatorCampaignFilters({
  isDark,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  mediaType,
  onMediaTypeChange,
  eligibilityFilter,
  onEligibilityChange,
  displayViewMode,
  layoutAllowsListView,
  onViewModeChange,
  sortOption,
  onSortChange,
  platformFilter,
  onPlatformFilterChange,
  platformOptions,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  tabCounts,
  accessFilter,
  onAccessChange,
}: {
  isDark: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  mediaType: "all" | "text" | "media";
  onMediaTypeChange: (value: "all" | "text" | "media") => void;
  eligibilityFilter: "all" | "eligible";
  onEligibilityChange: (value: "all" | "eligible") => void;
  displayViewMode: "grid" | "list";
  layoutAllowsListView: boolean;
  onViewModeChange: (mode: "grid" | "list") => void;
  sortOption: string;
  onSortChange: (value: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (value: string) => void;
  platformOptions: CampaignFilterPlatform[];
  typeFilter: string;
  onTypeChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  tabCounts: { all: number; live: number; upcoming: number; ended: number };
  accessFilter: OpportunityAccessFilter;
  onAccessChange: (value: OpportunityAccessFilter) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-[0px_1px_3px_rgba(10,10,10,0.04)]",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#e5e5e5] bg-white",
      )}
    >
      <div className="flex flex-col gap-3.5 p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show campaigns">
          {OPPORTUNITY_ACCESS_FILTERS.map((filter) => {
            const active = accessFilter === filter;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={active}
                onClick={() => onAccessChange(filter)}
                className={cn(
                  "inline-flex items-center rounded-full px-3.5 py-2 text-[13px] font-medium",
                  active
                    ? "bg-[#0a0a0a] text-white"
                    : isDark
                      ? "border border-white/10 bg-transparent text-neutral-200"
                      : "border border-[#e5e5e5] bg-white text-[#404040]",
                )}
              >
                {OPPORTUNITY_ACCESS_FILTER_LABELS[filter]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-[11px]",
              isDark ? "border-white/10 bg-[#161616]" : "border-[#e5e5e5] bg-white",
            )}
          >
            <ContestListIcon name="search" alt="" />
            <input
              type="text"
              role="searchbox"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchQuery.trim() !== "") {
                  event.preventDefault();
                  onSearchSubmit();
                }
              }}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-sm outline-none",
                isDark
                  ? "text-white placeholder:text-[#a3a3a3]"
                  : "text-[#0a0a0a] placeholder:text-[#a3a3a3]",
              )}
            />
            {searchQuery.trim() !== "" ? (
              <button
                type="button"
                onClick={() => onSearchQueryChange("")}
                className="text-xs font-semibold text-[#737373]"
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Campaign eligibility"
              className={cn(
                "inline-flex items-center gap-0.5 rounded-[10px] p-[3px]",
                isDark ? "bg-white/10" : "bg-[#f5f5f5]",
              )}
            >
              {(
                [
                  ["all", "All"],
                  ["eligible", "Eligible"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onEligibilityChange(id)}
                  className={segmentClass(eligibilityFilter === id, isDark)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              role="group"
              aria-label="Opportunity type"
              className={cn(
                "inline-flex items-center gap-0.5 rounded-[10px] p-[3px]",
                isDark ? "bg-white/10" : "bg-[#f5f5f5]",
              )}
            >
              {(
                [
                  ["all", "layout", "All"],
                  ["text", "file", "Text & image"],
                  ["media", "video", "Video"],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onMediaTypeChange(id)}
                  className={segmentClass(mediaType === id, isDark)}
                >
                  <ContestListSegmentIcon name={icon} active={mediaType === id} />
                  {label}
                </button>
              ))}
            </div>
            {layoutAllowsListView ? (
              <div
                role="group"
                aria-label="Layout"
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-[10px] p-[3px]",
                  isDark ? "bg-white/10" : "bg-[#f5f5f5]",
                )}
              >
                {(
                  [
                    ["grid", "grid", "Grid"],
                    ["list", "list", "List"],
                  ] as const
                ).map(([id, icon, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onViewModeChange(id)}
                    className={segmentClass(displayViewMode === id, isDark)}
                  >
                    <ContestListSegmentIcon name={icon} active={displayViewMode === id} />
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select value={sortOption} onValueChange={onSortChange}>
            <SelectTrigger isDark={isDark} className={selectTriggerClass(isDark)}>
              <ContestListIcon name="sort" alt="" />
              <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className={cn("text-[10px] font-medium", isDark ? "text-neutral-400" : "text-[#a3a3a3]")}>
                  Sort by
                </span>
                <span className="w-full truncate text-[13px] font-medium">
                  <SelectValue placeholder="Relevance: Highest to Lowest" />
                </span>
              </div>
              <ContestListIcon name="chevron-down" alt="" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              {SORT_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} isDark={isDark} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <CampaignPlatformFilter
            value={platformFilter}
            onChange={onPlatformFilterChange}
            platforms={platformOptions}
            isDark={isDark}
            caption="Platform"
            leading={<ContestListIcon name="globe" alt="" />}
            trailing={<ContestListIcon name="chevron-down" alt="" />}
          />

          <Select value={typeFilter} onValueChange={onTypeChange}>
            <SelectTrigger isDark={isDark} className={selectTriggerClass(isDark)}>
              <ContestListIcon name="layers" alt="" />
              <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className={cn("text-[10px] font-medium", isDark ? "text-neutral-400" : "text-[#a3a3a3]")}>
                  Campaign type
                </span>
                <span className="w-full truncate text-[13px] font-medium">
                  <SelectValue placeholder="All Types" />
                </span>
              </div>
              <ContestListIcon name="chevron-down" alt="" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              <SelectItem isDark={isDark} value="all">All Types</SelectItem>
              <SelectItem isDark={isDark} value="leaderboard">Leaderboard</SelectItem>
              <SelectItem isDark={isDark} value="cpm">CPM</SelectItem>
              <SelectItem isDark={isDark} value="milestone">Milestone</SelectItem>
              <SelectItem isDark={isDark} value="dual_rewards">Dual Rewards</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          className={cn(
            "flex w-full items-center gap-1 rounded-xl p-1",
            isDark ? "bg-white/5" : "bg-[#f5f5f5]",
          )}
          role="tablist"
          aria-label="Campaign status"
        >
          {STATUS_TABS.map(([id, label, countKey]) => {
            const active = statusFilter === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusChange(id)}
                className={cn(
                  "flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap",
                  active
                    ? isDark
                      ? "bg-white text-[#0a0a0a]"
                      : "bg-[#0a0a0a] text-white"
                    : isDark
                      ? "text-slate-300 hover:text-white"
                      : "text-[#404040] hover:text-[#0a0a0a]",
                )}
              >
                {label}
                <span
                  className={cn(
                    "text-[13px] font-normal tabular-nums",
                    active
                      ? isDark
                        ? "text-[#0a0a0a]/60"
                        : "text-white/70"
                      : isDark
                        ? "text-slate-400"
                        : "text-[#737373]",
                  )}
                >
                  ({tabCounts[countKey]})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
import type { CampaignFilterPlatform } from "@/lib/campaign-platform-filter";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  ["created_at_desc", "Date Created: Latest"],
  ["created_at_asc", "Date Created: Earliest"],
  ["start_date_asc", "Launch Date: Closest"],
  ["start_date_desc", "Launch Date: Farthest"],
  ["end_date_asc", "End Date: Closest"],
  ["end_date_desc", "End Date: Farthest"],
  ["value_desc", "Prize/Budget: High to Low"],
  ["value_asc", "Prize/Budget: Low to High"],
  ["budget_remaining_desc", "Budget Left: Most"],
  ["budget_remaining_asc", "Budget Left: Least"],
  ["budget_used_desc", "Budget Used: Most"],
  ["budget_used_asc", "Budget Used: Least"],
  ["approval_rate_desc", "Approval Rate: High"],
  ["approval_rate_asc", "Approval Rate: Low"],
  ["views_desc", "Views: High"],
  ["views_asc", "Views: Low"],
  ["cpm_rate_desc", "CPM Rate: High to Low"],
  ["cpm_rate_asc", "CPM Rate: Low to High"],
  ["submissions_desc", "Submissions: High to Low"],
  ["submissions_asc", "Submissions: Low to High"],
] as const;

const STATUS_TABS = [
  ["all", "All", "all"],
  ["draft", "Draft", "draft"],
  ["pending_approval", "Pending approval", "pending_approval"],
  ["ready", "Ready", "ready"],
  ["upcoming", "Upcoming", "upcoming"],
  ["live", "Live", "live"],
  ["ended", "Ended", "ended"],
  ["rejected", "Rejected", "rejected"],
] as const;

const PHASE_TABS = [
  ["all", "All phases", "ended"],
  ["post_pending_review", "Pending review", "post_pending_review"],
  ["post_in_review", "In review", "post_in_review"],
  ["post_payment_pending", "Payment pending", "post_payment_pending"],
  ["post_paid", "Completed paid", "post_paid"],
] as const;

type TabCounts = {
  all: number;
  draft: number;
  pending_approval: number;
  ready: number;
  upcoming: number;
  live: number;
  ended: number;
  rejected: number;
};

type PhaseCounts = {
  post_pending_review: number;
  post_in_review: number;
  post_payment_pending: number;
  post_paid: number;
};

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

export function BrandCampaignFilters({
  isDark,
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  contestFormatFilter,
  onContestFormatChange,
  displayViewMode,
  layoutAllowsListView,
  onViewModeChange,
  sortOption,
  onSortChange,
  platformFilter,
  onPlatformFilterChange,
  platformOptions,
  contestTypeFilter,
  onContestTypeChange,
  selectedTab,
  onTabChange,
  tabCounts,
  showPostContestPipeline,
  postContestPhaseFilter,
  onPostPhaseChange,
  phaseCounts,
}: {
  isDark: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  contestFormatFilter: string;
  onContestFormatChange: (value: "all" | "text_image" | "video") => void;
  displayViewMode: "grid" | "list";
  layoutAllowsListView: boolean;
  onViewModeChange: (mode: "grid" | "list") => void;
  sortOption: string;
  onSortChange: (value: string) => void;
  platformFilter: string;
  onPlatformFilterChange: (value: string) => void;
  platformOptions: readonly CampaignFilterPlatform[];
  contestTypeFilter: string;
  onContestTypeChange: (value: string) => void;
  selectedTab: string;
  onTabChange: (tab: string) => void;
  tabCounts: TabCounts;
  showPostContestPipeline: boolean;
  postContestPhaseFilter: string;
  onPostPhaseChange: (phase: string) => void;
  phaseCounts: PhaseCounts;
}) {
  const phaseCount = (key: (typeof PHASE_TABS)[number][2]) =>
    key === "ended" ? tabCounts.ended : phaseCounts[key];

  return (
    <div
      className={cn(
        "rounded-2xl border shadow-[0px_1px_3px_rgba(10,10,10,0.04)]",
        isDark ? "border-white/10 bg-[#161616]" : "border-[#e5e5e5] bg-white",
      )}
    >
      <div className="flex flex-col gap-3.5 p-5">
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
              aria-label="Contest format"
              className={cn(
                "inline-flex items-center gap-0.5 rounded-[10px] p-[3px]",
                isDark ? "bg-white/10" : "bg-[#f5f5f5]",
              )}
            >
              {(
                [
                  ["all", "layout", "All"],
                  ["text_image", "file", "Text & image"],
                  ["video", "video", "Video"],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onContestFormatChange(id)}
                  className={segmentClass(contestFormatFilter === id, isDark)}
                >
                  <ContestListSegmentIcon name={icon} active={contestFormatFilter === id} />
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
                  <SelectValue placeholder="Date Created: Latest" />
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

          <Select value={contestTypeFilter} onValueChange={onContestTypeChange}>
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

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Campaign status">
          {STATUS_TABS.map(([id, label, countKey]) => {
            const active = selectedTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-medium",
                  active
                    ? "bg-[#0a0a0a] text-white"
                    : isDark
                      ? "border border-white/10 bg-transparent text-neutral-200"
                      : "border border-[#e5e5e5] bg-white text-[#404040]",
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-[7px] py-px text-[11px] font-semibold",
                    active
                      ? "bg-white/20 text-white"
                      : isDark
                        ? "bg-white/10 text-neutral-200"
                        : "bg-[#f5f5f5] text-[#404040]",
                  )}
                >
                  {tabCounts[countKey]}
                </span>
              </button>
            );
          })}
        </div>

        {showPostContestPipeline ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border px-3.5 py-2.5 lg:flex-row lg:items-center",
              isDark ? "border-white/10 bg-white/[0.03]" : "border-[#e5e5e5] bg-[#fafafa]",
            )}
          >
            <div className="shrink-0">
              <p className="text-[10px] font-semibold tracking-[0.8px] text-[#737373]">
                AFTER CONTEST ENDS
              </p>
              <p className={cn("text-xs", isDark ? "text-neutral-400" : "text-[#737373]")}>
                Narrow by payout step
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PHASE_TABS.map(([id, label, countKey]) => {
                const active = postContestPhaseFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPostPhaseChange(id)}
                    className={cn(
                      "inline-flex items-center gap-3 rounded-lg border px-3 py-1.5 text-sm font-medium",
                      active
                        ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                        : isDark
                          ? "border-white/10 bg-transparent text-neutral-200"
                          : "border-[#e5e5e5] bg-white text-[#404040]",
                    )}
                  >
                    {label}
                    <span className={cn("text-[11px] font-semibold", active ? "text-white" : "text-[#737373]")}>
                      {phaseCount(countKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

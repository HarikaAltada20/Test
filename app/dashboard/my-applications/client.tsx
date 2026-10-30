"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Search,
  Trophy,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  applicationDisplayStatus,
  type MyApplicationListItem,
} from "@/lib/campaign-access";
import { myApplicationsApi, type MyApplicationsResponse } from "@/components/campaign-access/api";
import { ApplicationStatusBadge } from "@/components/campaign-access/AccessBadge";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";

type Tab = ApplicationStatus | "all";

/** Creator-facing names; "rejected" reads as "Not selected". */
const TAB_LABELS: Record<Tab, string> = {
  all: "All",
  pending: "Under review",
  approved: "Approved",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const TABS: Tab[] = ["all", ...APPLICATION_STATUSES];

const primaryButton =
  "rounded-full bg-[#1a1a1a] px-5 text-[15px] font-medium text-white hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90";
const outlineButton =
  "rounded-full border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7] dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

function nextStep(app: MyApplicationListItem): string {
  if (app.campaign.has_ended) return "This campaign has ended.";
  if (applicationDisplayStatus(app) === "access_removed") {
    return "The brand approved you, then removed you from this campaign. Contact them if you think this was a mistake.";
  }
  switch (app.status) {
    case "pending":
      return "The brand is reviewing your application. We'll notify you when they decide.";
    case "approved":
      return "You're in. Open the campaign to see the full brief and submit.";
    case "rejected":
      return "The brand didn't select you this time.";
    default:
      return "You withdrew this application. You can apply again while applications are open.";
  }
}

function statusAccent(status: ReturnType<typeof applicationDisplayStatus>, isDark: boolean) {
  switch (status) {
    case "pending":
      return isDark ? "bg-amber-400" : "bg-amber-500";
    case "approved":
      return isDark ? "bg-emerald-400" : "bg-emerald-500";
    case "rejected":
      return isDark ? "bg-red-400" : "bg-red-500";
    case "withdrawn":
    case "access_removed":
    default:
      return isDark ? "bg-white/40" : "bg-[#a1a1aa]";
  }
}

function ApplicationCard({
  app,
  isDark,
  ink,
  muted,
  soft,
  cardClass,
}: {
  app: MyApplicationListItem;
  isDark: boolean;
  ink: string;
  muted: string;
  soft: string;
  cardClass: string;
}) {
  const title = app.campaign.title || "Untitled campaign";
  const display = applicationDisplayStatus(app);
  const hasAccess = app.status === "approved" && app.on_access_list;

  return (
    <li
      className={cn(
        "group relative overflow-hidden transition-all duration-200",
        cardClass,
        "hover:border-[#7c3aed]/35 hover:shadow-[0_8px_24px_rgba(26,26,26,0.06)] dark:hover:border-white/25 dark:hover:shadow-none",
      )}
    >
      <div
        className={cn("absolute inset-y-0 left-0 w-1", statusAccent(display, isDark))}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:pl-6">
        <div
          className={cn(
            "relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-[88px] sm:w-[132px]",
            isDark ? "bg-white/5" : "bg-[#f3f3f5]",
          )}
        >
          {app.campaign.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={app.campaign.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Trophy
              className={cn("h-8 w-8", isDark ? "text-white/35" : "text-[#a1a1aa]")}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn("truncate text-[17px] font-semibold leading-snug", ink)}>
              {title}
            </h2>
            <ApplicationStatusBadge
              status={display}
              label={display === "access_removed" ? undefined : TAB_LABELS[app.status]}
            />
          </div>

          {app.campaign.brand_name && (
            <p className={cn("text-sm", soft)}>by {app.campaign.brand_name}</p>
          )}

          <p className={cn("flex flex-wrap items-center gap-x-2 text-xs", muted)}>
            <RelativeTime value={app.created_at} prefix="Applied" />
            {app.reviewed_at && app.status !== "pending" && (
              <>
                <span aria-hidden="true">·</span>
                <RelativeTime value={app.reviewed_at} prefix="Reviewed" />
              </>
            )}
          </p>

          <p className={cn("text-sm leading-relaxed", soft)}>{nextStep(app)}</p>

          {app.status === "rejected" && app.rejection_reason && (
            <blockquote
              className={cn(
                "whitespace-pre-wrap border-l-2 pl-3 text-sm italic",
                isDark
                  ? "border-red-400/40 text-white/70"
                  : "border-red-300 text-[#55555E]",
              )}
            >
              {app.rejection_reason}
            </blockquote>
          )}
        </div>

        {app.campaign.is_published && (
          <Button
            asChild
            className={cn(
              "h-10 w-full shrink-0 sm:w-auto",
              hasAccess ? primaryButton : outlineButton,
            )}
          >
            <Link
              href={`/dashboard/opportunities/${app.contest_id}`}
              className="inline-flex items-center gap-1.5"
            >
              {hasAccess ? "Open campaign" : "View campaign"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">: {title}</span>
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

function ListSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Loading your applications">
      {Array.from({ length: 3 }, (_, i) => (
        <li
          key={i}
          className={cn(
            "overflow-hidden rounded-2xl border p-5",
            isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
          )}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Skeleton
              className={cn(
                "h-36 w-full rounded-xl sm:h-[88px] sm:w-[132px]",
                isDark ? "bg-white/10" : "bg-[#ececef]",
              )}
            />
            <div className="flex-1 space-y-2.5">
              <Skeleton className={cn("h-5 w-1/2", isDark ? "bg-white/10" : "bg-[#ececef]")} />
              <Skeleton className={cn("h-4 w-1/3", isDark ? "bg-white/10" : "bg-[#ececef]")} />
              <Skeleton className={cn("h-4 w-2/3", isDark ? "bg-white/10" : "bg-[#ececef]")} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  isDark,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  isDark: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
        active
          ? isDark
            ? "border-white bg-[#1c1c1c] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
            : "border-[#1a1a1a] bg-white shadow-[0_1px_0_rgba(26,26,26,0.04)]"
          : isDark
            ? "border-white/10 bg-[#161616] hover:border-white/20"
            : "border-[#ececef] bg-white hover:border-[#d4d4d8]",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[22px] font-semibold leading-none tracking-tight",
            isDark ? "text-white" : "text-[#1a1a1a]",
          )}
        >
          {value}
        </span>
        <span
          className={cn(
            "mt-1 block truncate text-xs font-medium",
            isDark ? "text-white/50" : "text-[#8d8d95]",
          )}
        >
          {label}
        </span>
      </span>
    </button>
  );
}

export default function MyApplicationsClient() {
  const isDark = useDashboardDark();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MyApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    myApplicationsApi
      .list({ status: tab, page })
      .then((res) => {
        if (id === latest.current) setData(res);
      })
      .catch((e: unknown) => {
        if (id === latest.current) setError(e instanceof Error ? e.message : "Could not load applications");
      })
      .finally(() => {
        if (id === latest.current) setLoading(false);
      });
  }, [tab, page, reloadKey]);

  const counts = data?.counts;
  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const ink = isDark ? "text-white" : "text-[#1a1a1a]";
  const muted = isDark ? "text-white/50" : "text-[#8d8d95]";
  const soft = isDark ? "text-white/70" : "text-[#55555E]";
  const cardClass = cn(
    "overflow-hidden rounded-2xl border",
    isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
  );

  const selectTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  return (
    <div className={cn("mx-auto max-w-7xl space-y-6 p-4 md:p-6", isDark && "dark")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <h1 className={cn("text-[34px] font-bold tracking-tight", ink)}>
            My applications
          </h1>
          <p className={cn("text-base", soft)}>
            Campaigns you applied to and where each application stands.
          </p>
        </div>
        {!loading && allCount > 0 && (
          <Button asChild className={cn(primaryButton, "h-10")}>
            <Link
              href="/dashboard/opportunities"
              className="inline-flex items-center gap-1.5"
            >
              Browse campaigns
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      {(loading || counts) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {loading && !counts ? (
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-[74px] rounded-2xl",
                  isDark ? "bg-white/10" : "bg-[#ececef]",
                )}
              />
            ))
          ) : (
            <>
              <StatChip
                label="Under review"
                value={counts?.pending ?? 0}
                icon={Clock}
                isDark={isDark}
                active={tab === "pending"}
                onClick={() => selectTab("pending")}
              />
              <StatChip
                label="Approved"
                value={counts?.approved ?? 0}
                icon={CheckCircle2}
                isDark={isDark}
                active={tab === "approved"}
                onClick={() => selectTab("approved")}
              />
              <StatChip
                label="Not selected"
                value={counts?.rejected ?? 0}
                icon={XCircle}
                isDark={isDark}
                active={tab === "rejected"}
                onClick={() => selectTab("rejected")}
              />
              <StatChip
                label="Withdrawn"
                value={counts?.withdrawn ?? 0}
                icon={Undo2}
                isDark={isDark}
                active={tab === "withdrawn"}
                onClick={() => selectTab("withdrawn")}
              />
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div
          className={cn(
            "w-fit max-w-full overflow-x-auto rounded-2xl border p-1.5",
            isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
          )}
        >
          <div
            className="flex min-w-max gap-1"
            role="tablist"
            aria-label="Application status"
          >
            {TABS.map((t) => {
              const selected = tab === t;
              const count = t === "all" ? allCount : (counts?.[t] ?? 0);
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(t)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40 focus-visible:ring-offset-2",
                    isDark
                      ? "focus-visible:ring-offset-[#161616]"
                      : "focus-visible:ring-offset-white",
                    selected
                      ? isDark
                        ? "border border-white/20 bg-white/10 text-white"
                        : "border border-[#1a1a1a] bg-white text-[#1a1a1a]"
                      : isDark
                        ? "border border-transparent text-white/50 hover:bg-white/5 hover:text-white"
                        : "border border-transparent text-[#8d8d95] hover:bg-[#fafafa] hover:text-[#1a1a1a]",
                  )}
                >
                  {TAB_LABELS[t]}
                  {counts && (
                    <span
                      className={cn(
                        "min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium",
                        selected
                          ? isDark
                            ? "bg-white text-[#1a1a1a]"
                            : "bg-[#1a1a1a] text-white"
                          : isDark
                            ? "bg-white/10 text-white/70"
                            : "bg-[#ececef] text-[#55555E]",
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div role="tabpanel">
          {loading ? (
            <ListSkeleton isDark={isDark} />
          ) : error ? (
            <section className={cn(cardClass, "px-6 py-16 text-center")}>
              <span
                className={cn(
                  "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                  isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]",
                )}
              >
                <Inbox className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className={cn("mt-4 text-[17px] font-semibold", ink)}>
                We couldn&apos;t load your applications
              </h2>
              <p className={cn("mt-1.5 text-sm", muted)}>{error}</p>
              <Button
                size="sm"
                className={cn(outlineButton, "mt-5 h-9")}
                onClick={() => setReloadKey((k) => k + 1)}
              >
                Try again
              </Button>
            </section>
          ) : !data || data.applications.length === 0 ? (
            <section className={cn(cardClass, "px-6 py-16 sm:py-20")}>
              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]",
                  )}
                >
                  {allCount === 0 ? (
                    <Search className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Inbox className="h-6 w-6" aria-hidden="true" />
                  )}
                </span>
                <h2 className={cn("mt-4 text-[22px] font-bold tracking-tight", ink)}>
                  {allCount === 0
                    ? "You haven't applied to any campaigns yet"
                    : `No ${TAB_LABELS[tab].toLowerCase()} applications`}
                </h2>
                {allCount === 0 ? (
                  <p className={cn("mt-2 text-base leading-relaxed", soft)}>
                    Some campaigns ask creators to apply first. Find one and apply to join.
                  </p>
                ) : (
                  <p className={cn("mt-2 text-sm", muted)}>
                    Try another status filter, or browse open campaigns.
                  </p>
                )}
                {allCount === 0 && (
                  <Button asChild className={cn(primaryButton, "mt-6 h-10")}>
                    <Link href="/dashboard/opportunities">Browse campaigns</Link>
                  </Button>
                )}
                {allCount > 0 && tab !== "all" && (
                  <Button
                    className={cn(outlineButton, "mt-5 h-9")}
                    onClick={() => selectTab("all")}
                  >
                    Show all applications
                  </Button>
                )}
              </div>
            </section>
          ) : (
            <ul className="space-y-3">
              {data.applications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  app={app}
                  isDark={isDark}
                  ink={ink}
                  muted={muted}
                  soft={soft}
                  cardClass={cardClass}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {pageCount > 1 && (
        <nav
          aria-label="Pages"
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
            isDark ? "border-white/10 bg-[#161616]" : "border-[#ececef] bg-white",
          )}
        >
          <Button
            size="sm"
            variant="outline"
            className={cn(outlineButton, "h-9 gap-1")}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Previous
          </Button>
          <span className={cn("text-sm font-medium", soft)}>
            Page {page} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={cn(outlineButton, "h-9 gap-1")}
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}

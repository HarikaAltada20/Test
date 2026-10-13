"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { ArrowRight, ClipboardList, Inbox, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type MyApplicationListItem,
} from "@/lib/campaign-access";
import { myApplicationsApi, type MyApplicationsResponse } from "@/components/campaign-access/api";
import { ApplicationStatusBadge } from "@/components/campaign-access/AccessBadge";
import { EmptyState } from "@/components/campaign-access/EmptyState";
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

function nextStep(app: MyApplicationListItem): string {
  if (app.campaign.has_ended) return "This campaign has ended.";
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

function ApplicationCard({ app }: { app: MyApplicationListItem }) {
  const title = app.campaign.title || "Untitled campaign";
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center">
      <div className="relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#7F39EC]/20 to-[#4A00BE]/30 sm:h-20 sm:w-32">
        {app.campaign.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.campaign.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Trophy className="h-8 w-8 text-white/70" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-semibold text-gray-900 dark:text-white">{title}</h2>
          <ApplicationStatusBadge status={app.status} label={TAB_LABELS[app.status]} />
        </div>
        {app.campaign.brand_name && (
          <p className="text-sm text-gray-600 dark:text-gray-300">by {app.campaign.brand_name}</p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-gray-400">
          <RelativeTime value={app.created_at} prefix="Applied" />
          {app.reviewed_at && app.status !== "pending" && (
            <>
              <span aria-hidden="true">·</span>
              <RelativeTime value={app.reviewed_at} prefix="Reviewed" />
            </>
          )}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{nextStep(app)}</p>
        {app.status === "rejected" && app.rejection_reason && (
          <blockquote className="whitespace-pre-wrap border-l-2 border-red-300 pl-3 text-sm italic text-gray-600 dark:border-red-400/50 dark:text-gray-300">
            {app.rejection_reason}
          </blockquote>
        )}
      </div>
      {app.campaign.is_published && (
        <Button
          asChild
          variant={app.status === "approved" ? "default" : "outline"}
          className={cn(
            "w-full shrink-0 sm:w-auto",
            app.status === "approved"
              ? "bg-[#7F39EC] text-white hover:bg-[#7F39EC]/90"
              : "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10",
          )}
        >
          <Link href={`/dashboard/opportunities/${app.contest_id}`}>
            Open campaign <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
            <span className="sr-only">: {title}</span>
          </Link>
        </Button>
      )}
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Loading your applications">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <Skeleton className="h-20 w-32 bg-gray-200/80 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2 bg-gray-200/80 dark:bg-white/10" />
            <Skeleton className="h-4 w-1/3 bg-gray-200/80 dark:bg-white/10" />
            <Skeleton className="h-4 w-2/3 bg-gray-200/80 dark:bg-white/10" />
          </div>
        </li>
      ))}
    </ul>
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

  return (
    <div className={cn("mx-auto max-w-4xl space-y-6 p-4 md:p-6", isDark && "dark")}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <ClipboardList className="h-6 w-6" aria-hidden="true" /> My applications
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Campaigns you applied to and where each application stands.
        </p>
      </div>

      <TabsPrimitive.Root
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setPage(1);
        }}
        className="space-y-4"
      >
        <TabsPrimitive.List
          aria-label="Application status"
          className="flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-white/5"
        >
          {TABS.map((t) => (
            <TabsPrimitive.Trigger
              key={t}
              value={t}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] data-[state=active]:bg-white data-[state=active]:text-[#4A00BE] data-[state=active]:shadow-sm dark:text-gray-300 dark:hover:text-white dark:data-[state=active]:bg-[#7F39EC] dark:data-[state=active]:text-white"
            >
              {TAB_LABELS[t]}
              {counts && (
                <span className="min-w-[1.25rem] rounded-full bg-gray-200/80 px-1.5 text-center text-xs text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {t === "all" ? allCount : counts[t]}
                </span>
              )}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <TabsPrimitive.Content value={tab} className="focus-visible:outline-none">
          {loading ? (
            <ListSkeleton />
          ) : error ? (
            <EmptyState
              icon={Inbox}
              title="We couldn't load your applications"
              description={error}
              actions={
                <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                  Try again
                </Button>
              }
            />
          ) : !data || data.applications.length === 0 ? (
            <EmptyState
              icon={allCount === 0 ? Search : Inbox}
              title={
                allCount === 0
                  ? "You haven't applied to any campaigns yet"
                  : `No ${TAB_LABELS[tab].toLowerCase()} applications`
              }
              description={
                allCount === 0
                  ? "Some campaigns ask creators to apply first. Find one and apply to join."
                  : undefined
              }
              actions={
                allCount === 0 ? (
                  <Button asChild size="sm" className="bg-[#7F39EC] text-white hover:bg-[#7F39EC]/90">
                    <Link href="/dashboard/opportunities">Browse campaigns</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="space-y-3">
              {data.applications.map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </ul>
          )}
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>

      {pageCount > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-gray-600 dark:text-gray-300">
            Page {page} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

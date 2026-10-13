import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Skeleton block that also reads well on the dark dashboard. */
function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("bg-gray-200/80 dark:bg-white/10", className)} />;
}

function Loading({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches an ApplicationsPanel row: checkbox, avatar and name, date, status, actions. */
export function ApplicationRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading label="Loading applications" className="divide-y divide-gray-200 dark:divide-white/10">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Bone className="h-4 w-4 rounded-sm" />
          <Bone className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="hidden h-3.5 w-20 sm:block" />
          <Bone className="hidden h-5 w-16 rounded-full sm:block" />
          <Bone className="h-9 w-20" />
        </div>
      ))}
    </Loading>
  );
}

/** Matches the Access tab: header, two add boxes, then roster rows. */
export function AccessPanelSkeleton() {
  return (
    <Loading label="Loading access list" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Bone className="h-5 w-48" />
          <Bone className="h-4 w-40" />
        </div>
        <Bone className="h-16 w-full max-w-sm" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Bone className="h-36" />
        <Bone className="h-36" />
      </div>
      <InviteLinksSkeleton rows={1} />
      <AccessRowsSkeleton />
    </Loading>
  );
}

export function AccessRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Bone className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-28" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="hidden h-3.5 w-28 sm:block" />
          <Bone className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function InviteLinksSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <Loading
      label="Loading invite links"
      className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-36" />
            <Bone className="h-3 w-full max-w-xs" />
            <Bone className="h-3 w-40" />
          </div>
          <Bone className="h-9 w-24" />
        </div>
      ))}
    </Loading>
  );
}

/** Saved lists: a list of name and count rows. */
export function SavedListsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Loading label="Loading saved lists" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border border-gray-200 px-3 py-3 dark:border-white/10"
        >
          <Bone className="h-4 w-4 rounded-sm" />
          <Bone className="h-4 flex-1" />
          <Bone className="h-4 w-10" />
        </div>
      ))}
    </Loading>
  );
}

/** Saved list members: avatar, name and date rows. */
export function MemberRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Loading label="Loading members" className="divide-y divide-gray-200 dark:divide-white/10">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Bone className="h-7 w-7 rounded-full" />
          <Bone className="h-3.5 flex-1" />
          <Bone className="h-3.5 w-16" />
        </div>
      ))}
    </Loading>
  );
}

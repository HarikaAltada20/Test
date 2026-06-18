"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function emailSkeletonTone(isDark?: boolean) {
  return isDark ? "bg-white/10" : undefined;
}

function Sk({
  className,
  isDark,
}: {
  className?: string;
  isDark?: boolean;
}) {
  return <Skeleton className={cn(className, emailSkeletonTone(isDark))} />;
}

export function EmailTabSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Sk className="h-8 w-32" isDark={isDark} />
          <Sk className="h-4 w-72 max-w-full" isDark={isDark} />
        </div>
        <Sk className="h-10 w-36" isDark={isDark} />
      </div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-10 w-28 rounded-lg" isDark={isDark} />
        ))}
      </div>
      <EmailProjectCardsSkeleton count={3} isDark={isDark} />
    </div>
  );
}

export function EmailProjectCardsSkeleton({
  count = 3,
  isDark,
}: {
  count?: number;
  isDark?: boolean;
}) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-5 space-y-4",
            isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <Sk className="h-6 w-48" isDark={isDark} />
              <Sk className="h-4 w-full max-w-md" isDark={isDark} />
            </div>
            <Sk className="h-6 w-20 rounded-full" isDark={isDark} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Sk key={j} className="h-16 rounded-lg" isDark={isDark} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Sk key={j} className="h-9 w-28" isDark={isDark} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailCampaignListSkeleton({ isDark }: { isDark?: boolean }) {
  const rowWidths = [
    ["w-36", "w-40", "w-16", "w-20", "w-24"],
    ["w-32", "w-52", "w-14", "w-16", "w-20"],
    ["w-28", "w-44", "w-16", "w-20", "w-24"],
    ["w-36", "w-48", "w-12", "w-16", "w-20"],
    ["w-32", "w-56", "w-14", "w-20", "w-24"],
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Sk className="h-10 w-40" isDark={isDark} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              {["Campaign", "Project", "Status", "Progress", "Actions"].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowWidths.map((widths, rowIndex) => (
              <TableRow key={rowIndex}>
                {widths.map((width, colIndex) => (
                  <TableCell key={colIndex}>
                    <Sk className={cn("h-4", width)} isDark={isDark} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function EmailStatsRowSkeleton({
  count = 6,
  isDark,
}: {
  count?: number;
  isDark?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-4 flex flex-col gap-3 min-h-[96px]",
            isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <Sk className="h-4 w-20" isDark={isDark} />
            <Sk className="h-8 w-8 rounded-lg" isDark={isDark} />
          </div>
          <Sk className="h-8 w-12" isDark={isDark} />
        </div>
      ))}
    </div>
  );
}

export function EmailWarmUpTableSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {["User", "Status", "Health Score", "Warmup Mails", "Health %", "Actions"].map(
              (label) => (
                <TableHead key={label} className={label === "Warmup Mails" ? "text-center" : undefined}>
                  {label}
                </TableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              <TableCell>
                <div className="space-y-2">
                  <Sk className="h-4 w-48" isDark={isDark} />
                  <Sk className="h-3 w-28" isDark={isDark} />
                </div>
              </TableCell>
              <TableCell>
                <Sk className="h-6 w-16 rounded-full" isDark={isDark} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Sk className="h-2 flex-1 rounded-full" isDark={isDark} />
                  <Sk className="h-4 w-8" isDark={isDark} />
                </div>
              </TableCell>
              <TableCell className="text-center">
                <Sk className="h-4 w-14 mx-auto" isDark={isDark} />
              </TableCell>
              <TableCell>
                <Sk className="h-4 w-10" isDark={isDark} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Sk className="h-8 w-8 rounded-md" isDark={isDark} />
                  <Sk className="h-8 w-8 rounded-md" isDark={isDark} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function EmailWarmUpSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-4">
      <EmailStatsRowSkeleton isDark={isDark} />
      <div className="flex flex-wrap items-center gap-3">
        <Sk className="h-11 w-[220px]" isDark={isDark} />
        <Sk className="h-11 flex-1 min-w-[200px]" isDark={isDark} />
        <Sk className="h-11 w-44" isDark={isDark} />
        <Sk className="h-11 w-40" isDark={isDark} />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Sk key={i} className="h-10 w-24 rounded-lg" isDark={isDark} />
        ))}
      </div>
      <div
        className={cn(
          "rounded-xl border overflow-hidden",
          isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
        )}
      >
        <EmailWarmUpTableSkeleton isDark={isDark} />
      </div>
    </div>
  );
}

export function EmailUniboxThreadSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-4">
          <Sk className="h-4 w-4 mt-1 rounded" isDark={isDark} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Sk className="h-4 w-32" isDark={isDark} />
              <Sk className="h-3 w-14" isDark={isDark} />
            </div>
            <Sk className="h-3 w-8" isDark={isDark} />
            <Sk className="h-4 w-full max-w-[240px]" isDark={isDark} />
            <Sk className="h-3 w-full max-w-[300px]" isDark={isDark} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailUniboxDetailSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-3">
        <Sk className="h-10 w-10 rounded-full" isDark={isDark} />
        <Sk className="h-4 w-48" isDark={isDark} />
      </div>
      <div className="border-b border-gray-100 px-6 py-4 space-y-2">
        <Sk className="h-5 w-3/4 max-w-lg" isDark={isDark} />
        <Sk className="h-4 w-40" isDark={isDark} />
      </div>
      <div className="flex-1 px-6 py-5 space-y-3">
        <Sk className="h-4 w-full" isDark={isDark} />
        <Sk className="h-4 w-full" isDark={isDark} />
        <Sk className="h-4 w-5/6" isDark={isDark} />
        <Sk className="h-4 w-4/6" isDark={isDark} />
        <Sk className="h-4 w-full" isDark={isDark} />
        <Sk className="h-4 w-2/3" isDark={isDark} />
      </div>
    </div>
  );
}

export function EmailProjectDetailSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <Sk className="h-4 w-full max-w-xl" isDark={isDark} />
        <Sk className="h-10 w-36" isDark={isDark} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl border p-5 space-y-4",
              isDark ? "border-purple-900/40 bg-[#1a0540]" : "border-gray-200 bg-white",
            )}
          >
            <Sk className="h-5 w-40" isDark={isDark} />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-2">
                <Sk className="h-3 w-24" isDark={isDark} />
                <Sk className="h-4 w-full max-w-xs" isDark={isDark} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Sk key={i} className="h-28 rounded-xl" isDark={isDark} />
        ))}
      </div>
    </div>
  );
}

export function EmailCampaignDetailSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Sk className="h-4 w-32" isDark={isDark} />
        <div className="flex gap-2">
          <Sk className="h-10 w-36" isDark={isDark} />
          <Sk className="h-10 w-28" isDark={isDark} />
        </div>
      </div>
      <div className="space-y-2">
        <Sk className="h-8 w-64 max-w-full" isDark={isDark} />
        <Sk className="h-4 w-48" isDark={isDark} />
      </div>
      <div className="flex gap-4 border-b pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Sk key={i} className="h-8 w-20" isDark={isDark} />
        ))}
      </div>
      <EmailAnalyticsSkeleton isDark={isDark} />
    </div>
  );
}

export function EmailFormPanelSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border p-5 space-y-4",
          isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
        )}
      >
        <Sk className="h-5 w-40" isDark={isDark} />
        <Sk className="h-4 w-64 max-w-full" isDark={isDark} />
        <Sk className="h-11 w-full" isDark={isDark} />
        <div className="flex flex-wrap gap-2">
          <Sk className="h-8 w-36 rounded-full" isDark={isDark} />
          <Sk className="h-8 w-40 rounded-full" isDark={isDark} />
        </div>
      </div>
      <div
        className={cn(
          "rounded-xl border p-5 space-y-3",
          isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
        )}
      >
        <Sk className="h-5 w-32" isDark={isDark} />
        <Sk className="h-24 w-full" isDark={isDark} />
        <Sk className="h-24 w-full" isDark={isDark} />
      </div>
    </div>
  );
}

export function EmailLeadTableSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Sk className="h-10 w-full max-w-sm" isDark={isDark} />
        <div className="flex gap-2">
          <Sk className="h-10 w-28" isDark={isDark} />
          <Sk className="h-10 w-28" isDark={isDark} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              {["", "#", "Email", "Status", "From Email", "Contact", "User Type"].map(
                (label, i) => (
                  <TableHead key={i}>{label}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 7 }).map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Sk className="h-4 w-20" isDark={isDark} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function EmailAnalyticsSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl border p-4 space-y-3",
              isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
            )}
          >
            <div className="flex justify-between">
              <Sk className="h-4 w-20" isDark={isDark} />
              <Sk className="h-8 w-8 rounded-lg" isDark={isDark} />
            </div>
            <Sk className="h-8 w-16" isDark={isDark} />
          </div>
        ))}
      </div>
      <div
        className={cn(
          "rounded-xl border p-5 space-y-4",
          isDark ? "border-purple-900/40 bg-[#170337]" : "border-gray-200 bg-white",
        )}
      >
        <Sk className="h-5 w-40" isDark={isDark} />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-10 w-full" isDark={isDark} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmailModalSkeleton({ isDark }: { isDark?: boolean }) {
  return (
    <div className="space-y-4 py-2">
      <Sk className="h-4 w-48" isDark={isDark} />
      <Sk className="h-10 w-full" isDark={isDark} />
      <Sk className="h-10 w-full" isDark={isDark} />
      <Sk className="h-24 w-full" isDark={isDark} />
    </div>
  );
}

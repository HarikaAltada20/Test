"use client";

import { useState, type ReactNode } from "react";
import { BadgeCheck, CheckCircle2, ChevronDown, ChevronRight, Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  SKYDO_OVERDUE_MS,
  type AdminPayoutEmailGroup,
  type AdminPayoutMethodRow,
  type AdminPayoutSortKey,
} from "@/lib/admin-payout-methods";
import type { SkydoStatus } from "@/types/earnings";
import { PayoutMethodsTable } from "./PayoutMethodsTable";
import { WithTooltip, copyText, durationSince, exactTime, palette } from "./shared";

const GRID =
  "md:grid md:grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1.3fr)_96px_96px_190px] md:items-center md:gap-3";

function StatusMix({ group, isDark }: { group: AdminPayoutEmailGroup; isDark: boolean }) {
  const parts: { label: string; count: number; className: string }[] = [
    {
      label: "verified",
      count: group.verified_count,
      className: isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700",
    },
    {
      label: "email sent",
      count: group.sent_count,
      className: isDark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700",
    },
    {
      label: "pending",
      count: group.pending_count,
      className: isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-800",
    },
  ].filter((part) => part.count > 0);
  return (
    <div className="flex flex-wrap gap-1">
      {parts.map((part) => (
        <span
          key={part.label}
          className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", part.className)}
        >
          {part.count} {part.label}
        </span>
      ))}
    </div>
  );
}

function GroupAction({
  group,
  isDark,
  onVerifyKnown,
  onMarkSent,
}: {
  group: AdminPayoutEmailGroup;
  isDark: boolean;
  onVerifyKnown: () => void;
  onMarkSent: () => void;
}) {
  if (group.known_count > 0)
    return (
      <Button
        size="sm"
        className="h-8 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 md:w-auto"
        onClick={(e) => {
          e.stopPropagation();
          onVerifyKnown();
        }}
      >
        <BadgeCheck className="h-3.5 w-3.5" />
        Verify {group.known_count} (known email)
      </Button>
    );
  if (group.pending_count > 0)
    return (
      <Button
        size="sm"
        className="h-8 w-full gap-1.5 bg-[#1a1a1a] text-white hover:bg-[#6a2fd0] md:w-auto"
        onClick={(e) => {
          e.stopPropagation();
          onMarkSent();
        }}
      >
        <Send className="h-3.5 w-3.5" />
        Mark {group.pending_count > 1 ? `${group.pending_count} ` : ""}email sent
      </Button>
    );
  if (group.sent_count > 0) return <span className={cn("text-xs", palette(isDark).muted)}>Waiting for user KYC</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", isDark ? "text-emerald-400/80" : "text-emerald-600")}>
      <CheckCircle2 className="h-4 w-4" aria-hidden />
      All verified
    </span>
  );
}

export function EmailGroupsList({
  groups,
  loading,
  refreshing,
  now,
  isDark,
  selectedIds,
  sort,
  order,
  emptyState,
  onToggleRow,
  onSort,
  onOpen,
  onSetStatus,
  onVerifyKnown,
  onGroupVerifyKnown,
  onGroupMarkSent,
}: {
  groups: AdminPayoutEmailGroup[];
  loading: boolean;
  refreshing: boolean;
  now: number;
  isDark: boolean;
  selectedIds: Set<string>;
  sort: AdminPayoutSortKey;
  order: "asc" | "desc";
  emptyState: ReactNode;
  onToggleRow: (id: string, checked: boolean) => void;
  onSort: (key: AdminPayoutSortKey) => void;
  onOpen: (id: string) => void;
  onSetStatus: (row: AdminPayoutMethodRow, status: SkydoStatus) => void;
  onVerifyKnown: (row: AdminPayoutMethodRow) => void;
  onGroupVerifyKnown: (group: AdminPayoutEmailGroup) => void;
  onGroupMarkSent: (group: AdminPayoutEmailGroup) => void;
}) {
  const p = palette(isDark);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (email: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const headClass = cn(
    "hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide md:grid",
    GRID,
    isDark ? "bg-[#1a1a1a] text-gray-400" : "bg-gray-50 text-gray-500"
  );

  return (
    <div className={cn("relative overflow-hidden rounded-xl border", p.surface)}>
      {refreshing && !loading && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-[#1a1a1a]" />
        </div>
      )}
      <div className={headClass} aria-hidden>
        <span />
        <span>Skydo email</span>
        <span>Accounts</span>
        <span>Stages</span>
        <span>Waiting</span>
        <span className="text-right">Balance</span>
        <span>Next action</span>
      </div>

      {loading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className={cn("h-12 w-full rounded-lg", isDark && "bg-white/10")} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="px-4 py-14">{emptyState}</div>
      ) : (
        <ul className={cn("divide-y", isDark ? "divide-gray-800" : "divide-gray-100")}>
          {groups.map((group) => {
            const open = expanded.has(group.email);
            const waitingSince = group.oldest_waiting_since;
            const overdue =
              group.known_count === 0 &&
              group.pending_count > 0 &&
              waitingSince !== null &&
              now - new Date(waitingSince).getTime() > SKYDO_OVERDUE_MS;
            return (
              <li key={group.email}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(group.email)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(group.email);
                    }
                  }}
                  className={cn(
                    "cursor-pointer space-y-2 px-4 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1a1a1a] md:space-y-0",
                    GRID,
                    p.hover,
                    group.known_count > 0 && (isDark ? "bg-emerald-950/10" : "bg-emerald-50/40")
                  )}
                >
                  <span className="hidden md:block">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>

                  <div className="flex min-w-0 items-center gap-1">
                    <span className="md:hidden">
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="truncate font-mono text-xs">{group.email}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyText(group.email, "Skydo email");
                      }}
                      aria-label="Copy Skydo email"
                      className={cn(
                        "shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100 focus:opacity-100",
                        isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
                      )}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium">
                      {group.account_count} account
                      {group.account_count === 1 ? "" : "s"}
                    </div>
                    <div className={cn("truncate text-xs", p.muted)} title={group.names.join(", ")}>
                      {group.names.join(", ")}
                    </div>
                  </div>

                  <StatusMix group={group} isDark={isDark} />

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className={cn("text-xs md:hidden", p.muted)}>Waiting</span>
                    {waitingSince ? (
                      <WithTooltip content={`Oldest unverified since ${exactTime(waitingSince)}`}>
                        <span
                          className={cn(
                            "cursor-default whitespace-nowrap tabular-nums",
                            overdue && cn("font-semibold", isDark ? "text-red-400" : "text-red-600")
                          )}
                        >
                          {durationSince(waitingSince)}
                        </span>
                      </WithTooltip>
                    ) : (
                      <span className={cn("text-xs", p.muted)}>—</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 md:block md:text-right">
                    <span className={cn("text-xs md:hidden", p.muted)}>Balance</span>
                    <span className="tabular-nums">{formatCurrencyFromCents(group.total_balance)}</span>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <GroupAction
                      group={group}
                      isDark={isDark}
                      onVerifyKnown={() => onGroupVerifyKnown(group)}
                      onMarkSent={() => onGroupMarkSent(group)}
                    />
                  </div>
                </div>

                {open && (
                  <div className={cn("px-3 pb-3 md:pl-11", isDark ? "bg-[#0d0222]" : "bg-slate-50")}>
                    <div className="pt-3">
                      <PayoutMethodsTable
                        view="skydo"
                        rows={group.members}
                        loading={false}
                        refreshing={false}
                        now={now}
                        isDark={isDark}
                        selectedIds={selectedIds}
                        sort={sort}
                        order={order}
                        emptyState={null}
                        onToggleRow={onToggleRow}
                        onTogglePage={() => undefined}
                        onSort={onSort}
                        onOpen={onOpen}
                        onSetStatus={onSetStatus}
                        onVerifyKnown={onVerifyKnown}
                        embedded
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

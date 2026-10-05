"use client";

import type { ReactNode, SyntheticEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Send,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  SKYDO_OVERDUE_MS,
  getPayoutIdentifier,
  type AdminPayoutMethodRow,
  type AdminPayoutSortKey,
} from "@/lib/admin-payout-methods";
import { getSkydoStatus } from "@/lib/skydo-payout";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import type { SkydoStatus } from "@/types/earnings";
import { RowActions } from "./RowActions";
import type { PayoutView } from "./usePayoutMethodsQuery";
import {
  METHOD_LABELS,
  MethodIcon,
  RelativeTime,
  WithTooltip,
  copyText,
  durationSince,
  exactTime,
  palette,
} from "./shared";

const STAGE_INDEX: Record<SkydoStatus, number> = {
  email_pending: 0,
  email_sent: 1,
  verified: 2,
};

const SHORT_STAGE_LABEL: Record<SkydoStatus, string> = {
  email_pending: "Email pending",
  email_sent: "Email sent",
  verified: "Verified",
};

export interface PayoutMethodsTableProps {
  view: PayoutView;
  rows: AdminPayoutMethodRow[];
  loading: boolean;
  refreshing: boolean;
  now: number;
  isDark: boolean;
  selectedIds: Set<string>;
  sort: AdminPayoutSortKey;
  order: "asc" | "desc";
  emptyState: ReactNode;
  onToggleRow: (id: string, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  onSort: (key: AdminPayoutSortKey) => void;
  onOpen: (id: string) => void;
  onSetStatus: (row: AdminPayoutMethodRow, status: SkydoStatus) => void;
}

function isOverdue(row: AdminPayoutMethodRow, now: number): boolean {
  if (row.method_type !== "skydo" || getSkydoStatus(row) !== "email_pending") return false;
  const since = row.stage_since ?? row.created_at;
  return now - new Date(since).getTime() > SKYDO_OVERDUE_MS;
}

function stopRowClick(e: SyntheticEvent) {
  e.stopPropagation();
}

function StageDots({ status, isDark }: { status: SkydoStatus; isDark: boolean }) {
  const idx = STAGE_INDEX[status];
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-4 rounded-full",
            i <= idx
              ? status === "verified"
                ? "bg-emerald-500"
                : status === "email_sent"
                  ? "bg-blue-500"
                  : "bg-amber-500"
              : isDark
                ? "bg-gray-700"
                : "bg-gray-300"
          )}
        />
      ))}
    </span>
  );
}

function CopyButton({ value, label, isDark }: { value: string; label: string; isDark: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void copyText(value, label);
      }}
      aria-label={`Copy ${label}`}
      className={cn(
        "shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100 focus:opacity-100",
        isDark ? "hover:bg-white/10" : "hover:bg-gray-100"
      )}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function UserCell({ row, isDark }: { row: AdminPayoutMethodRow; isDark: boolean }) {
  const p = palette(isDark);
  const name = row.full_name || row.username || "Unnamed user";
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium">{name}</span>
        {row.admin_notes && (
          <WithTooltip content={<span className="block max-w-xs whitespace-pre-wrap">{row.admin_notes}</span>}>
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Has admin notes" />
          </WithTooltip>
        )}
        {row.user_type && row.user_type !== "creator" && (
          <span
            className={cn(
              "rounded px-1.5 text-[10px] font-medium uppercase",
              isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"
            )}
          >
            {row.user_type}
          </span>
        )}
      </div>
      <div className={cn("truncate text-xs", p.muted)}>{row.email || "—"}</div>
    </div>
  );
}

function detailLines(row: AdminPayoutMethodRow): { display: string; full: string; sub: string } {
  const d = (row.details ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const full = getPayoutIdentifier(row.method_type, d, { maskBank: false });
  let display = full;
  let sub = "";
  if (row.method_type === "bank_transfer") {
    display = getPayoutIdentifier(row.method_type, d);
    sub = [s(d.account_holder_name), s(d.ifsc_code || d.swift_bic_code), s(d.bank_name)]
      .filter(Boolean)
      .join(" · ");
  } else if (row.method_type === "crypto" || row.method_type === "phantom") {
    display = full.length > 20 ? `${full.slice(0, 8)}…${full.slice(-6)}` : full;
    sub = [s(d.network), s(d.currency || d.preferred_token)].filter(Boolean).join(" · ");
  } else if (row.method_type === "upi") {
    sub = s(d.account_holder_name);
  }
  return { display, full, sub };
}

function NextAction({
  row,
  isDark,
  onSetStatus,
}: {
  row: AdminPayoutMethodRow;
  isDark: boolean;
  onSetStatus: (status: SkydoStatus) => void;
}) {
  const status = getSkydoStatus(row);
  if (status === "email_pending")
    return (
      <Button
        size="sm"
        className="h-8 gap-1.5 bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
        onClick={(e) => {
          e.stopPropagation();
          onSetStatus("email_sent");
        }}
      >
        <Send className="h-3.5 w-3.5" />
        Mark email sent
      </Button>
    );
  if (status === "email_sent")
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn(
          "h-8 gap-1.5 border-emerald-500/60 text-emerald-700 hover:bg-emerald-50",
          isDark && "bg-transparent text-emerald-300 hover:bg-emerald-950/40"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSetStatus("verified");
        }}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Mark verified
      </Button>
    );
  return (
    <span className={cn("text-xs", palette(isDark).muted)}>Ready for withdrawals</span>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  order,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: AdminPayoutSortKey;
  sort: AdminPayoutSortKey;
  order: "asc" | "desc";
  onSort: (key: AdminPayoutSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === sortKey;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 font-medium hover:text-[#7F39EC]",
        align === "right" && "flex-row-reverse",
        active && "text-[#7F39EC]"
      )}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
    </button>
  );
}

export function PayoutMethodsTable(props: PayoutMethodsTableProps) {
  const {
    view,
    rows,
    loading,
    refreshing,
    now,
    isDark,
    selectedIds,
    sort,
    order,
    emptyState,
    onToggleRow,
    onTogglePage,
    onSort,
    onOpen,
    onSetStatus,
  } = props;
  const p = palette(isDark);
  const isSkydoView = view === "skydo";

  const pageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));
  const headerCheck: boolean | "indeterminate" = pageSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  const sortProps = { sort, order, onSort };
  const thClass = cn(
    "sticky top-0 z-10 whitespace-nowrap px-3 py-2.5 text-left text-xs uppercase tracking-wide",
    isDark ? "bg-[#120A35] text-gray-400" : "bg-gray-50 text-gray-500"
  );
  const columnCount = isSkydoView ? 8 : 9;

  const renderStatus = (row: AdminPayoutMethodRow) => {
    const status = getSkydoStatus(row);
    if (row.method_type !== "skydo" || !status)
      return <span className={cn("text-xs", p.muted)}>Active</span>;
    return (
      <div className="flex flex-col gap-1">
        <SkydoStatusBadge status={status} size="sm" label={SHORT_STAGE_LABEL[status]} />
        {isSkydoView && <StageDots status={status} isDark={isDark} />}
      </div>
    );
  };

  const renderWaiting = (row: AdminPayoutMethodRow) => {
    const status = getSkydoStatus(row);
    const since = row.stage_since ?? row.created_at;
    if (status === "verified")
      return <RelativeTime value={row.skydo_status_updated_at ?? since} className="text-xs" />;
    const overdue = isOverdue(row, now);
    return (
      <WithTooltip content={`In this stage since ${exactTime(since)}`}>
        <span
          className={cn(
            "cursor-default whitespace-nowrap text-sm tabular-nums",
            overdue && cn("font-semibold", isDark ? "text-red-400" : "text-red-600")
          )}
        >
          {durationSince(since)}
          {overdue && <span className="ml-1 text-[10px] uppercase">overdue</span>}
        </span>
      </WithTooltip>
    );
  };

  const balance = (row: AdminPayoutMethodRow) => (
    <span className="tabular-nums">
      {row.withdrawable_balance === null ? "—" : formatCurrencyFromCents(row.withdrawable_balance)}
    </span>
  );

  const rowSelected = (row: AdminPayoutMethodRow) => selectedIds.has(row.id);

  const skeletonRows = Array.from({ length: 8 }, (_, i) => (
    <tr key={`sk-${i}`} className={cn("border-t", isDark ? "border-gray-800" : "border-gray-100")}>
      {Array.from({ length: columnCount }, (__, j) => (
        <td key={j} className="px-3 py-3.5">
          <Skeleton className={cn("h-4", j === 0 ? "w-4" : j === 1 ? "w-40" : "w-20", isDark && "bg-white/10")} />
        </td>
      ))}
    </tr>
  ));

  return (
    <div className={cn("relative overflow-hidden rounded-xl border", p.surface)}>
      {refreshing && !loading && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-[#7F39EC]" />
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className={cn(thClass, "w-10")}>
                <Checkbox
                  checked={headerCheck}
                  onCheckedChange={(v) => onTogglePage(v === true)}
                  aria-label="Select all on this page"
                  disabled={loading || rows.length === 0}
                />
              </th>
              <th className={thClass}>
                <SortHeader label="User" sortKey="full_name" {...sortProps} />
              </th>
              {isSkydoView ? (
                <>
                  <th className={thClass}>Skydo email</th>
                  <th className={thClass}>
                    <SortHeader label="Stage" sortKey="skydo_status" {...sortProps} />
                  </th>
                  <th className={thClass}>
                    <SortHeader label="Waiting" sortKey="stage_since" {...sortProps} />
                  </th>
                  <th className={cn(thClass, "text-right")}>
                    <SortHeader label="Balance" sortKey="withdrawable_balance" align="right" {...sortProps} />
                  </th>
                  <th className={thClass}>Next action</th>
                </>
              ) : (
                <>
                  <th className={thClass}>
                    <SortHeader label="Method" sortKey="method_type" {...sortProps} />
                  </th>
                  <th className={thClass}>Details</th>
                  <th className={thClass}>
                    <SortHeader label="Status" sortKey="skydo_status" {...sortProps} />
                  </th>
                  <th className={cn(thClass, "text-right")}>
                    <SortHeader label="Balance" sortKey="withdrawable_balance" align="right" {...sortProps} />
                  </th>
                  <th className={cn(thClass, "text-right")}>
                    <SortHeader label="Withdrawals" sortKey="withdrawal_count" align="right" {...sortProps} />
                  </th>
                  <th className={thClass}>
                    <SortHeader label="Added" sortKey="created_at" {...sortProps} />
                  </th>
                </>
              )}
              <th className={cn(thClass, "w-10")}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? skeletonRows
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={columnCount} className="px-4 py-14">
                      {emptyState}
                    </td>
                  </tr>
                )
                : rows.map((row) => {
                    const details = detailLines(row);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => onOpen(row.id)}
                        className={cn(
                          "cursor-pointer border-t transition-colors",
                          isDark ? "border-gray-800" : "border-gray-100",
                          rowSelected(row) ? p.selected : p.hover,
                          isOverdue(row, now) && !rowSelected(row) && (isDark ? "bg-red-950/10" : "bg-red-50/40")
                        )}
                      >
                        <td className="px-3 py-3" onClick={stopRowClick}>
                          <Checkbox
                            checked={rowSelected(row)}
                            onCheckedChange={(v) => onToggleRow(row.id, v === true)}
                            aria-label={`Select ${row.full_name ?? row.email ?? "row"}`}
                          />
                        </td>
                        <td className="max-w-[240px] px-3 py-3">
                          <UserCell row={row} isDark={isDark} />
                        </td>
                        {isSkydoView ? (
                          <>
                            <td className="px-3 py-3">
                              <div className="flex max-w-[260px] items-center gap-1">
                                <span className="truncate font-mono text-xs">{details.full || "—"}</span>
                                {details.full && (
                                  <CopyButton value={details.full} label="Skydo email" isDark={isDark} />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">{renderStatus(row)}</td>
                            <td className="px-3 py-3">{renderWaiting(row)}</td>
                            <td className="px-3 py-3 text-right">{balance(row)}</td>
                            <td className="px-3 py-3" onClick={stopRowClick}>
                              <NextAction
                                row={row}
                                isDark={isDark}
                                onSetStatus={(s) => onSetStatus(row, s)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <MethodIcon type={row.method_type} className={p.muted} />
                                <span>{METHOD_LABELS[row.method_type] ?? row.method_type}</span>
                                {row.is_default && (
                                  <span className="rounded-full bg-[#7F39EC]/15 px-1.5 text-[10px] font-semibold uppercase text-[#7F39EC]">
                                    Default
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="max-w-[240px]">
                                <div className="flex items-center gap-1">
                                  <span className="truncate font-mono text-xs">{details.display || "—"}</span>
                                  {details.full && (
                                    <CopyButton
                                      value={details.full}
                                      label={`${METHOD_LABELS[row.method_type] ?? "Payout"} details`}
                                      isDark={isDark}
                                    />
                                  )}
                                </div>
                                {details.sub && (
                                  <div className={cn("truncate text-xs", p.muted)}>{details.sub}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">{renderStatus(row)}</td>
                            <td className="px-3 py-3 text-right">{balance(row)}</td>
                            <td className="px-3 py-3 text-right">
                              <WithTooltip
                                content={
                                  row.last_withdrawal_at
                                    ? `Last withdrawal ${exactTime(row.last_withdrawal_at)}`
                                    : "No withdrawals yet"
                                }
                              >
                                <span className="cursor-default tabular-nums">{row.withdrawal_count ?? 0}</span>
                              </WithTooltip>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-xs">
                              <RelativeTime value={row.created_at} />
                            </td>
                          </>
                        )}
                        <td className="px-3 py-3" onClick={stopRowClick}>
                          <RowActions
                            row={row}
                            isDark={isDark}
                            onOpen={() => onOpen(row.id)}
                            onSetStatus={(s) => onSetStatus(row, s)}
                          />
                        </td>
                      </tr>
                    );
                  })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className={cn("h-24 w-full rounded-lg", isDark && "bg-white/10")} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12">{emptyState}</div>
        ) : (
          <ul className={cn("divide-y", isDark ? "divide-gray-800" : "divide-gray-100")}>
            {rows.map((row) => {
              const details = detailLines(row);
              const isSkydo = row.method_type === "skydo";
              return (
                <li
                  key={row.id}
                  onClick={() => onOpen(row.id)}
                  className={cn("cursor-pointer space-y-2.5 p-4", rowSelected(row) && p.selected)}
                >
                  <div className="flex items-start gap-3">
                    <div onClick={stopRowClick} className="pt-0.5">
                      <Checkbox
                        checked={rowSelected(row)}
                        onCheckedChange={(v) => onToggleRow(row.id, v === true)}
                        aria-label="Select row"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <UserCell row={row} isDark={isDark} />
                    </div>
                    <div onClick={stopRowClick}>
                      <RowActions
                        row={row}
                        isDark={isDark}
                        onOpen={() => onOpen(row.id)}
                        onSetStatus={(s) => onSetStatus(row, s)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-7 text-sm">
                    <MethodIcon type={row.method_type} className={p.muted} />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{details.display || "—"}</span>
                    {details.full && (
                      <CopyButton value={details.full} label="Payout details" isDark={isDark} />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pl-7">
                    <div className="flex items-center gap-2">
                      {renderStatus(row)}
                      {isSkydo && getSkydoStatus(row) !== "verified" && (
                        <span className="text-xs">{renderWaiting(row)}</span>
                      )}
                    </div>
                    <span className="text-sm">{balance(row)}</span>
                  </div>
                  {isSkydo && getSkydoStatus(row) !== "verified" && (
                    <div className="pl-7" onClick={stopRowClick}>
                      <NextAction row={row} isDark={isDark} onSetStatus={(s) => onSetStatus(row, s)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

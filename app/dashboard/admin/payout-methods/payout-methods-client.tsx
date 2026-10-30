"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BadgeCheck, CheckCircle2, Copy, Download, Inbox, Loader2, RefreshCw, SearchX, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { cn } from "@/lib/utils";
import type { AdminPayoutEmailGroup, AdminPayoutMethodRow, AdminPayoutSortKey } from "@/lib/admin-payout-methods";
import { getSkydoStatus } from "@/lib/skydo-payout";
import type { SkydoStatus } from "@/types/earnings";
import { ActiveFilterChips } from "./components/ActiveFilterChips";
import { BulkActionBar } from "./components/BulkActionBar";
import { EmailGroupsList } from "./components/EmailGroupsList";
import { ConfirmVerifyDialog, type ConfirmRequest } from "./components/ConfirmVerifyDialog";
import { MethodTypeChips } from "./components/MethodTypeChips";
import { PayoutMethodDrawer } from "./components/PayoutMethodDrawer";
import { PayoutMethodsTable, peerLabel } from "./components/PayoutMethodsTable";
import { PayoutToolbar } from "./components/PayoutToolbar";
import { SkydoPipeline } from "./components/SkydoPipeline";
import { hasActiveFilters, usePayoutMethodsQuery, type PayoutView } from "./components/usePayoutMethodsQuery";
import { WithTooltip, palette, useIsDark, useNow } from "./components/shared";
import { formatDistanceToNowStrict } from "date-fns";

const BULK_LIMIT = 200;

interface SelectedInfo {
  isSkydo: boolean;
  /** null when selected via "select all matching" and the row isn't on this page. */
  status: SkydoStatus | null;
  email: string;
}

const ASC_FIRST: AdminPayoutSortKey[] = [
  "full_name",
  "email",
  "method_type",
  "stage_since",
  "skydo_email",
  "next_action",
];

function selectedInfo(row: AdminPayoutMethodRow): SelectedInfo {
  const isSkydo = row.method_type === "skydo";
  return {
    isSkydo,
    status: isSkydo ? getSkydoStatus(row) : null,
    email: isSkydo ? String((row.details as Record<string, unknown> | null)?.email ?? "") : "",
  };
}

export default function PayoutMethodsClient() {
  const isDark = useIsDark();
  const now = useNow(30_000);
  const p = palette(isDark);
  const q = usePayoutMethodsQuery();
  const { state, rows, groups, total, summary, setParams } = q;

  const [selected, setSelected] = useState<Map<string, SelectedInfo>>(new Map());
  const [allMatching, setAllMatching] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [copiedPending, setCopiedPending] = useState<string[] | null>(null);
  const [copyingPending, setCopyingPending] = useState(false);

  const clearSelection = useCallback(() => {
    setSelected(new Map());
    setAllMatching(false);
  }, []);

  useEffect(() => {
    clearSelection();
  }, [q.apiQuery, clearSelection]);

  const onChangeFilters = useCallback((updates: Record<string, string | null>) => setParams(updates), [setParams]);

  const openMethod = useCallback((id: string) => setParams({ method: id }, { resetPage: false }), [setParams]);
  const closeMethod = useCallback(() => setParams({ method: null }, { resetPage: false }), [setParams]);

  /* ---------- status changes ---------- */

  const changeStatus = useCallback(
    async (ids: string[], status: SkydoStatus, previous: Record<string, SkydoStatus | null>) => {
      if (ids.length <= BULK_LIMIT) return q.updateStatus(ids, status, previous);
      let ok = true;
      for (let i = 0; i < ids.length; i += BULK_LIMIT) {
        const chunk = ids.slice(i, i + BULK_LIMIT);
        ok = (await q.updateStatus(chunk, status, previous, { silent: true })) && ok;
      }
      if (ok) toast.success(`${ids.length} Skydo methods updated`);
      return ok;
    },
    [q]
  );

  const requestRowStatus = useCallback(
    (row: AdminPayoutMethodRow, status: SkydoStatus) => {
      if (row.method_type !== "skydo") return;
      const current = getSkydoStatus(row);
      if (current === status) return;
      const name = row.full_name || row.email || "This user";
      const run = () => void changeStatus([row.id], status, { [row.id]: current });
      if (status === "verified") {
        setConfirm({
          title: "Mark this Skydo method as verified?",
          description: `${name} will be able to request withdrawals to Skydo straight away. Only do this once their Skydo KYC is complete.`,
          confirmLabel: "Mark verified",
          onConfirm: run,
        });
      } else if (current === "verified") {
        setConfirm({
          title: "Remove Skydo verification?",
          description: `${name} won't be able to withdraw to Skydo until it is verified again.`,
          confirmLabel: "Remove verification",
          onConfirm: run,
        });
      } else run();
    },
    [changeStatus]
  );

  /* ---------- already-verified emails ---------- */

  const runVerifyKnown = useCallback(
    (ids: string[], previous: Record<string, SkydoStatus | null>) => q.verifyKnown(ids, previous),
    [q]
  );

  const requestVerifyKnown = useCallback(
    (row: AdminPayoutMethodRow) => {
      if (!row.known_verified) return;
      const name = row.full_name || row.email || "This user";
      const email = String((row.details as Record<string, unknown> | null)?.email ?? "");
      setConfirm({
        title: `Verify ${name}'s Skydo method?`,
        description: `Skydo already verified ${email} on ${peerLabel(row)}, so no new invite is needed. ${name} will be able to withdraw to Skydo straight away.`,
        confirmLabel: "Verify",
        onConfirm: () => void runVerifyKnown([row.id], { [row.id]: getSkydoStatus(row) }),
      });
    },
    [runVerifyKnown]
  );

  const knownCount = summary?.skydo_known_verified ?? 0;
  const [verifyingAllKnown, setVerifyingAllKnown] = useState(false);

  const verifyAllKnown = useCallback(async () => {
    setVerifyingAllKnown(true);
    try {
      const res = await fetch(
        "/api/admin/payout-methods?methodType=skydo&knownEmail=1&sort=next_action&order=asc&format=ids"
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load accounts");
      const ids: string[] = json.ids ?? [];
      if (ids.length === 0) {
        toast.info("Nothing left to verify");
        q.refetch();
        return;
      }
      const previous: Record<string, SkydoStatus | null> = json.statuses ?? {};
      setConfirm({
        title: `Verify ${ids.length} Skydo method${ids.length === 1 ? "" : "s"}?`,
        description: `Each of these uses an email that Skydo already verified on another account, so no new invite is needed. They'll be able to withdraw to Skydo straight away.${json.truncated ? " Only the first 200 are included." : ""}`,
        confirmLabel: `Verify ${ids.length}`,
        onConfirm: () => void runVerifyKnown(ids, previous),
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setVerifyingAllKnown(false);
    }
  }, [q, runVerifyKnown]);

  const groupVerifyKnown = useCallback(
    (group: AdminPayoutEmailGroup) => {
      const members = group.members.filter((m) => m.known_verified);
      if (members.length === 0) return;
      const verifiedOn = group.members
        .filter((m) => getSkydoStatus(m) === "verified")
        .map((m) => m.full_name || m.username || "another account");
      setConfirm({
        title: `Verify ${members.length} account${members.length === 1 ? "" : "s"} using ${group.email}?`,
        description: `Skydo already verified this email on ${verifiedOn.join(", ")}. ${members
          .map((m) => m.full_name || m.username || "This user")
          .join(", ")} will be able to withdraw to Skydo straight away.`,
        confirmLabel: "Verify",
        onConfirm: () =>
          void runVerifyKnown(
            members.map((m) => m.id),
            Object.fromEntries(members.map((m) => [m.id, getSkydoStatus(m)]))
          ),
      });
    },
    [runVerifyKnown]
  );

  const groupMarkSent = useCallback(
    (group: AdminPayoutEmailGroup) => {
      const members = group.members.filter((m) => getSkydoStatus(m) === "email_pending" && !m.known_verified);
      if (members.length === 0) return;
      void changeStatus(
        members.map((m) => m.id),
        "email_sent",
        Object.fromEntries(members.map((m) => [m.id, "email_pending" as SkydoStatus]))
      );
    },
    [changeStatus]
  );

  /* ---------- selection ---------- */

  const toggleRow = useCallback(
    (id: string, checked: boolean) => {
      const row = rows.find((r) => r.id === id);
      setAllMatching(false);
      setSelected((prev) => {
        const next = new Map(prev);
        if (checked && row) next.set(id, selectedInfo(row));
        else next.delete(id);
        return next;
      });
    },
    [rows]
  );

  const togglePage = useCallback(
    (checked: boolean) => {
      setAllMatching(false);
      setSelected((prev) => {
        const next = new Map(prev);
        for (const row of rows) {
          if (checked) next.set(row.id, selectedInfo(row));
          else next.delete(row.id);
        }
        return next;
      });
    },
    [rows]
  );

  const selectAllMatching = useCallback(async () => {
    setSelectingAll(true);
    try {
      const res = await q.fetchAllMatching("ids");
      const skydoIds = new Set(res.skydoIds ?? []);
      const byId = new Map(rows.map((r) => [r.id, r]));
      const next = new Map<string, SelectedInfo>();
      for (const id of res.ids) {
        const row = byId.get(id);
        next.set(id, row ? selectedInfo(row) : { isSkydo: skydoIds.has(id), status: null, email: "" });
      }
      setSelected(next);
      setAllMatching(true);
      if (res.truncated) toast.info(`Selected the first ${res.ids.length}. Narrow the filters to act on more.`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSelectingAll(false);
    }
  }, [q, rows]);

  const selectedSkydo = useMemo(() => Array.from(selected.entries()).filter(([, info]) => info.isSkydo), [selected]);

  const copySelectedEmails = useCallback(async () => {
    try {
      let emails: string[];
      if (allMatching) {
        emails = (await q.fetchAllMatching("emails")).emails ?? [];
      } else {
        emails = Array.from(new Set(selectedSkydo.map(([, i]) => i.email).filter(Boolean)));
      }
      if (emails.length === 0) {
        toast.info("No Skydo emails in the selection");
        return;
      }
      await navigator.clipboard.writeText(emails.join(", "));
      toast.success(`${emails.length} Skydo email${emails.length === 1 ? "" : "s"} copied`);
    } catch (err) {
      toast.error((err as Error).message || "Could not copy emails");
    }
  }, [allMatching, q, selectedSkydo]);

  const bulkSetStatus = useCallback(
    (status: SkydoStatus) => {
      const ids = selectedSkydo.map(([id]) => id);
      const previous = Object.fromEntries(selectedSkydo.map(([id, i]) => [id, i.status]));
      const run = async () => {
        setBulkBusy(true);
        const ok = await changeStatus(ids, status, previous);
        setBulkBusy(false);
        if (ok) clearSelection();
      };
      if (status === "verified") {
        setConfirm({
          title: `Mark ${ids.length} Skydo method${ids.length === 1 ? "" : "s"} as verified?`,
          description:
            "These users will be able to request withdrawals to Skydo straight away. Only do this once their Skydo KYC is complete.",
          confirmLabel: "Mark verified",
          onConfirm: () => void run(),
        });
      } else void run();
    },
    [changeStatus, clearSelection, selectedSkydo]
  );

  /* ---------- pending email batch ---------- */

  const pendingCount = summary?.by_skydo_status.email_pending ?? 0;
  /** Pending emails that still need a Skydo invite (already-verified ones don't). */
  const invitePendingCount = Math.max(0, pendingCount - (summary?.skydo_known_pending ?? 0));

  const copyAllPending = useCallback(async () => {
    setCopyingPending(true);
    try {
      const res = await fetch(
        "/api/admin/payout-methods?methodType=skydo&skydoStatus=email_pending&format=emails&excludeKnown=1"
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load pending emails");
      const emails: string[] = json.emails ?? [];
      const skipped: number = json.skippedKnown ?? 0;
      const skippedNote =
        skipped > 0
          ? ` ${skipped} skipped because ${skipped === 1 ? "it's" : "they're"} already verified in Skydo.`
          : "";
      if (emails.length === 0) {
        toast.info("No pending Skydo emails need an invite", {
          description: skippedNote.trim() || undefined,
        });
        return;
      }
      await navigator.clipboard.writeText(emails.join(", "));
      setCopiedPending(json.ids ?? []);
      toast.success(`${emails.length} pending Skydo email${emails.length === 1 ? "" : "s"} copied`, {
        description: `Paste them into Skydo, then mark them as Email sent.${skippedNote}`,
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCopyingPending(false);
    }
  }, []);

  const markCopiedSent = useCallback(() => {
    if (!copiedPending?.length) return;
    const ids = copiedPending;
    setConfirm({
      title: `Mark ${ids.length} copied method${ids.length === 1 ? "" : "s"} as Email sent?`,
      description: "Only confirm once the Skydo invites have actually gone out to these emails.",
      confirmLabel: "Mark email sent",
      onConfirm: () => {
        const previous = Object.fromEntries(ids.map((id) => [id, "email_pending" as SkydoStatus]));
        void changeStatus(ids, "email_sent", previous).then((ok) => ok && setCopiedPending(null));
      },
    });
  }, [changeStatus, copiedPending]);

  /* ---------- misc ---------- */

  const onSort = useCallback(
    (key: AdminPayoutSortKey) => {
      const order =
        state.sort === key ? (state.order === "asc" ? "desc" : "asc") : ASC_FIRST.includes(key) ? "asc" : "desc";
      setParams({ sort: key, order });
    },
    [setParams, state.order, state.sort]
  );

  const exportCsv = () => {
    window.location.href = `/api/admin/payout-methods?${q.apiQuery}&format=csv`;
  };

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const rangeStart = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const rangeEnd = Math.min(total, state.page * state.pageSize);
  const filtersActive = hasActiveFilters(state);
  const pageFullySelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const emptyState = (() => {
    if (filtersActive)
      return (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="No payout methods match these filters"
          body="Try a different search or remove a filter."
          action={
            <Button variant="outline" size="sm" className={p.button} onClick={q.clearFilters}>
              Clear filters
            </Button>
          }
          isDark={isDark}
        />
      );
    if (state.view === "skydo" && state.known)
      return (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="Nothing to verify"
          body="No pending Skydo email is already verified on another account."
          action={
            <Button variant="outline" size="sm" className={p.button} onClick={() => setParams({ known: null })}>
              Back to pending
            </Button>
          }
          isDark={isDark}
        />
      );
    if (state.view === "skydo" && !state.overdue && state.skydoStage === "email_pending")
      return (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="All caught up"
          body="No Skydo methods are waiting for an invite email."
          action={
            <Button variant="outline" size="sm" className={p.button} onClick={() => setParams({ stage: "any" })}>
              View all Skydo methods
            </Button>
          }
          isDark={isDark}
        />
      );
    if (state.view === "skydo" && state.overdue)
      return (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="Nothing overdue"
          body="Every pending Skydo method was added less than 24 hours ago."
          action={
            <Button variant="outline" size="sm" className={p.button} onClick={() => setParams({ overdue: null })}>
              Back to pending
            </Button>
          }
          isDark={isDark}
        />
      );
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No payout methods here yet"
        body="They'll show up as soon as users add them."
        isDark={isDark}
      />
    );
  })();

  const tabs: {
    view: PayoutView;
    label: string;
    count: number | null;
    highlight: boolean;
  }[] = [
    {
      view: "skydo",
      label: "Skydo queue",
      count: summary ? pendingCount : null,
      highlight: pendingCount > 0,
    },
    {
      view: "all",
      label: "All methods",
      count: summary?.total ?? null,
      highlight: false,
    },
  ];

  return (
    <div className={cn("space-y-5 p-4 pb-28 md:p-6 md:pb-28", p.page)}>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Payout Methods</h1>
          <p className={cn("max-w-2xl text-sm", p.muted)}>
            See every payout method users have added. Use the Skydo queue to send invites and verify accounts: users can
            only withdraw to Skydo once it&apos;s verified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {q.lastUpdated && (
            <span className={cn("hidden text-xs sm:inline", p.muted)} key={now}>
              Updated {formatDistanceToNowStrict(q.lastUpdated, { addSuffix: true })}
            </span>
          )}
          <WithTooltip content="Refresh">
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh"
              onClick={q.refetch}
              disabled={q.refreshing}
              className={p.button}
            >
              <RefreshCw className={cn("h-4 w-4", q.refreshing && "animate-spin")} />
            </Button>
          </WithTooltip>
          <Button variant="outline" onClick={exportCsv} className={cn("gap-2", p.button)}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div
        role="tablist"
        aria-label="Payout method views"
        className={cn("inline-flex rounded-xl border p-1", p.surface)}
      >
        {tabs.map((t) => {
          const active = state.view === t.view;
          return (
            <button
              key={t.view}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => !active && q.setView(t.view)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-[#1a1a1a] text-white shadow-sm" : cn(p.muted, p.hover)
              )}
            >
              {t.label}
              {t.count !== null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    active
                      ? "bg-white/20"
                      : t.highlight
                        ? "bg-amber-500 text-white"
                        : isDark
                          ? "bg-white/10"
                          : "bg-gray-100"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* View-specific overview */}
      {state.view === "skydo" ? (
        <div className="space-y-3">
          <SkydoPipeline
            summary={summary}
            stage={state.skydoStage}
            overdue={state.overdue}
            known={state.known}
            isDark={isDark}
            onSelectStage={(stage) =>
              setParams({
                stage: stage === "email_pending" ? null : stage,
                overdue: null,
                known: null,
              })
            }
            onSelectOverdue={() =>
              setParams({
                overdue: state.overdue ? null : "1",
                stage: null,
                known: null,
              })
            }
            onSelectKnown={() =>
              setParams({
                known: state.known ? null : "1",
                stage: null,
                overdue: null,
              })
            }
          />
          {knownCount > 0 && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                isDark ? "border-emerald-800/70 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50/60"
              )}
            >
              <p className={cn("flex items-start gap-2 text-sm", isDark ? "text-emerald-200" : "text-emerald-800")}>
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {knownCount} Skydo email{knownCount === 1 ? " is" : "s are"} already verified on another account. No
                  new invite is needed, just verify {knownCount === 1 ? "it" : "them"}.
                </span>
              </p>
              <div className="flex shrink-0 gap-2">
                {!state.known && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={p.button}
                    onClick={() => setParams({ known: "1", stage: null, overdue: null })}
                  >
                    Review
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => void verifyAllKnown()}
                  disabled={verifyingAllKnown}
                  className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {verifyingAllKnown ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-3.5 w-3.5" />
                  )}
                  Verify all {knownCount}
                </Button>
              </div>
            </div>
          )}
          {invitePendingCount > 0 && (
            <div
              className={cn(
                "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between",
                p.surface
              )}
            >
              <p className={cn("text-sm", p.muted)}>
                {copiedPending
                  ? `${copiedPending.length} pending email${copiedPending.length === 1 ? "" : "s"} copied. Once the Skydo invites are sent, mark them here.`
                  : (summary?.skydo_known_pending ?? 0) > 0
                    ? "Copy every pending Skydo email that needs an invite. Already-verified emails are left out."
                    : "Copy every pending Skydo email at once to paste into Skydo."}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllPending}
                  disabled={copyingPending}
                  className={cn("gap-1.5", p.button)}
                >
                  {copyingPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy all {invitePendingCount} pending email
                  {invitePendingCount === 1 ? "" : "s"}
                </Button>
                {copiedPending && copiedPending.length > 0 && (
                  <Button
                    size="sm"
                    onClick={markCopiedSent}
                    className="gap-1.5 bg-[#1a1a1a] text-white hover:bg-[#6a2fd0]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Mark {copiedPending.length} as Email sent
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <MethodTypeChips
          summary={summary}
          value={state.methodType}
          isDark={isDark}
          onChange={(methodType) => setParams({ methodType })}
        />
      )}

      {/* Filters */}
      <div className="space-y-3">
        <PayoutToolbar state={state} isDark={isDark} onChange={onChangeFilters} />
        <ActiveFilterChips state={state} isDark={isDark} onChange={onChangeFilters} onClearAll={q.clearFilters} />
      </div>

      {/* Results */}
      <div className="space-y-2">
        <div className={cn("text-xs", p.muted)}>
          {q.initialLoading
            ? "Loading…"
            : total === 0
              ? "No results"
              : state.groupByEmail
                ? `Showing emails ${rangeStart}–${rangeEnd} of ${total}. Click an email to see its accounts.`
                : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </div>
        {state.groupByEmail ? (
          <EmailGroupsList
            groups={groups ?? []}
            loading={q.initialLoading || (groups === null && q.refreshing)}
            refreshing={q.refreshing}
            now={now}
            isDark={isDark}
            selectedIds={new Set(selected.keys())}
            sort={state.sort}
            order={state.order}
            emptyState={emptyState}
            onToggleRow={toggleRow}
            onSort={onSort}
            onOpen={openMethod}
            onSetStatus={requestRowStatus}
            onVerifyKnown={requestVerifyKnown}
            onGroupVerifyKnown={groupVerifyKnown}
            onGroupMarkSent={groupMarkSent}
          />
        ) : (
          <PayoutMethodsTable
            view={state.view}
            rows={rows}
            loading={q.initialLoading}
            refreshing={q.refreshing}
            now={now}
            isDark={isDark}
            selectedIds={new Set(selected.keys())}
            sort={state.sort}
            order={state.order}
            emptyState={emptyState}
            onToggleRow={toggleRow}
            onTogglePage={togglePage}
            onSort={onSort}
            onOpen={openMethod}
            onSetStatus={requestRowStatus}
            onVerifyKnown={requestVerifyKnown}
          />
        )}
        {total > 0 && (
          <PaginationControls
            page={state.page}
            limit={state.pageSize}
            total={total}
            totalPages={totalPages}
            hasNextPage={state.page < totalPages}
            hasPreviousPage={state.page > 1}
            onPageChange={(page) => setParams({ page: String(page) }, { resetPage: false })}
            onLimitChange={(limit) => setParams({ pageSize: String(limit) })}
            loading={q.refreshing}
            isDark={isDark}
          />
        )}
      </div>

      <BulkActionBar
        count={selected.size}
        skydoCount={selectedSkydo.length}
        total={total}
        allMatching={allMatching}
        canSelectAllMatching={pageFullySelected && total > rows.length}
        selectingAll={selectingAll}
        busy={bulkBusy}
        onSelectAllMatching={selectAllMatching}
        onCopyEmails={copySelectedEmails}
        onMarkSent={() => bulkSetStatus("email_sent")}
        onMarkVerified={() => bulkSetStatus("verified")}
        onClear={clearSelection}
      />

      <PayoutMethodDrawer
        methodId={state.methodId}
        refreshKey={q.lastUpdated}
        isDark={isDark}
        onClose={closeMethod}
        onOpen={openMethod}
        onSetStatus={requestRowStatus}
        onVerifyKnown={requestVerifyKnown}
        onSaveNotes={q.saveNotes}
      />

      <ConfirmVerifyDialog request={confirm} isDark={isDark} onClose={() => setConfirm(null)} />
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
  isDark,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          isDark ? "bg-white/5 text-gray-300" : "bg-gray-100 text-gray-500"
        )}
      >
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <p className={cn("max-w-sm text-sm", isDark ? "text-gray-400" : "text-muted-foreground")}>{body}</p>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

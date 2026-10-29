"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Clock,
  Copy,
  FileJson,
  Info,
  Keyboard,
  Loader2,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  SKYDO_CHATGPT_PROMPT,
  formatUsdCents,
  parseMoneyMinor,
  parseSkydoPayouts,
  type MatchState,
} from "@/lib/skydo-payout-import";
import {
  EMPTY_PAYOUT_RECORD_INPUT,
  PayoutRecordFields,
  type PayoutRecordInput,
} from "./payout-record-card";

export type SkydoDialogScope =
  | {
      kind: "filters";
      createdFrom: string;
      createdTo: string;
      /** e.g. "Last 30 Days" */
      label: string;
    }
  | {
      kind: "selection";
      ids: string[];
      /** Sum of what the selected requests should receive, USD cents. */
      sendCents: number;
      payeeCount: number;
    };

type PreviewRequest = {
  id: string;
  username: string | null;
  fullName: string | null;
  sendCents: number;
  createdAt: string;
};

type PreviewRow = {
  payout: {
    payoutId: string;
    name: string;
    email: string;
    status: string;
    statusKey: string;
    payoutAmountCents: number;
    settledInrPaise: number | null;
    dateOfCredit: string | null;
    utr: string | null;
  };
  state: MatchState;
  matchedEmail: string | null;
  partialEmail: boolean;
  requestIds: string[];
  usernames: string[];
  expectedCents: number;
  outsideFilterCount: number;
  message: string;
  requests: PreviewRequest[];
};

type ApplyResult = {
  ok: boolean;
  succeeded: number;
  failed: number;
  payoutsPaid?: number;
  failedItems: { id: string; payoutId?: string; error: string | null }[];
  markPaid?: boolean;
};

type Step = "input" | "review" | "done";

const STATE_ORDER: MatchState[] = [
  "ready",
  "amount_mismatch",
  "duplicate_email",
  "ambiguous_email",
  "no_match",
  "not_completed",
  "already_recorded",
];

function stateMeta(state: MatchState) {
  switch (state) {
    case "ready":
      return { label: "Ready", tone: "green" as const, Icon: CheckCircle2 };
    case "not_completed":
      return { label: "Left for later", tone: "amber" as const, Icon: Clock };
    case "already_recorded":
      return { label: "Already paid", tone: "slate" as const, Icon: CheckCircle2 };
    case "amount_mismatch":
      return { label: "Amount differs", tone: "red" as const, Icon: AlertTriangle };
    case "duplicate_email":
      return { label: "Two payouts", tone: "red" as const, Icon: AlertTriangle };
    case "ambiguous_email":
      return { label: "Unclear email", tone: "red" as const, Icon: AlertTriangle };
    case "no_match":
    default:
      return { label: "Not in approved", tone: "slate" as const, Icon: XCircle };
  }
}

function toneClasses(tone: "green" | "amber" | "red" | "slate", isDark: boolean) {
  const map = {
    green: isDark
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/20"
      : "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    amber: isDark
      ? "bg-amber-500/15 text-amber-300 ring-amber-400/20"
      : "bg-amber-50 text-amber-800 ring-amber-600/20",
    red: isDark
      ? "bg-rose-500/15 text-rose-300 ring-rose-400/20"
      : "bg-rose-50 text-rose-700 ring-rose-600/15",
    slate: isDark
      ? "bg-white/5 text-white/60 ring-white/10"
      : "bg-slate-100 text-slate-600 ring-slate-500/10",
  };
  return map[tone];
}

function formatInrPaise(paise: number | null): string {
  if (paise === null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SkydoPayoutDialog({
  open,
  onOpenChange,
  isDark,
  scope,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  scope: SkydoDialogScope | null;
  onApplied: (paidIds: string[]) => void;
}) {
  const [tab, setTab] = useState<"paste" | "manual">("paste");
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [manual, setManual] = useState<PayoutRecordInput>(EMPTY_PAYOUT_RECORD_INPUT);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setTab("paste");
    setStep("input");
    setText("");
    setRows([]);
    setParseErrors([]);
    setParseWarnings([]);
    setTicked(new Set());
    setExpanded(new Set());
    setResult(null);
    setManual(EMPTY_PAYOUT_RECORD_INPUT);
  }, [open]);

  const quick = useMemo(() => (text.trim() ? parseSkydoPayouts(text) : null), [text]);
  const isSelection = scope?.kind === "selection";

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.state] = (c[r.state] ?? 0) + 1;
    return c;
  }, [rows]);

  const tickedRows = rows.filter((r) => r.state === "ready" && ticked.has(r.payout.payoutId));
  const tickedRequests = tickedRows.reduce((s, r) => s + r.requestIds.length, 0);
  const tickedCents = tickedRows.reduce((s, r) => s + r.payout.payoutAmountCents, 0);
  const attention =
    (counts.amount_mismatch ?? 0) + (counts.duplicate_email ?? 0) + (counts.ambiguous_email ?? 0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state),
      ),
    [rows],
  );

  const scopeBody = () =>
    scope?.kind === "selection"
      ? { scopeIds: scope.ids }
      : scope?.kind === "filters"
        ? { createdFrom: scope.createdFrom, createdTo: scope.createdTo }
        : {};

  const runPreview = async () => {
    if (!scope) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals/skydo-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", text, ...scopeBody() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      const nextRows = (json.rows ?? []) as PreviewRow[];
      setRows(nextRows);
      setParseErrors(json.errors ?? []);
      setParseWarnings(json.warnings ?? []);
      setTicked(
        new Set(nextRows.filter((r) => r.state === "ready").map((r) => r.payout.payoutId)),
      );
      setExpanded(new Set());
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const runApply = async () => {
    if (!scope || tickedRows.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals/skydo-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "apply",
          text,
          payoutIds: tickedRows.map((r) => r.payout.payoutId),
          ...scopeBody(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark paid");
      setResult(json as ApplyResult);
      setStep("done");
      onApplied((json.succeededIds ?? []) as string[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark paid");
    } finally {
      setLoading(false);
    }
  };

  const runManual = async (markPaid: boolean) => {
    if (scope?.kind !== "selection") return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals/skydo-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          ids: scope.ids,
          markPaid,
          details: { ...manual, status: "Completed" },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save");
      setResult(json as ApplyResult);
      setStep("done");
      onApplied((json.succeededIds ?? []) as string[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(SKYDO_CHATGPT_PROMPT);
      toast.success("ChatGPT prompt copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const manualUsdCents = parseMoneyMinor(manual.payout_amount_usd);
  const manualMismatch =
    scope?.kind === "selection" &&
    manualUsdCents !== null &&
    Math.abs(manualUsdCents - scope.sendCents) > 1;

  const surface = isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-50/70";
  const divider = isDark ? "border-white/10" : "border-slate-200";

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)} isdark={isDark}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:p-0 sm:max-w-[860px]",
          isDark ? "border-white/10 text-white" : "text-slate-900",
        )}
      >
        {/* Header */}
        <DialogHeader
          className={cn(
            "shrink-0 space-y-0 border-b px-5 pb-4 pr-12 pt-5 text-left sm:px-6",
            divider,
            isDark
              ? "bg-gradient-to-br from-[#2A1060] via-[#140B3A] to-[#06021D]"
              : "bg-gradient-to-br from-violet-50 via-white to-white",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9B5CFF] to-[#6A2FD0] text-white shadow-lg shadow-violet-500/25">
              <Wand2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold leading-tight">
                {isSelection ? "Fill payout details" : "Import Skydo payouts"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-sm">
                {isSelection
                  ? "Record the Skydo payout on the selected requests and mark them paid."
                  : "Paste the Skydo payouts table. Completed payouts are matched by Skydo email and marked paid."}
              </DialogDescription>
              {scope && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                  <ScopeChip isDark={isDark}>Approved</ScopeChip>
                  <ScopeChip isDark={isDark}>Skydo</ScopeChip>
                  {scope.kind === "filters" ? (
                    <ScopeChip isDark={isDark}>{scope.label}</ScopeChip>
                  ) : (
                    <ScopeChip isDark={isDark}>
                      {scope.ids.length} selected · {scope.payeeCount}{" "}
                      {scope.payeeCount === 1 ? "payee" : "payees"} ·{" "}
                      {formatUsdCents(scope.sendCents)}
                    </ScopeChip>
                  )}
                </div>
              )}
            </div>
          </div>

          {step === "input" && isSelection && (
            <div
              role="tablist"
              className={cn(
                "mt-4 inline-flex rounded-lg p-1",
                isDark ? "bg-black/30" : "bg-slate-100",
              )}
            >
              {(
                [
                  { id: "paste", label: "Paste from Skydo", Icon: ClipboardPaste },
                  { id: "manual", label: "Enter manually", Icon: Keyboard },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    tab === id
                      ? isDark
                        ? "bg-[#7F39EC] text-white shadow"
                        : "bg-white text-slate-900 shadow-sm"
                      : isDark
                        ? "text-white/60 hover:text-white"
                        : "text-slate-500 hover:text-slate-900",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === "input" && tab === "paste" && (
            <div className="space-y-4">
              <ol className="grid gap-2 text-sm sm:grid-cols-3">
                {[
                  "In Skydo, open the payout batch and select the whole table.",
                  "Copy it (Ctrl + C) and paste it below.",
                  "Preview, check the matches, then mark paid.",
                ].map((s, i) => (
                  <li
                    key={i}
                    className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", surface)}
                  >
                    <span
                      className={cn(
                        "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        isDark ? "bg-violet-500/20 text-violet-200" : "bg-violet-100 text-violet-700",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ol>

              <div className="relative">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  spellCheck={false}
                  placeholder={
                    "Payout ID\nPayee (12)\nPayout status\n…\npout_K4cpDw\nGOURAV NAG\ngauravnag390@gmail.com\nCompleted\nUSD 14.10\nINR 1,331.47\nOct 16, 2026\n628919315123\n\nor a JSON array of payouts"
                  }
                  className={cn(
                    "min-h-[240px] resize-y font-mono text-xs leading-relaxed",
                    isDark
                      ? "border-white/10 bg-black/30 text-white placeholder:text-white/25"
                      : "bg-white placeholder:text-slate-400",
                  )}
                />
                {quick && (
                  <div className="pointer-events-none absolute bottom-2 right-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ring-1",
                        quick.payouts.length > 0
                          ? toneClasses("green", isDark)
                          : toneClasses("red", isDark),
                      )}
                    >
                      {quick.payouts.length > 0 ? (
                        <>
                          {quick.format === "json" ? (
                            <FileJson className="h-3 w-3" />
                          ) : (
                            <ClipboardPaste className="h-3 w-3" />
                          )}
                          {quick.payouts.length} payouts ·{" "}
                          {quick.payouts.filter((p) => p.statusKey === "completed").length} completed
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" /> Not recognised yet
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {quick && quick.errors.length > 0 && (
                <MessageList tone="red" isDark={isDark} items={quick.errors} />
              )}

              <div
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                  surface,
                )}
              >
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                  Can&apos;t copy the table? Give ChatGPT the screenshot and copied text with our
                  prompt, then paste its JSON here.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => void copyPrompt()}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy ChatGPT prompt
                </Button>
              </div>
            </div>
          )}

          {step === "input" && tab === "manual" && scope?.kind === "selection" && (
            <div className="space-y-4">
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-muted-foreground",
                  surface,
                )}
              >
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-violet-500" />
                The same payout ID, UTR and amounts are saved on all {scope.ids.length} selected
                requests. Use this when one Skydo payout covered exactly these requests.
              </div>
              <PayoutRecordFields
                value={manual}
                onChange={setManual}
                isDark={isDark}
                idPrefix="bulk"
                amountHint={
                  <p
                    className={cn(
                      "text-xs",
                      manualMismatch
                        ? isDark
                          ? "text-amber-300"
                          : "text-amber-700"
                        : "text-muted-foreground",
                    )}
                  >
                    Selected requests add up to {formatUsdCents(scope.sendCents)}
                    {manualMismatch ? ". This doesn't match." : ""}
                  </p>
                }
              />
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile
                  isDark={isDark}
                  tone="green"
                  label="Ready"
                  value={counts.ready ?? 0}
                />
                <SummaryTile
                  isDark={isDark}
                  tone="amber"
                  label="Left for later"
                  value={counts.not_completed ?? 0}
                />
                <SummaryTile
                  isDark={isDark}
                  tone="red"
                  label="Needs a look"
                  value={attention}
                />
                <SummaryTile
                  isDark={isDark}
                  tone="slate"
                  label="Skipped"
                  value={(counts.no_match ?? 0) + (counts.already_recorded ?? 0)}
                />
              </div>

              {parseErrors.length > 0 && (
                <MessageList tone="red" isDark={isDark} items={parseErrors} />
              )}
              {parseWarnings.length > 0 && (
                <MessageList tone="amber" isDark={isDark} items={parseWarnings} />
              )}

              <div className={cn("overflow-hidden rounded-xl border", divider)}>
                <div
                  className={cn(
                    "hidden grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] items-center gap-3 border-b px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid",
                    divider,
                    isDark ? "bg-white/[0.03]" : "bg-slate-50",
                  )}
                >
                  <Checkbox
                    checked={
                      tickedRows.length > 0 && tickedRows.length === (counts.ready ?? 0)
                        ? true
                        : tickedRows.length > 0
                          ? "indeterminate"
                          : false
                    }
                    disabled={(counts.ready ?? 0) === 0}
                    onCheckedChange={(v) =>
                      setTicked(
                        v === true
                          ? new Set(
                              rows.filter((r) => r.state === "ready").map((r) => r.payout.payoutId),
                            )
                          : new Set(),
                      )
                    }
                    aria-label="Tick all ready payouts"
                    className={cn(isDark && "border-white/40")}
                  />
                  <span>Payee</span>
                  <span>Skydo</span>
                  <span>Approved here</span>
                  <span>Result</span>
                </div>
                {sortedRows.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No payouts could be read from that paste.
                  </p>
                )}
                {sortedRows.map((r) => {
                  const meta = stateMeta(r.state);
                  const id = r.payout.payoutId;
                  const isOpen = expanded.has(id);
                  const canTick = r.state === "ready";
                  return (
                    <div
                      key={id}
                      className={cn(
                        "border-b last:border-b-0",
                        divider,
                        canTick && ticked.has(id) && (isDark ? "bg-emerald-500/[0.04]" : "bg-emerald-50/40"),
                        !canTick && "opacity-90",
                      )}
                    >
                      <div className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 px-3 py-3 sm:grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                        <div className="pt-0.5">
                          <Checkbox
                            checked={canTick && ticked.has(id)}
                            disabled={!canTick || loading}
                            onCheckedChange={(v) =>
                              setTicked((prev) => {
                                const next = new Set(prev);
                                if (v === true) next.add(id);
                                else next.delete(id);
                                return next;
                              })
                            }
                            aria-label={`Mark ${r.payout.email} paid`}
                            className={cn(isDark && "border-white/40")}
                          />
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="flex max-w-full items-center gap-1 text-left"
                            onClick={() =>
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            disabled={r.requests.length === 0}
                          >
                            {r.requests.length > 0 &&
                              (isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ))}
                            <span className="truncate text-sm font-medium">
                              {r.matchedEmail ?? r.payout.email}
                            </span>
                          </button>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.payout.name || "—"}
                            {r.partialEmail && " · matched from a cut-off email"}
                          </p>
                          {r.usernames.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.usernames.slice(0, 4).map((u) => (
                                <span
                                  key={u}
                                  className={cn(
                                    "rounded-full px-1.5 py-px text-[10px]",
                                    isDark ? "bg-white/5 text-white/70" : "bg-slate-100 text-slate-600",
                                  )}
                                >
                                  @{u}
                                </span>
                              ))}
                              {r.usernames.length > 4 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{r.usernames.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Mobile: compact facts */}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:hidden">
                            <span className="font-semibold tabular-nums">
                              {formatUsdCents(r.payout.payoutAmountCents)}
                            </span>
                            <span className="text-muted-foreground">
                              here {formatUsdCents(r.expectedCents)} · {r.requestIds.length} req
                            </span>
                            <StatePill meta={meta} isDark={isDark} />
                          </div>
                        </div>
                        <div className="hidden min-w-0 sm:block">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatUsdCents(r.payout.payoutAmountCents)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground tabular-nums">
                            {formatInrPaise(r.payout.settledInrPaise)}
                          </p>
                          {r.payout.utr && (
                            <p className="truncate font-mono text-[11px] text-muted-foreground">
                              UTR {r.payout.utr}
                            </p>
                          )}
                        </div>
                        <div className="hidden min-w-0 sm:block">
                          {r.requestIds.length > 0 ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums">
                                {formatUsdCents(r.expectedCents)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {r.requestIds.length}{" "}
                                {r.requestIds.length === 1 ? "request" : "requests"}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                          {r.outsideFilterCount > 0 && (
                            <p
                              className={cn(
                                "mt-0.5 text-[11px]",
                                isDark ? "text-amber-300" : "text-amber-700",
                              )}
                            >
                              +{r.outsideFilterCount} approved{" "}
                              {isSelection ? "not selected" : "outside your dates"}
                            </p>
                          )}
                        </div>
                        <div className="hidden min-w-0 sm:block">
                          <StatePill meta={meta} isDark={isDark} />
                          {r.state !== "ready" && (
                            <p className="mt-1 text-xs leading-snug text-muted-foreground">
                              {r.message}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOpen && r.requests.length > 0 && (
                        <div
                          className={cn(
                            "mx-3 mb-3 ml-[52px] overflow-hidden rounded-lg border text-xs",
                            divider,
                          )}
                        >
                          {r.requests.map((q) => (
                            <div
                              key={q.id}
                              className={cn(
                                "flex items-center justify-between gap-3 border-b px-3 py-1.5 last:border-b-0",
                                divider,
                              )}
                            >
                              <span className="truncate">
                                {q.fullName || "—"}
                                {q.username && (
                                  <span className="text-muted-foreground"> @{q.username}</span>
                                )}
                              </span>
                              <span className="shrink-0 text-muted-foreground tabular-nums">
                                {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : ""}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums">
                                {formatUsdCents(q.sendCents)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {attention > 0 && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                  Rows that need a look aren&apos;t paid here. Select the exact requests that payout
                  covered in the list, then use Fill details.
                </p>
              )}
            </div>
          )}

          {step === "done" && result && (
            <div className="flex flex-col items-center px-2 py-8 text-center">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full",
                  result.failed === 0
                    ? isDark
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-emerald-100 text-emerald-600"
                    : isDark
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-amber-100 text-amber-700",
                )}
              >
                {result.failed === 0 ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <AlertTriangle className="h-7 w-7" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {result.markPaid === false
                  ? `Saved on ${result.succeeded} ${result.succeeded === 1 ? "request" : "requests"}`
                  : `${result.succeeded} ${result.succeeded === 1 ? "request" : "requests"} marked paid`}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {result.payoutsPaid != null && result.payoutsPaid > 0
                  ? `${result.payoutsPaid} Skydo ${result.payoutsPaid === 1 ? "payout" : "payouts"} recorded with payout ID, UTR and settled amount.`
                  : "Payout details are on each request's Withdrawal Details."}
                {result.failed > 0 && ` ${result.failed} could not be updated:`}
              </p>
              {result.failedItems.length > 0 && (
                <div className="mt-4 w-full max-w-lg">
                  <MessageList
                    tone="red"
                    isDark={isDark}
                    items={result.failedItems.map(
                      (f) => `${f.payoutId ? `${f.payoutId}: ` : ""}${f.error ?? "Failed"}`,
                    )}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            "flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6",
            divider,
            isDark ? "bg-[#06021D]" : "bg-white",
          )}
        >
          {step === "input" && tab === "paste" && (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={loading || !quick || quick.payouts.length === 0}
                onClick={() => void runPreview()}
                className="bg-[#7F39EC] text-white hover:bg-[#6a2fd0] sm:min-w-[180px]"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview matches
              </Button>
            </>
          )}

          {step === "input" && tab === "manual" && (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || (!manual.payout_id.trim() && !manual.utr.trim())}
                  onClick={() => void runManual(false)}
                  className={cn(isDark && "border-white/15 bg-transparent hover:bg-white/5")}
                >
                  Save details only
                </Button>
                <Button
                  type="button"
                  disabled={loading || (!manual.payout_id.trim() && !manual.utr.trim())}
                  onClick={() => void runManual(true)}
                  className="bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save & mark paid
                </Button>
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={() => setStep("input")}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
                <Button
                  type="button"
                  disabled={loading || tickedRows.length === 0}
                  onClick={() => void runApply()}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 sm:min-w-[240px]"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {tickedRows.length === 0
                    ? "Nothing ticked"
                    : `Mark ${tickedRows.length} ${tickedRows.length === 1 ? "payee" : "payees"} paid · ${tickedRequests} req · ${formatUsdCents(tickedCents)}`}
                </Button>
            </>
          )}

          {step === "done" && (
            <>
              <span />
              <Button
                type="button"
                onClick={() => onOpenChange(false)}
                className="bg-[#7F39EC] text-white hover:bg-[#6a2fd0] sm:min-w-[140px]"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScopeChip({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1",
        isDark ? "bg-white/5 text-white/80 ring-white/10" : "bg-white text-slate-700 ring-slate-200",
      )}
    >
      {children}
    </span>
  );
}

function StatePill({
  meta,
  isDark,
}: {
  meta: ReturnType<typeof stateMeta>;
  isDark: boolean;
}) {
  const { Icon } = meta;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        toneClasses(meta.tone, isDark),
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone,
  isDark,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red" | "slate";
  isDark: boolean;
}) {
  const dot = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
    slate: isDark ? "bg-white/30" : "bg-slate-400",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white",
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MessageList({
  items,
  tone,
  isDark,
}: {
  items: string[];
  tone: "red" | "amber";
  isDark: boolean;
}) {
  return (
    <ul
      className={cn(
        "space-y-1 rounded-lg px-3 py-2 text-xs ring-1",
        toneClasses(tone, isDark),
      )}
    >
      {items.slice(0, 8).map((m, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          <span>{m}</span>
        </li>
      ))}
      {items.length > 8 && <li>…and {items.length - 8} more</li>}
    </ul>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  SKYDO_OVERDUE_MS,
  getPayoutIdentifier,
  type AdminPayoutMethodDetailResponse,
  type AdminPayoutMethodRow,
} from "@/lib/admin-payout-methods";
import {
  SKYDO_STATUSES,
  SKYDO_STATUS_DESCRIPTIONS,
  SKYDO_STATUS_LABELS,
  getSkydoStatus,
} from "@/lib/skydo-payout";
import { SkydoStatusBadge } from "@/components/payouts/SkydoStatusBadge";
import type { SkydoStatus } from "@/types/earnings";
import {
  METHOD_LABELS,
  MethodIcon,
  RelativeTime,
  copyText,
  durationSince,
  exactTime,
  palette,
} from "./shared";

const NOTES_MAX = 2000;

function Section({
  title,
  children,
  isDark,
  action,
}: {
  title: string;
  children: ReactNode;
  isDark: boolean;
  action?: ReactNode;
}) {
  return (
    <section className={cn("space-y-3 border-t px-6 py-5", isDark ? "border-gray-800" : "border-gray-100")}>
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            isDark ? "text-gray-400" : "text-gray-500"
          )}
        >
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  copyValue,
  mono,
  isDark,
  trailing,
}: {
  label: string;
  value: ReactNode;
  copyValue?: string;
  mono?: boolean;
  isDark: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-start gap-3 text-sm">
      <span className={palette(isDark).muted}>{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className={cn("min-w-0 break-all", mono && "font-mono text-xs")}>{value || "—"}</span>
        {trailing}
        {copyValue && (
          <button
            type="button"
            onClick={() => copyText(copyValue, label)}
            aria-label={`Copy ${label}`}
            className={cn("shrink-0 rounded p-1 opacity-60 hover:opacity-100", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function payoutFields(row: AdminPayoutMethodRow, revealBank: boolean) {
  const d = (row.details ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const fields: { label: string; value: string; copy?: string; mono?: boolean; bank?: boolean }[] = [];
  switch (row.method_type) {
    case "skydo":
      fields.push({ label: "Skydo email", value: s(d.email), copy: s(d.email), mono: true });
      break;
    case "upi":
      fields.push({ label: "UPI ID", value: s(d.upi_id), copy: s(d.upi_id), mono: true });
      if (d.account_holder_name) fields.push({ label: "Account holder", value: s(d.account_holder_name) });
      break;
    case "crypto":
    case "phantom":
      fields.push({ label: "Wallet", value: s(d.wallet_address), copy: s(d.wallet_address), mono: true });
      if (d.network) fields.push({ label: "Network", value: s(d.network) });
      if (d.currency || d.preferred_token)
        fields.push({ label: "Token", value: s(d.currency || d.preferred_token) });
      break;
    case "bank_transfer": {
      const acct = s(d.account_number);
      fields.push({ label: "Account holder", value: s(d.account_holder_name), copy: s(d.account_holder_name) });
      fields.push({
        label: "Account number",
        value: revealBank ? acct : getPayoutIdentifier("bank_transfer", d),
        copy: acct,
        mono: true,
        bank: true,
      });
      if (d.ifsc_code) fields.push({ label: "IFSC", value: s(d.ifsc_code), copy: s(d.ifsc_code), mono: true });
      if (d.swift_bic_code)
        fields.push({ label: "SWIFT / BIC", value: s(d.swift_bic_code), copy: s(d.swift_bic_code), mono: true });
      if (d.bank_name) fields.push({ label: "Bank", value: s(d.bank_name) });
      if (d.country) fields.push({ label: "Country", value: s(d.country) });
      break;
    }
  }
  return fields;
}

function SkydoTimeline({ row, isDark }: { row: AdminPayoutMethodRow; isDark: boolean }) {
  const status = getSkydoStatus(row);
  const idx = SKYDO_STATUSES.indexOf(status);
  const changedAt = row.skydo_status_updated_at;
  const steps = [
    { label: "Method added", at: row.created_at, done: true },
    { label: "Skydo email sent", at: status === "email_sent" ? changedAt : null, done: idx >= 1 },
    { label: "Payout method verified", at: status === "verified" ? changedAt : null, done: idx >= 2 },
  ];
  const overdue =
    status === "email_pending" &&
    Date.now() - new Date(row.stage_since ?? row.created_at).getTime() > SKYDO_OVERDUE_MS;

  return (
    <div className="space-y-3">
      <ol className="relative space-y-4">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex gap-3">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[9px] top-5 h-[calc(100%+4px)] w-px",
                  steps[i + 1].done ? "bg-emerald-500" : isDark ? "bg-gray-700" : "bg-gray-200"
                )}
              />
            )}
            {step.done ? (
              <CheckCircle2 className="relative h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Circle className={cn("relative h-5 w-5 shrink-0", isDark ? "text-gray-600" : "text-gray-300")} />
            )}
            <div className="text-sm">
              <div className={cn(!step.done && palette(isDark).muted)}>{step.label}</div>
              {step.at && (
                <div className={cn("text-xs", palette(isDark).muted)}>{exactTime(step.at)}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {overdue && (
        <p className={cn("rounded-md bg-red-500/10 px-3 py-2 text-xs", isDark ? "text-red-400" : "text-red-600")}>
          Pending for {durationSince(row.stage_since ?? row.created_at)}. The user was promised a Skydo email within 24 hours.
        </p>
      )}
      {changedAt && (
        <p className={cn("text-xs", palette(isDark).muted)}>
          Status last changed {exactTime(changedAt)}
          {row.status_updated_by_name ? ` by ${row.status_updated_by_name}` : ""}.
        </p>
      )}
    </div>
  );
}

function NotesEditor({
  methodId,
  initial,
  isDark,
  onSave,
}: {
  methodId: string;
  initial: string;
  isDark: boolean;
  onSave: (id: string, notes: string | null) => Promise<boolean>;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const savedValue = useRef(initial);
  const valueRef = useRef(value);
  valueRef.current = value;

  const lastMethodId = useRef(methodId);
  useEffect(() => {
    const switched = lastMethodId.current !== methodId;
    lastMethodId.current = methodId;
    const dirty = !switched && valueRef.current !== savedValue.current;
    savedValue.current = initial;
    if (!dirty) setValue(initial);
    if (switched) setState("idle");
  }, [methodId, initial]);

  const save = useCallback(async () => {
    if (value === savedValue.current) return;
    setState("saving");
    const ok = await onSave(methodId, value.trim() ? value : null);
    if (ok) {
      savedValue.current = value;
      setState("saved");
    } else setState("idle");
  }, [methodId, onSave, value]);

  return (
    <div className="space-y-1.5">
      <Textarea
        value={value}
        maxLength={NOTES_MAX}
        onChange={(e) => {
          setValue(e.target.value);
          setState("idle");
        }}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
        rows={3}
        placeholder="Private notes for admins, e.g. invite sent from ops@ on Monday"
        className={cn("resize-y text-sm", palette(isDark).input)}
      />
      <div className={cn("flex justify-between text-xs", palette(isDark).muted)}>
        <span>
          {state === "saving" ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : state === "saved" ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" /> Saved
            </span>
          ) : (
            "Saves when you click away, or press Ctrl+Enter"
          )}
        </span>
        <span className="tabular-nums">
          {value.length}/{NOTES_MAX}
        </span>
      </div>
    </div>
  );
}

export function PayoutMethodDrawer({
  methodId,
  refreshKey,
  isDark,
  onClose,
  onOpen,
  onSetStatus,
  onSaveNotes,
}: {
  methodId: string | null;
  /** Changes whenever the list refetches so the drawer stays in sync. */
  refreshKey: number | null;
  isDark: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSetStatus: (row: AdminPayoutMethodRow, status: SkydoStatus) => void;
  onSaveNotes: (id: string, notes: string | null) => Promise<boolean>;
}) {
  const p = palette(isDark);
  const [data, setData] = useState<AdminPayoutMethodDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealBank, setRevealBank] = useState(false);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    if (!methodId) {
      loadedId.current = null;
      setData(null);
      return;
    }
    let cancelled = false;
    if (loadedId.current !== methodId) {
      setData(null);
      setError(null);
      setRevealBank(false);
    }
    fetch(`/api/admin/payout-methods/${methodId}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load payout method");
        return json as AdminPayoutMethodDetailResponse;
      })
      .then((json) => {
        if (cancelled) return;
        loadedId.current = methodId;
        setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [methodId, refreshKey]);

  const row = data?.method ?? null;
  const isSkydo = row?.method_type === "skydo";
  const status = row && isSkydo ? getSkydoStatus(row) : null;

  return (
    <Sheet open={methodId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          "flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[480px]",
          isDark && "border-gray-800 bg-[#06021D] text-white"
        )}
      >
        {!row ? (
          <div className="space-y-4 p-6">
            <SheetTitle className="sr-only">Payout method details</SheetTitle>
            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : (
              <>
                <Skeleton className={cn("h-6 w-48", isDark && "bg-white/10")} />
                <Skeleton className={cn("h-4 w-64", isDark && "bg-white/10")} />
                <Skeleton className={cn("h-32 w-full", isDark && "bg-white/10")} />
                <Skeleton className={cn("h-24 w-full", isDark && "bg-white/10")} />
              </>
            )}
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-2 px-6 pb-5 pt-6 text-left">
              <SheetTitle className={cn("pr-8 text-lg", isDark && "text-white")}>
                {row.full_name || row.username || "Unnamed user"}
              </SheetTitle>
              <SheetDescription asChild>
                <div className={cn("space-y-2 text-sm", p.muted)}>
                  <div className="flex items-center gap-1">
                    <span className="truncate">{row.email ?? "—"}</span>
                    {row.email && (
                      <button
                        type="button"
                        onClick={() => copyText(row.email!, "Account email")}
                        aria-label="Copy account email"
                        className="rounded p-1 opacity-60 hover:opacity-100"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {row.username && <span className="truncate">· @{row.username}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                        isDark ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700"
                      )}
                    >
                      <MethodIcon type={row.method_type} className="h-3 w-3" />
                      {METHOD_LABELS[row.method_type] ?? row.method_type}
                    </span>
                    {row.is_default && (
                      <span className="rounded-full bg-[#7F39EC]/15 px-2 py-0.5 text-xs font-medium text-[#7F39EC]">
                        Default
                      </span>
                    )}
                    {row.user_type && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs capitalize",
                          isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {row.user_type}
                      </span>
                    )}
                    {status && <SkydoStatusBadge status={status} size="sm" />}
                  </div>
                </div>
              </SheetDescription>
            </SheetHeader>

            {isSkydo && status && (
              <Section title="Skydo verification" isDark={isDark}>
                <SkydoTimeline row={row} isDark={isDark} />
                <p className={cn("text-xs", p.muted)}>{SKYDO_STATUS_DESCRIPTIONS[status]}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {status === "email_pending" && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
                      onClick={() => onSetStatus(row, "email_sent")}
                    >
                      <Send className="h-3.5 w-3.5" /> Mark email sent
                    </Button>
                  )}
                  {status === "email_sent" && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => onSetStatus(row, "verified")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark verified
                    </Button>
                  )}
                  <Select value={status} onValueChange={(v) => onSetStatus(row, v as SkydoStatus)}>
                    <SelectTrigger isDark={isDark} className="h-9 w-[200px]" aria-label="Set Skydo status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      {SKYDO_STATUSES.map((s) => (
                        <SelectItem isDark={isDark} key={s} value={s}>
                          {SKYDO_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Section>
            )}

            <Section title="Payout details" isDark={isDark}>
              <div className="space-y-2.5">
                {payoutFields(row, revealBank).map((f) => (
                  <Field
                    key={f.label}
                    label={f.label}
                    value={f.value}
                    copyValue={f.copy || undefined}
                    mono={f.mono}
                    isDark={isDark}
                    trailing={
                      f.bank ? (
                        <button
                          type="button"
                          onClick={() => setRevealBank((v) => !v)}
                          aria-label={revealBank ? "Hide account number" : "Reveal account number"}
                          className="shrink-0 rounded p-1 opacity-60 hover:opacity-100"
                        >
                          {revealBank ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      ) : undefined
                    }
                  />
                ))}
                <Field label="Added" value={<RelativeTime value={row.created_at} />} isDark={isDark} />
              </div>
            </Section>

            <Section title="Admin notes" isDark={isDark}>
              <NotesEditor
                methodId={row.id}
                initial={row.admin_notes ?? ""}
                isDark={isDark}
                onSave={onSaveNotes}
              />
            </Section>

            <Section title="Account" isDark={isDark}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Withdrawable",
                    value:
                      row.withdrawable_balance === null
                        ? "—"
                        : formatCurrencyFromCents(row.withdrawable_balance),
                  },
                  { label: "Withdrawals", value: String(row.withdrawal_count ?? 0) },
                  { label: "Country", value: row.country || "—" },
                ].map((s) => (
                  <div key={s.label} className={cn("rounded-lg p-3", p.surfaceAlt)}>
                    <div className={cn("text-[11px] uppercase", p.muted)}>{s.label}</div>
                    <div className="mt-0.5 truncate font-semibold tabular-nums">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className={cn("text-xs", p.muted)}>
                Joined {row.user_created_at ? exactTime(row.user_created_at) : "—"}
                {row.last_withdrawal_at && <> · Last withdrawal {exactTime(row.last_withdrawal_at)}</>}
              </div>
            </Section>

            <Section title={`Other payout methods (${data?.otherMethods.length ?? 0})`} isDark={isDark}>
              {data && data.otherMethods.length > 0 ? (
                <ul className="space-y-1.5">
                  {data.otherMethods.map((m) => {
                    const ident = getPayoutIdentifier(m.method_type, m.details);
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(m.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            isDark ? "border-gray-800 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          <MethodIcon type={m.method_type} className={p.muted} />
                          <span className="font-medium">{METHOD_LABELS[m.method_type] ?? m.method_type}</span>
                          <span className={cn("min-w-0 flex-1 truncate font-mono text-xs", p.muted)}>{ident}</span>
                          {m.is_default && (
                            <span className="text-[10px] font-semibold uppercase text-[#7F39EC]">Default</span>
                          )}
                          {m.method_type === "skydo" && (
                            <SkydoStatusBadge status={getSkydoStatus(m)} size="sm" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className={cn("text-sm", p.muted)}>This user has no other payout methods.</p>
              )}
            </Section>

            <Section title="Recent withdrawals to this method" isDark={isDark}>
              {data && data.recentWithdrawals.length > 0 ? (
                <ul className="space-y-1.5">
                  {data.recentWithdrawals.map((w) => (
                    <li
                      key={w.id}
                      className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", p.surfaceAlt)}
                    >
                      <div>
                        <div className="font-medium tabular-nums">
                          {w.amount_type === "coins" ? `${w.amount} coins` : formatCurrencyFromCents(w.amount)}
                        </div>
                        <div className={cn("text-xs", p.muted)}>
                          <RelativeTime value={w.created_at} />
                        </div>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs capitalize",
                          w.status === "completed" || w.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-600"
                            : w.status === "rejected" || w.status === "failed"
                              ? "bg-red-500/15 text-red-600"
                              : "bg-amber-500/15 text-amber-600"
                        )}
                      >
                        {w.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={cn("text-sm", p.muted)}>No withdrawals have used this method yet.</p>
              )}
            </Section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

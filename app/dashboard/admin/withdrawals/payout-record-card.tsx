"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  Copy,
  Hash,
  IndianRupee,
  Landmark,
  Loader2,
  Pencil,
  Receipt,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  impliedUsdInrRate,
  readPayoutDetails,
  type WithdrawalPayoutDetails,
} from "@/lib/skydo-payout-import";

export type PayoutRecordInput = {
  payout_id: string;
  utr: string;
  payout_amount_usd: string;
  amount_settled_inr: string;
  date_of_credit: string;
};

export const EMPTY_PAYOUT_RECORD_INPUT: PayoutRecordInput = {
  payout_id: "",
  utr: "",
  payout_amount_usd: "",
  amount_settled_inr: "",
  date_of_credit: "",
};

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "2026-10-16" → "16 Oct 2026" without timezone drift. */
export function formatCreditDate(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy");
  }
}

function CopyChip({
  value,
  label,
  isDark,
}: {
  value: string;
  label: string;
  isDark: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => void copy(value, label)}
      title={`Copy ${label}`}
      className={cn(
        "group inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs transition-colors",
        isDark
          ? "border-white/10 bg-white/5 text-white hover:border-violet-400/50 hover:bg-violet-500/10"
          : "border-slate-200 bg-slate-50 text-slate-900 hover:border-violet-300 hover:bg-violet-50",
      )}
    >
      <span className="truncate">{value}</span>
      <Copy className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
    </button>
  );
}

export function toPayoutRecordInput(details: WithdrawalPayoutDetails | null): PayoutRecordInput {
  if (!details) return EMPTY_PAYOUT_RECORD_INPUT;
  return {
    payout_id: details.payout_id ?? "",
    utr: details.utr ?? "",
    payout_amount_usd: details.payout_amount_usd != null ? details.payout_amount_usd.toFixed(2) : "",
    amount_settled_inr:
      details.amount_settled_inr != null ? details.amount_settled_inr.toFixed(2) : "",
    date_of_credit: details.date_of_credit ?? "",
  };
}

/** Five fields used by the record card and the bulk "Enter manually" tab. */
export function PayoutRecordFields({
  value,
  onChange,
  isDark,
  amountHint,
  idPrefix = "payout",
}: {
  value: PayoutRecordInput;
  onChange: (next: PayoutRecordInput) => void;
  isDark: boolean;
  amountHint?: React.ReactNode;
  idPrefix?: string;
}) {
  const set = (k: keyof PayoutRecordInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const inputCls = cn(
    "h-10 text-sm",
    isDark ? "border-white/10 bg-white/[0.03] text-white placeholder:text-white/30" : "bg-white",
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-id`} className="text-xs font-medium">
          Payout ID
        </Label>
        <Input
          id={`${idPrefix}-id`}
          value={value.payout_id}
          onChange={set("payout_id")}
          placeholder="pout_K4cpDw"
          className={cn(inputCls, "font-mono")}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-utr`} className="text-xs font-medium">
          UTR number
        </Label>
        <Input
          id={`${idPrefix}-utr`}
          value={value.utr}
          onChange={set("utr")}
          placeholder="628919315123"
          inputMode="numeric"
          className={cn(inputCls, "font-mono")}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-usd`} className="text-xs font-medium">
          Payout amount (USD)
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id={`${idPrefix}-usd`}
            value={value.payout_amount_usd}
            onChange={set("payout_amount_usd")}
            placeholder="14.10"
            inputMode="decimal"
            className={cn(inputCls, "pl-7 tabular-nums")}
          />
        </div>
        {amountHint}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-inr`} className="text-xs font-medium">
          Amount settled (INR)
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ₹
          </span>
          <Input
            id={`${idPrefix}-inr`}
            value={value.amount_settled_inr}
            onChange={set("amount_settled_inr")}
            placeholder="1,331.47"
            inputMode="decimal"
            className={cn(inputCls, "pl-7 tabular-nums")}
          />
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-date`} className="text-xs font-medium">
          Date of credit
        </Label>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={value.date_of_credit}
          onChange={set("date_of_credit")}
          className={cn(inputCls, "sm:max-w-[220px]", isDark && "[color-scheme:dark]")}
        />
      </div>
    </div>
  );
}

/**
 * Read view of a withdrawal's payout record (Skydo payout ID, UTR, amounts, credit
 * date), with an inline editor. Renders an "Add payout record" prompt when empty.
 */
export function PayoutRecordCard({
  raw,
  isDark,
  onSave,
  canEdit = true,
}: {
  raw: unknown;
  isDark: boolean;
  onSave: (input: PayoutRecordInput) => Promise<boolean>;
  canEdit?: boolean;
}) {
  const details = readPayoutDetails(raw);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PayoutRecordInput>(() => toPayoutRecordInput(details));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(toPayoutRecordInput(readPayoutDetails(raw)));
    setEditing(false);
  }, [raw]);

  const shell = cn(
    "overflow-hidden rounded-xl border",
    isDark ? "border-white/10 bg-[#0B0629]" : "border-slate-200 bg-white",
  );

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (!details && !editing) {
    if (!canEdit) return null;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3",
          isDark ? "border-white/15 bg-white/[0.02]" : "border-slate-300 bg-slate-50/60",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              isDark ? "bg-white/5 text-white/60" : "bg-white text-slate-500 shadow-sm",
            )}
          >
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium">No payout record yet</p>
            <p className="text-xs text-muted-foreground">
              Add the Skydo payout ID, UTR and settled amount once it&apos;s sent.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn("gap-1.5", isDark && "border-white/15 bg-transparent hover:bg-white/5")}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Add payout record
        </Button>
      </div>
    );
  }

  const rate = details ? impliedUsdInrRate(details) : null;

  return (
    <div className={shell}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-4 py-3",
          isDark
            ? "border-white/10 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent"
            : "border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-white",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-100 text-emerald-700",
            )}
          >
            <BadgeCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Payout record</p>
            <p className="truncate text-xs text-muted-foreground">
              {details?.provider === "skydo" ? "Skydo" : "Manual"}
              {details?.source === "import" ? " · imported" : ""}
              {details && details.group_request_count > 1
                ? ` · one payout for ${details.group_request_count} requests`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {details?.status && !editing && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                /complete/i.test(details.status)
                  ? isDark
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-emerald-100 text-emerald-700"
                  : isDark
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-amber-100 text-amber-800",
              )}
            >
              {details.status}
            </span>
          )}
          {canEdit && !editing && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              title="Edit payout record"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-4 p-4">
          <PayoutRecordFields value={draft} onChange={setDraft} isDark={isDark} idPrefix="record" />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDraft(toPayoutRecordInput(details));
                setEditing(false);
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || (!draft.payout_id.trim() && !draft.utr.trim())}
              onClick={() => void save()}
              className="bg-[#7F39EC] text-white hover:bg-[#6a2fd0]"
            >
              {saving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Save record
            </Button>
          </div>
        </div>
      ) : details ? (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              isDark={isDark}
              icon={<Landmark className="h-3.5 w-3.5" />}
              label="Paid"
              value={details.payout_amount_usd != null ? formatUsd(details.payout_amount_usd) : "—"}
              sub={
                details.group_request_count > 1
                  ? `for ${details.group_request_count} requests`
                  : "USD"
              }
            />
            <Stat
              isDark={isDark}
              icon={<IndianRupee className="h-3.5 w-3.5" />}
              label="Settled"
              value={details.amount_settled_inr != null ? formatInr(details.amount_settled_inr) : "—"}
              sub={rate ? `₹${rate.toFixed(2)} per $1` : "Not settled yet"}
            />
            <Stat
              isDark={isDark}
              icon={<CalendarCheck className="h-3.5 w-3.5" />}
              label="Credited"
              value={formatCreditDate(details.date_of_credit)}
              sub={details.date_of_credit ? "to bank" : "Pending"}
              className="col-span-2 sm:col-span-1"
            />
          </div>
          <div
            className={cn(
              "mt-3 grid grid-cols-1 gap-2 rounded-lg p-3 sm:grid-cols-2",
              isDark ? "bg-white/[0.03]" : "bg-slate-50",
            )}
          >
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Hash className="h-3 w-3" /> Payout ID
              </p>
              {details.payout_id ? (
                <CopyChip value={details.payout_id} label="Payout ID" isDark={isDark} />
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Receipt className="h-3 w-3" /> UTR
              </p>
              {details.utr ? (
                <CopyChip value={details.utr} label="UTR" isDark={isDark} />
              ) : (
                <p className="text-sm text-muted-foreground">Not issued yet</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  sub,
  isDark,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  isDark: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-base font-semibold tabular-nums",
          isDark ? "text-white" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

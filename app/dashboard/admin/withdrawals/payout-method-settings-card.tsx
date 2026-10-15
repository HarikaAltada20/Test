"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, IndianRupee, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CollapsibleAdminSection } from "@/components/admin/CollapsibleAdminSection";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import {
  DEFAULT_USD_INR_RATE,
  PAYOUT_FEE_METHOD_TYPES,
  formatFeePercentNumber,
  formatQuoteReceive,
  formatUsdInrRate,
  parseFeePercentToBps,
  parseUsdInrRate,
  payoutCurrencyFor,
  quotePayout,
} from "@/lib/payout-fees";

type MethodSetting = {
  method_type: string;
  is_paused: boolean;
  fee_bps: number;
  updated_at?: string | null;
};

const METHOD_LABELS: Record<string, string> = {
  crypto: "Crypto",
  upi: "UPI",
  bank_transfer: "Bank transfer",
  skydo: "Skydo",
};

/** Example used for the "$100 withdrawal →" preview. */
const EXAMPLE_CENTS = 10000;
const STORAGE_KEY = "admin-payout-method-settings-open";

function formatChanged(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM yyyy, h:mm a");
}

/** Collapsible admin card: method on/off, processing fee per method, USD to INR rate. */
export function PayoutMethodSettingsCard({ isDark }: { isDark: boolean }) {
  const [settings, setSettings] = useState<MethodSetting[]>([]);
  const [rate, setRate] = useState<number>(DEFAULT_USD_INR_RATE);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/payout-method-settings");
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (cancelled) return;
        setSettings(
          (json.settings || []).map((s: MethodSetting) => ({ ...s, fee_bps: Number(s.fee_bps ?? 0) }))
        );
        setRate(Number(json.usdInrRate ?? DEFAULT_USD_INR_RATE));
        setRateUpdatedAt(json.usdInrRateUpdatedAt ?? null);
      } catch (e) {
        console.error("Failed to load payout method settings", e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const settingFor = (methodType: string): MethodSetting =>
    settings.find((s) => s.method_type === methodType) ?? { method_type: methodType, is_paused: false, fee_bps: 0 };

  const onCount = PAYOUT_FEE_METHOD_TYPES.filter((t) => !settingFor(t).is_paused).length;
  const summary = loading
    ? "Loading…"
    : loadError
      ? "Couldn't load"
      : `${onCount} of ${PAYOUT_FEE_METHOD_TYPES.length} methods on`;

  return (
    <CollapsibleAdminSection
      title="Payout method settings"
      description="Turn methods on or off, set processing fees and the USD to INR rate."
      icon={SlidersHorizontal}
      summary={summary}
      storageKey={STORAGE_KEY}
      isDark={isDark}
    >
      {loading ? (
        <p className={cn("text-sm", isDark ? "text-slate-400" : "text-muted-foreground")}>Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-red-500">Couldn&apos;t load payout settings. Refresh to try again.</p>
      ) : (
        <SettingsEditor
          isDark={isDark}
          settingFor={settingFor}
          rate={rate}
          rateUpdatedAt={rateUpdatedAt}
          onSettingSaved={(saved) =>
            setSettings((prev) => [...prev.filter((s) => s.method_type !== saved.method_type), saved])
          }
          onRateSaved={(r, at) => {
            setRate(r);
            setRateUpdatedAt(at);
          }}
        />
      )}
    </CollapsibleAdminSection>
  );
}

function SettingsEditor({
  isDark,
  settingFor,
  rate,
  rateUpdatedAt,
  onSettingSaved,
  onRateSaved,
}: {
  isDark: boolean;
  settingFor: (methodType: string) => MethodSetting;
  rate: number;
  rateUpdatedAt: string | null;
  onSettingSaved: (saved: MethodSetting) => void;
  onRateSaved: (rate: number, updatedAt: string | null) => void;
}) {
  const muted = isDark ? "text-slate-400" : "text-muted-foreground";
  const inputClass = isDark ? "bg-[#0d021f] border-white/15 text-white" : "bg-white border-slate-300";

  const [rateInput, setRateInput] = useState(String(rate));
  const [rateBusy, setRateBusy] = useState(false);
  const [rateSavedFlash, setRateSavedFlash] = useState(false);
  const parsedRate = parseUsdInrRate(rateInput);
  const rateDirty = parsedRate !== rate;

  const saveRate = async () => {
    if (parsedRate === null) return;
    setRateBusy(true);
    try {
      const res = await fetch("/api/admin/payout-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usd_inr_rate: parsedRate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      onRateSaved(json.usdInrRate, json.updatedAt ?? null);
      setRateInput(String(json.usdInrRate));
      setRateSavedFlash(true);
      setTimeout(() => setRateSavedFlash(false), 2000);
      toast.success("Rate saved. Applies to new UPI and bank transfer requests.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update. Please try again.");
    } finally {
      setRateBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className={cn("text-xs", muted)}>
        Changes apply to new withdrawal requests only, for creators and brands. Requests already made keep the fee
        and rate they were shown.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PAYOUT_FEE_METHOD_TYPES.map((methodType) => (
          <MethodRow
            key={methodType}
            methodType={methodType}
            setting={settingFor(methodType)}
            rate={rate}
            isDark={isDark}
            inputClass={inputClass}
            onSaved={onSettingSaved}
          />
        ))}
      </div>

      <form
        className={cn(
          "flex flex-col gap-2 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-end sm:gap-4",
          isDark ? "border-white/10" : "border-slate-200"
        )}
        onSubmit={(e) => {
          e.preventDefault();
          void saveRate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="usd-inr-rate" className="flex items-center gap-1 text-xs font-medium">
            <IndianRupee className="h-3.5 w-3.5" aria-hidden />
            USD to INR rate
          </Label>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap text-sm">1 USD =</span>
            <div className="relative w-32">
              <span className={cn("pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm", muted)}>
                ₹
              </span>
              <Input
                id="usd-inr-rate"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                disabled={rateBusy}
                aria-invalid={parsedRate === null}
                aria-describedby="usd-inr-rate-help"
                className={cn("h-9 pl-6 tabular-nums", inputClass, parsedRate === null && "border-red-500")}
              />
            </div>
            <SaveButton busy={rateBusy} saved={rateSavedFlash} disabled={!rateDirty || parsedRate === null} />
            {rateDirty && !rateBusy && (
              <ResetButton onClick={() => setRateInput(String(rate))} isDark={isDark} />
            )}
          </div>
        </div>
        <p id="usd-inr-rate-help" className={cn("text-xs sm:pb-2", parsedRate === null ? "text-red-500" : muted)}>
          {parsedRate === null
            ? "Enter a rate from 1 to 500, with up to 4 decimals."
            : `Used for UPI and bank transfer payouts. Currently ${formatUsdInrRate(rate)} per $1.${
                formatChanged(rateUpdatedAt) ? ` Last changed ${formatChanged(rateUpdatedAt)}.` : ""
              }`}
        </p>
      </form>
    </div>
  );
}

function MethodRow({
  methodType,
  setting,
  rate,
  isDark,
  inputClass,
  onSaved,
}: {
  methodType: string;
  setting: MethodSetting;
  rate: number;
  isDark: boolean;
  inputClass: string;
  onSaved: (saved: MethodSetting) => void;
}) {
  const muted = isDark ? "text-slate-400" : "text-muted-foreground";
  const label = METHOD_LABELS[methodType] ?? methodType;
  const [input, setInput] = useState(formatFeePercentNumber(setting.fee_bps));
  const [busy, setBusy] = useState<"fee" | "toggle" | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const enabled = !setting.is_paused;
  const parsedBps = parseFeePercentToBps(input);
  const dirty = parsedBps !== setting.fee_bps;
  const example = quotePayout({
    amountCents: EXAMPLE_CENTS,
    methodType,
    feeBps: parsedBps ?? setting.fee_bps,
    usdInrRate: rate,
  });
  const changed = formatChanged(setting.updated_at);
  const inputId = `fee-${methodType}`;
  const helpId = `fee-${methodType}-help`;

  const patch = async (body: { is_paused?: boolean; fee_bps?: number }) => {
    const res = await fetch("/api/admin/payout-method-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method_type: methodType, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Update failed");
    const saved: MethodSetting = { ...json.setting, fee_bps: Number(json.setting?.fee_bps ?? 0) };
    onSaved(saved);
    return saved;
  };

  const saveFee = async () => {
    if (parsedBps === null) return;
    setBusy("fee");
    try {
      const saved = await patch({ fee_bps: parsedBps });
      setInput(formatFeePercentNumber(saved.fee_bps));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.success(`${label} fee set to ${formatFeePercentNumber(saved.fee_bps)}%. Applies to new requests.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (checked: boolean) => {
    setBusy("toggle");
    try {
      await patch({ is_paused: !checked });
      toast.success(checked ? `${label} is on for withdrawals.` : `${label} is paused. Users can't pick it for new withdrawals.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border px-3.5 py-3 transition-colors",
        enabled
          ? isDark
            ? "border-emerald-500/35 bg-emerald-500/10"
            : "border-emerald-200 bg-emerald-50/70"
          : isDark
            ? "border-white/10 bg-white/5"
            : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p
            className={cn(
              "mt-0.5 text-xs",
              enabled ? (isDark ? "text-emerald-300" : "text-emerald-700") : "text-slate-500"
            )}
          >
            {enabled ? "On for withdrawals" : "Paused"}
          </p>
        </div>
        {busy === "toggle" && <Loader2 className={cn("h-4 w-4 animate-spin", muted)} aria-label="Saving" />}
        <Switch
          checked={enabled}
          aria-label={`${label} available for withdrawals`}
          onCheckedChange={(checked) => void toggle(checked)}
          disabled={busy !== null}
          className={cn(
            "border-transparent",
            "data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500",
            "data-[state=unchecked]:border-slate-300 data-[state=unchecked]:bg-slate-300",
            isDark && "data-[state=unchecked]:border-slate-600 data-[state=unchecked]:bg-slate-600"
          )}
        />
      </div>
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveFee();
        }}
      >
        <div className="flex items-center justify-between">
          <Label htmlFor={inputId} className="text-xs font-medium">
            Processing fee
          </Label>
          {dirty && parsedBps !== null && (
            <span className={cn("text-[11px] font-medium", isDark ? "text-amber-300" : "text-amber-700")}>
              Unsaved
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id={inputId}
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy !== null}
              aria-invalid={parsedBps === null}
              aria-describedby={helpId}
              className={cn("h-9 pr-7 tabular-nums", inputClass, parsedBps === null && "border-red-500")}
            />
            <span className={cn("pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm", muted)}>
              %
            </span>
          </div>
          <SaveButton busy={busy === "fee"} saved={savedFlash} disabled={!dirty || parsedBps === null || busy !== null} />
          {dirty && busy === null && (
            <ResetButton onClick={() => setInput(formatFeePercentNumber(setting.fee_bps))} isDark={isDark} />
          )}
        </div>
        <p id={helpId} className={cn("text-xs", parsedBps === null ? "text-red-500" : muted)}>
          {parsedBps === null ? (
            "Enter 0 to 50, with up to 2 decimals."
          ) : (
            <>
              $100 →{" "}
              <span className={cn("font-medium", isDark ? "text-white" : "text-slate-900")}>
                {formatQuoteReceive(example)}
              </span>
              {payoutCurrencyFor(methodType) === "INR" ? "" : " USD"} after {formatCurrencyFromCents(example.feeCents)} fee
            </>
          )}
        </p>
        {changed && <p className={cn("text-[11px]", muted)}>Last changed {changed}</p>}
      </form>
    </div>
  );
}

function SaveButton({ busy, saved, disabled }: { busy: boolean; saved: boolean; disabled: boolean }) {
  return (
    <Button type="submit" size="sm" className="h-9 min-w-[64px]" disabled={disabled || busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-label="Saving" />
      ) : saved ? (
        <>
          <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
          Saved
        </>
      ) : (
        "Save"
      )}
    </Button>
  );
}

function ResetButton({ onClick, isDark }: { onClick: () => void; isDark: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label="Undo changes"
      className={cn("h-9 px-2", isDark ? "text-slate-300 hover:bg-white/10" : "text-slate-600")}
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}

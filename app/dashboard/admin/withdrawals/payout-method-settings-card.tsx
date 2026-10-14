"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { IndianRupee, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

/** Example used for the "A $100 withdrawal pays out …" line. */
const EXAMPLE_CENTS = 10000;

function formatChanged(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : format(d, "d MMM yyyy, h:mm a");
}

export function PayoutMethodSettingsCard({ isDark }: { isDark: boolean }) {
  const [settings, setSettings] = useState<MethodSetting[]>([]);
  const [rate, setRate] = useState<number>(DEFAULT_USD_INR_RATE);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [feeInputs, setFeeInputs] = useState<Record<string, string>>({});
  const [rateInput, setRateInput] = useState(String(DEFAULT_USD_INR_RATE));
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/payout-method-settings");
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        if (cancelled) return;
        const rows: MethodSetting[] = (json.settings || []).map((s: MethodSetting) => ({
          ...s,
          fee_bps: Number(s.fee_bps ?? 0),
        }));
        setSettings(rows);
        setFeeInputs(
          Object.fromEntries(rows.map((s) => [s.method_type, formatFeePercentNumber(s.fee_bps)]))
        );
        const r = Number(json.usdInrRate ?? DEFAULT_USD_INR_RATE);
        setRate(r);
        setRateInput(String(r));
        setRateUpdatedAt(json.usdInrRateUpdatedAt ?? null);
        setLoadError(false);
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
    settings.find((s) => s.method_type === methodType) ?? {
      method_type: methodType,
      is_paused: false,
      fee_bps: 0,
    };

  const patchMethod = async (methodType: string, patch: { is_paused?: boolean; fee_bps?: number }) => {
    setBusy(methodType);
    try {
      const res = await fetch("/api/admin/payout-method-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method_type: methodType, ...patch }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      const saved: MethodSetting = { ...json.setting, fee_bps: Number(json.setting?.fee_bps ?? 0) };
      setSettings((prev) => [...prev.filter((s) => s.method_type !== methodType), saved]);
      if (patch.fee_bps !== undefined) {
        setFeeInputs((prev) => ({ ...prev, [methodType]: formatFeePercentNumber(saved.fee_bps) }));
      }
      return true;
    } catch (e) {
      console.error("Failed to update payout method setting", e);
      toast.error(e instanceof Error ? e.message : "Failed to update. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveFee = async (methodType: string) => {
    const bps = parseFeePercentToBps(feeInputs[methodType] ?? "");
    if (bps === null) {
      toast.error("Enter a fee from 0 to 50%, with up to 2 decimals.");
      return;
    }
    if (await patchMethod(methodType, { fee_bps: bps })) {
      toast.success(`${METHOD_LABELS[methodType] ?? methodType} fee saved. Applies to new requests.`);
    }
  };

  const saveRate = async () => {
    const parsed = parseUsdInrRate(rateInput);
    if (parsed === null) {
      toast.error("Enter a rate from 1 to 500, with up to 4 decimals.");
      return;
    }
    setBusy("rate");
    try {
      const res = await fetch("/api/admin/payout-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usd_inr_rate: parsed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      setRate(json.usdInrRate);
      setRateInput(String(json.usdInrRate));
      setRateUpdatedAt(json.updatedAt ?? null);
      toast.success("Rate saved. Applies to new UPI and bank transfer requests.");
    } catch (e) {
      console.error("Failed to update USD to INR rate", e);
      toast.error(e instanceof Error ? e.message : "Failed to update. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const muted = isDark ? "text-slate-400" : "text-muted-foreground";
  const inputClass = isDark ? "bg-[#0d021f] border-white/15 text-white" : "bg-white border-slate-300";
  const rateDirty = parseUsdInrRate(rateInput) !== rate;

  return (
    <Card
      className={cn(
        "rounded-xl border shadow-none",
        isDark ? "bg-[#170337] border-white/10 text-white" : "bg-white border-slate-200 text-black"
      )}
    >
      <CardHeader className="pb-2 px-4 sm:px-5 pt-4">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Payout method settings
        </CardTitle>
        <CardDescription className={cn("text-sm", muted)}>
          Turn methods on or off and set the processing fee for each. Paused methods can&apos;t be used for new
          withdrawals. Fee and rate changes apply to new requests only, for creators and brands.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 px-4 sm:px-5 pb-4 space-y-4">
        {loading ? (
          <p className={cn("text-sm", muted)}>Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-500">Couldn&apos;t load payout settings. Refresh to try again.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PAYOUT_FEE_METHOD_TYPES.map((methodType) => {
                const s = settingFor(methodType);
                const enabled = !s.is_paused;
                const input = feeInputs[methodType] ?? formatFeePercentNumber(s.fee_bps);
                const parsedBps = parseFeePercentToBps(input);
                const dirty = parsedBps !== s.fee_bps;
                const example = quotePayout({
                  amountCents: EXAMPLE_CENTS,
                  methodType,
                  feeBps: parsedBps ?? s.fee_bps,
                  usdInrRate: rate,
                });
                const changed = formatChanged(s.updated_at);
                const inputId = `fee-${methodType}`;
                return (
                  <div
                    key={methodType}
                    className={cn(
                      "rounded-xl border px-3.5 py-3 space-y-3",
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
                        <p className="font-medium text-sm">{METHOD_LABELS[methodType]}</p>
                        <p
                          className={cn(
                            "text-xs mt-0.5",
                            enabled ? (isDark ? "text-emerald-300" : "text-emerald-700") : "text-slate-500"
                          )}
                        >
                          {enabled ? "Available" : "Paused"}
                        </p>
                      </div>
                      <Switch
                        checked={enabled}
                        aria-label={`${METHOD_LABELS[methodType]} available for withdrawals`}
                        onCheckedChange={(checked) => void patchMethod(methodType, { is_paused: !checked })}
                        disabled={busy === methodType}
                        className={cn(
                          "border-transparent",
                          "data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500",
                          "data-[state=unchecked]:bg-slate-300 data-[state=unchecked]:border-slate-300",
                          isDark &&
                            "data-[state=unchecked]:bg-slate-600 data-[state=unchecked]:border-slate-600 data-[state=checked]:bg-emerald-500"
                        )}
                      />
                    </div>
                    <form
                      className="space-y-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveFee(methodType);
                      }}
                    >
                      <Label htmlFor={inputId} className="text-xs font-medium">
                        Processing fee
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            id={inputId}
                            inputMode="decimal"
                            value={input}
                            onChange={(e) => setFeeInputs((prev) => ({ ...prev, [methodType]: e.target.value }))}
                            disabled={busy === methodType}
                            aria-invalid={parsedBps === null}
                            className={cn("h-9 pr-7 tabular-nums", inputClass, parsedBps === null && "border-red-500")}
                          />
                          <span className={cn("pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm", muted)}>
                            %
                          </span>
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          className="h-9"
                          disabled={!dirty || parsedBps === null || busy === methodType}
                        >
                          Save
                        </Button>
                      </div>
                      <p className={cn("text-xs", muted)}>
                        $100 withdrawal pays out {formatQuoteReceive(example)}
                        {payoutCurrencyFor(methodType) === "INR" ? " in INR" : methodType === "skydo" ? " in USD" : ""}
                      </p>
                      {changed && <p className={cn("text-[11px]", muted)}>Last changed {changed}</p>}
                    </form>
                  </div>
                );
              })}
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
                <Label htmlFor="usd-inr-rate" className="text-xs font-medium flex items-center gap-1">
                  <IndianRupee className="h-3.5 w-3.5" aria-hidden />
                  USD to INR rate
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm whitespace-nowrap">1 USD =</span>
                  <div className="relative w-32">
                    <span className={cn("pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm", muted)}>
                      ₹
                    </span>
                    <Input
                      id="usd-inr-rate"
                      inputMode="decimal"
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      disabled={busy === "rate"}
                      aria-invalid={parseUsdInrRate(rateInput) === null}
                      className={cn(
                        "h-9 pl-6 tabular-nums",
                        inputClass,
                        parseUsdInrRate(rateInput) === null && "border-red-500"
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9"
                    disabled={!rateDirty || parseUsdInrRate(rateInput) === null || busy === "rate"}
                  >
                    Save
                  </Button>
                </div>
              </div>
              <p className={cn("text-xs sm:pb-2", muted)}>
                Used for UPI and bank transfer amounts. Currently {formatUsdInrRate(rate)} per $1.
                {formatChanged(rateUpdatedAt) ? ` Last changed ${formatChanged(rateUpdatedAt)}.` : ""}
              </p>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

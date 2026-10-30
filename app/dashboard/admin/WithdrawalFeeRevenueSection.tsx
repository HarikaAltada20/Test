"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, EyeOff, Percent, Receipt, Wallet } from "lucide-react";
import { CollapsibleAdminSection } from "@/components/admin/CollapsibleAdminSection";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import type { FeeRevenueRow } from "@/app/api/admin/withdrawals/fee-revenue/route";

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  crypto: "Crypto",
  skydo: "Skydo",
  phantom: "Phantom",
};

type Totals = { paidCount: number; paidGrossCents: number; paidFeeCents: number; expectedFeeCents: number; expectedCount: number };

const EMPTY: Totals = { paidCount: 0, paidGrossCents: 0, paidFeeCents: 0, expectedFeeCents: 0, expectedCount: 0 };

function add(a: Totals, b: Totals): Totals {
  return {
    paidCount: a.paidCount + b.paidCount,
    paidGrossCents: a.paidGrossCents + b.paidGrossCents,
    paidFeeCents: a.paidFeeCents + b.paidFeeCents,
    expectedFeeCents: a.expectedFeeCents + b.expectedFeeCents,
    expectedCount: a.expectedCount + b.expectedCount,
  };
}

function sum(rows: Totals[]): Totals {
  return rows.reduce(add, EMPTY);
}

function effectiveRate(t: Totals): string {
  if (t.paidGrossCents <= 0) return "—";
  return `${Number(((t.paidFeeCents / t.paidGrossCents) * 100).toFixed(2))}%`;
}

/**
 * Processing fees from creator and brand withdrawals for a date range.
 * Always starts collapsed and loads nothing until opened, so revenue is never
 * on screen unless an admin opens it.
 */
export function WithdrawalFeeRevenueSection({
  from,
  to,
  periodLabel,
  isDark,
  className,
}: {
  from: Date;
  to: Date;
  periodLabel: string;
  isDark: boolean | null;
  className?: string;
}) {
  return (
    <CollapsibleAdminSection
      title="Withdrawal fee revenue"
      description="Private. Opens on click and is hidden again when you leave the page."
      icon={EyeOff}
      isDark={isDark}
      className={className}
    >
      <FeeRevenueBody from={from} to={to} periodLabel={periodLabel} isDark={isDark} />
    </CollapsibleAdminSection>
  );
}

function FeeRevenueBody({
  from,
  to,
  periodLabel,
  isDark,
}: {
  from: Date;
  to: Date;
  periodLabel: string;
  isDark: boolean | null;
}) {
  const [rows, setRows] = useState<FeeRevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/withdrawals/fee-revenue?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Failed to load fee revenue");
        setRows(json.rows ?? []);
        setError(null);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load fee revenue");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fromIso, toIso]);

  const totals = useMemo(() => sum(rows), [rows]);
  const creators = useMemo(() => sum(rows.filter((r) => r.payerType === "creator")), [rows]);
  const brands = useMemo(() => sum(rows.filter((r) => r.payerType === "brand")), [rows]);
  const byMethod = useMemo(() => {
    const map = new Map<string, { creator: Totals; brand: Totals }>();
    for (const r of rows) {
      const entry = map.get(r.method) ?? { creator: EMPTY, brand: EMPTY };
      entry[r.payerType] = add(entry[r.payerType], r);
      map.set(r.method, entry);
    }
    return [...map.entries()]
      .map(([method, v]) => ({ method, ...v, total: add(v.creator, v.brand) }))
      .filter((m) => m.total.paidCount > 0 || m.total.expectedCount > 0)
      .sort((a, b) => b.total.paidFeeCents - a.total.paidFeeCents);
  }, [rows]);

  const card = cn(
    "rounded-2xl border p-4",
    isDark ? "border-white/10 bg-white/5" : "border-[#ececef] bg-[#fafafa]",
  );
  const muted = isDark ? "text-gray-300" : "text-gray-600";
  const iconWrap = cn(
    "w-10 h-10 flex items-center justify-center rounded-full",
    isDark ? "bg-white/10 text-white" : "bg-[#f3f3f5] text-[#1a1a1a]"
  );

  const tiles = [
    {
      title: "Fees earned",
      value: formatCurrencyFromCents(totals.paidFeeCents),
      subtitle: `Creators ${formatCurrencyFromCents(creators.paidFeeCents)} · Brands ${formatCurrencyFromCents(brands.paidFeeCents)}`,
      icon: Receipt,
    },
    {
      title: "Expected fees",
      value: formatCurrencyFromCents(totals.expectedFeeCents),
      subtitle: `${totals.expectedCount.toLocaleString()} open withdrawals`,
      icon: Clock,
    },
    {
      title: "Paid withdrawals",
      value: totals.paidCount.toLocaleString(),
      subtitle: `${formatCurrencyFromCents(totals.paidGrossCents)} requested in ${periodLabel}`,
      icon: Wallet,
    },
    {
      title: "Average fee",
      value: effectiveRate(totals),
      subtitle: "Fees earned ÷ amount requested",
      icon: Percent,
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-4">
      <p className={cn("text-sm", muted)}>
        Fees from withdrawals paid in {periodLabel}. Expected fees are on withdrawals still pending, in review or
        approved. Rejected or cancelled withdrawals are refunded in full, so they earn nothing.
      </p>

      {error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <div key={tile.title} className={card}>
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium">{tile.title}</h3>
                  <span className={iconWrap}>
                    <tile.icon className="h-5 w-5" aria-hidden />
                  </span>
                </div>
                <div className="mt-2 text-2xl font-bold tabular-nums">{loading ? "…" : tile.value}</div>
                <p className={cn("text-sm mt-2", muted)}>{tile.subtitle}</p>
              </div>
            ))}
          </div>

          <div className={cn(card, "overflow-x-auto p-0")}>
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className={cn("border-b text-left", isDark ? "border-white/10" : "border-gray-100", muted)}>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium text-right">Paid withdrawals</th>
                  <th className="px-5 py-3 font-medium text-right">Amount requested</th>
                  <th className="px-5 py-3 font-medium text-right">Creator fees</th>
                  <th className="px-5 py-3 font-medium text-right">Brand fees</th>
                  <th className="px-5 py-3 font-medium text-right">Fees earned</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className={cn("px-5 py-4", muted)}>
                      Loading…
                    </td>
                  </tr>
                ) : byMethod.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={cn("px-5 py-4", muted)}>
                      No withdrawals in this period.
                    </td>
                  </tr>
                ) : (
                  byMethod.map((m) => (
                    <tr key={m.method} className={cn("border-b last:border-0", isDark ? "border-white/5" : "border-gray-50")}>
                      <td className="px-5 py-3 font-medium">{METHOD_LABELS[m.method] ?? m.method}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{m.total.paidCount.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyFromCents(m.total.paidGrossCents)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyFromCents(m.creator.paidFeeCents)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyFromCents(m.brand.paidFeeCents)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">
                        {formatCurrencyFromCents(m.total.paidFeeCents)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

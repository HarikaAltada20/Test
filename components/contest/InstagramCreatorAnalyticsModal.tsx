"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type {
  InstagramDemographicRow,
  InstagramDemographicsBundle,
  InstagramProfileSnapshot,
} from "@/lib/platform-social-archive";

type Preset = "day" | "7d" | "30d" | "365d" | "overall" | "custom";

/** Instagram Insights–inspired accent (bars / highlights) */
const IG_PINK = "#E1306C";
const IG_PURPLE = "#833AB4";

const METRIC_ORDER = [
  "reach",
  "views",
  "accounts_engaged",
  "likes",
  "comments",
  "saves",
  "shares",
];

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    n
  );
}

function formatMetricValue(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) return formatInt(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    const num = Number(v);
    if (Number.isFinite(num)) return formatInt(num);
  }
  return String(v);
}

function sortMetricKeys(keys: string[]): string[] {
  const rest = keys
    .filter((k) => !METRIC_ORDER.includes(k))
    .sort((a, b) => a.localeCompare(b));
  const ordered = METRIC_ORDER.filter((k) => keys.includes(k));
  return [...ordered, ...rest];
}

/** Meta does not expose a single “engaged views” metric; views vs accounts engaged are separate. */
const METRIC_LABELS: Record<string, string> = {
  reach: "Reach",
  views: "Views (content / plays)",
  accounts_engaged: "Accounts engaged (unique)",
  likes: "Likes",
  comments: "Comments",
  saves: "Saves",
  shares: "Shares",
};

function humanizeMetricKey(k: string): string {
  return METRIC_LABELS[k] ?? k.replace(/_/g, " ");
}

function formatInteractionWindow(
  since?: number,
  until?: number
): string | null {
  if (since == null || until == null) return null;
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const a = new Date(since * 1000).toLocaleString(undefined, opts);
  const b = new Date(until * 1000).toLocaleString(undefined, opts);
  return `${a} → ${b}`;
}

type DemographicDimension = "country" | "age" | "gender";

function rowsWithPercentages(
  rows: InstagramDemographicRow[]
): Array<{ row: InstagramDemographicRow; pct: number }> {
  const total = rows.reduce((s, r) => s + Math.max(0, r.value), 0);
  if (total <= 0) return rows.map((row) => ({ row, pct: 0 }));
  return rows.map((row) => ({
    row,
    pct: (row.value / total) * 100,
  }));
}

/** Prefer ISO country token when Meta sends compound dimension_values. */
function extractIsoCountryToken(label: string): string | null {
  const parts = label
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^[A-Z]{2}$/i.test(p)) return p.toUpperCase();
  }
  const t = label.trim();
  if (/^[A-Z]{2}$/i.test(t)) return t.toUpperCase();
  return null;
}

function expandCountryLabel(label: string): { primary: string; short?: string } {
  const code = extractIsoCountryToken(label);
  if (code) {
    try {
      const full = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
      if (full && full !== code) return { primary: full, short: code };
    } catch {
      /* invalid code for Intl */
    }
    return { primary: code, short: undefined };
  }
  return { primary: label.trim() };
}

const GENDER_EXPAND: Record<string, string> = {
  M: "Male",
  F: "Female",
  U: "Unknown",
  O: "Other",
  m: "Male",
  f: "Female",
  u: "Unknown",
  o: "Other",
  male: "Male",
  female: "Female",
  unknown: "Unknown",
  other: "Other",
};

function expandGenderLabel(label: string): { primary: string; short?: string } {
  const t = label.trim();
  const key = t.length <= 2 ? t : t.toLowerCase();
  const full =
    GENDER_EXPAND[t] ??
    GENDER_EXPAND[t.toUpperCase()] ??
    GENDER_EXPAND[key];
  if (full) {
    const short =
      t.length <= 2 && t.toUpperCase() !== full.toUpperCase() ? t : undefined;
    return { primary: full, short };
  }
  return { primary: t };
}

function expandDemographicLabel(
  raw: string,
  dimension: DemographicDimension
): { primary: string; short?: string } {
  if (dimension === "country") return expandCountryLabel(raw);
  if (dimension === "gender") return expandGenderLabel(raw);
  return { primary: raw.trim() };
}

function SectionHeading({
  title,
  hint,
  isDark,
}: {
  title: string;
  hint: string;
  isDark?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              isDark
                ? "text-slate-500 hover:text-slate-300 focus-visible:ring-[#E1306C]"
                : "text-slate-400 hover:text-slate-600 focus-visible:ring-slate-400"
            )}
            aria-label={hint}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[280px] text-xs leading-snug"
        >
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function DemographicBarList({
  rows,
  dimension,
  isDark,
}: {
  rows: InstagramDemographicRow[];
  dimension: DemographicDimension;
  isDark?: boolean;
}) {
  if (!rows.length) {
    return (
      <p className="text-xs text-muted-foreground py-6 text-center rounded-xl border border-dashed border-white/10">
        No data for this breakdown.
      </p>
    );
  }
  const withPct = rowsWithPercentages(rows);
  return (
    <div className="space-y-3 max-h-[min(320px,50vh)] overflow-y-auto pr-1">
      {withPct.map(({ row, pct }, i) => {
        const barColor = i % 2 === 0 ? IG_PINK : IG_PURPLE;
        const { primary, short } = expandDemographicLabel(row.label, dimension);
        const titleAttr =
          short && short !== primary ? `${primary} (${short})` : primary;
        return (
          <div key={`${row.label}-${i}`} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className={cn(
                  "min-w-0 flex-1 leading-snug",
                  isDark ? "text-slate-200" : "text-slate-800"
                )}
                title={titleAttr}
              >
                <span className="font-semibold">{primary}</span>
                {short ? (
                  <span
                    className={cn(
                      "font-normal ml-1.5 text-[11px]",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}
                  >
                    ({short})
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "tabular-nums shrink-0 font-semibold",
                  isDark ? "text-white" : "text-slate-900"
                )}
              >
                {pct.toFixed(1)}%
              </span>
            </div>
            <div
              className={cn(
                "h-2.5 w-full rounded-full overflow-hidden",
                isDark ? "bg-white/[0.08]" : "bg-slate-200"
              )}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.min(100, Math.max(0, pct))}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <p
              className={cn(
                "text-[10px] tabular-nums text-right",
                isDark ? "text-slate-500" : "text-slate-500"
              )}
            >
              {formatInt(row.value)} accounts
            </p>
          </div>
        );
      })}
    </div>
  );
}

type Dimension = DemographicDimension;
type AudienceTab = "followers" | "engaged";

type BreakdownData = {
  breakdowns?: Array<{
    dimension_keys?: string[];
    results?: Array<{
      dimension_values?: string[];
      value?: number;
    }>;
  }>;
};

function BreakdownBlock({
  data,
  isDark,
}: {
  data: BreakdownData;
  isDark?: boolean;
}) {
  const breakdowns = data.breakdowns ?? [];
  if (!breakdowns.length) {
    return (
      <span className="text-xs text-muted-foreground">No breakdown rows</span>
    );
  }
  return (
    <div
      className={cn(
        "mt-1 rounded-md border text-xs overflow-hidden",
        isDark ? "border-white/15 bg-black/20" : "border-slate-200 bg-white"
      )}
    >
      <table className="w-full">
        <tbody>
          {breakdowns.flatMap((b, bi) =>
            (b.results ?? []).map((r, ri) => (
              <tr
                key={`${bi}-${ri}`}
                className={cn(
                  "border-b last:border-b-0",
                  isDark ? "border-white/10" : "border-slate-100"
                )}
              >
                <td className="p-1.5 pl-2 text-muted-foreground">
                  {(r.dimension_values ?? []).join(" · ") || "—"}
                </td>
                <td className="p-1.5 pr-2 text-right tabular-nums font-medium">
                  {typeof r.value === "number" ? formatInt(r.value) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DemographicsSection({
  bundle,
  isDark,
}: {
  bundle: InstagramDemographicsBundle;
  isDark?: boolean;
}) {
  const tf = bundle.timeframe.replace(/_/g, " ");
  const follower = bundle.follower_demographics ?? {};
  const engaged = bundle.engaged_audience_demographics ?? {};
  const hasFollowerRows = Object.values(follower).some((r) => r && r.length);
  const hasEngagedRows = Object.values(engaged).some((r) => r && r.length);
  const hasRows = hasFollowerRows || hasEngagedRows;

  const [audience, setAudience] = useState<AudienceTab>(() =>
    !hasFollowerRows && hasEngagedRows ? "engaged" : "followers"
  );
  const [dimension, setDimension] = useState<Dimension>("country");

  const currentRows = useMemo(() => {
    const src = audience === "followers" ? follower : engaged;
    return src[dimension] ?? [];
  }, [audience, dimension, follower, engaged]);

  const pillClass = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? isDark
          ? "bg-white/15 text-white shadow-inner"
          : "bg-slate-900 text-white"
        : isDark
          ? "text-slate-400 hover:text-slate-200 border border-white/10"
          : "text-slate-600 hover:text-slate-900 border border-slate-200"
    );

  const dimLabel =
    dimension === "country"
      ? "Country"
      : dimension === "age"
        ? "Age"
        : "Gender";

  return (
    <div
      className={cn(
        "rounded-2xl p-4 space-y-4",
        isDark
          ? "bg-white/[0.04] border border-white/[0.08]"
          : "bg-slate-50/80 border border-slate-200/80"
      )}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <SectionHeading
            title="Audience"
            hint="Estimated follower and engaged-audience breakdown from Meta. Percentages are shares of this breakdown only, not your full follower count."
            isDark={isDark}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Meta window:{" "}
            <span className="font-medium text-foreground/90">{tf}</span>
          </p>
        </div>
      </div>

      {bundle.note && (
        <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-[#E1306C]/50 pl-2">
          {bundle.note}
        </p>
      )}

      {!hasRows && (
        <p className="text-xs text-muted-foreground">
          No demographic rows returned. Meta may require a larger audience or
          additional permissions.
        </p>
      )}

      {hasRows && (
        <>
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider w-full mb-0.5",
                isDark ? "text-slate-500" : "text-slate-500"
              )}
            >
              Audience
            </span>
            {(
              [
                ["followers", "Followers", hasFollowerRows],
                ["engaged", "Engaged", hasEngagedRows],
              ] as const
            ).map(([id, label, enabled]) => (
              <button
                key={id}
                type="button"
                disabled={!enabled}
                onClick={() => setAudience(id)}
                className={cn(
                  pillClass(audience === id),
                  !enabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider w-full mb-0.5",
                isDark ? "text-slate-500" : "text-slate-500"
              )}
            >
              Breakdown
            </span>
            {(["country", "age", "gender"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDimension(d)}
                className={pillClass(dimension === d)}
              >
                {d === "country"
                  ? "Country"
                  : d === "age"
                    ? "Age"
                    : "Gender"}
              </button>
            ))}
          </div>

          <div>
            <p
              className={cn(
                "text-xs font-medium mb-3",
                isDark ? "text-slate-300" : "text-slate-700"
              )}
            >
              {audience === "followers" ? "Followers" : "Engaged audience"} ·{" "}
              {dimLabel}
            </p>
            {hasFollowerRows && !hasEngagedRows && audience === "engaged" && (
              <p className="text-xs text-muted-foreground rounded-lg border border-dashed border-white/15 p-2 mb-3 bg-black/10">
                Meta often omits engaged-audience breakdowns until there is
                enough activity. We retry with a wider window when possible.
              </p>
            )}
            <DemographicBarList
              rows={currentRows}
              dimension={dimension}
              isDark={isDark}
            />
          </div>
        </>
      )}

      {bundle.errors && bundle.errors.length > 0 && (
        <div
          className={cn(
            "rounded-lg border p-2 text-xs space-y-1 max-h-28 overflow-y-auto",
            isDark
              ? "border-amber-500/25 bg-amber-500/[0.07] text-slate-300"
              : "border-amber-200 bg-amber-50 text-slate-700"
          )}
        >
          <p className="font-medium text-amber-600 dark:text-amber-400">
            Partial data — some Meta calls failed:
          </p>
          <ul className="list-disc pl-4 space-y-0.5">
            {bundle.errors.slice(0, 10).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {bundle.errors.length > 10 && (
            <p className="text-muted-foreground">
              +{bundle.errors.length - 10} more…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InteractionMetricsCard({
  metricKeys,
  metrics,
  isDark,
}: {
  metricKeys: string[];
  metrics: Record<string, unknown>;
  isDark?: boolean;
}) {
  const maxNum = useMemo(() => {
    let m = 0;
    for (const k of metricKeys) {
      const v = metrics[k];
      if (typeof v === "number" && Number.isFinite(v)) m = Math.max(m, v);
    }
    return m || 1;
  }, [metricKeys, metrics]);

  return (
    <div
      className={cn(
        "rounded-2xl p-4 space-y-3",
        isDark
          ? "bg-white/[0.04] border border-white/[0.08]"
          : "bg-slate-50/80 border border-slate-200/80"
      )}
    >
      <SectionHeading
        title="Interaction metrics"
        hint="Account-level totals for your selected range (reach, views, engagement). Sub-breakdowns appear where Meta returns them."
        isDark={isDark}
      />
      <div className="space-y-1">
        {metricKeys.map((k) => {
          const v = metrics[k];
          const isBreakdownObj = Boolean(
            v &&
              typeof v === "object" &&
              !Array.isArray(v) &&
              "breakdowns" in (v as object)
          );
          const isNum = typeof v === "number" && Number.isFinite(v);
          const barPct = isNum ? (v / maxNum) * 100 : 0;

          return (
            <div
              key={k}
              className={cn(
                "rounded-xl px-3 py-2.5",
                isDark ? "bg-black/25" : "bg-white/90"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "text-xs font-medium leading-snug flex-1 min-w-0",
                    isDark ? "text-slate-300" : "text-slate-700"
                  )}
                >
                  {humanizeMetricKey(k)}
                </span>
                {!isBreakdownObj && isNum && (
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums shrink-0",
                      isDark ? "text-white" : "text-slate-900"
                    )}
                  >
                    {formatInt(v)}
                  </span>
                )}
                {!isBreakdownObj && !isNum && (
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums shrink-0 text-right max-w-[50%] break-all",
                      isDark ? "text-slate-200" : "text-slate-800"
                    )}
                  >
                    {formatMetricValue(v)}
                  </span>
                )}
              </div>
              {isNum && (
                <div
                  className={cn(
                    "mt-2 h-2 w-full rounded-full overflow-hidden",
                    isDark ? "bg-white/[0.07]" : "bg-slate-200"
                  )}
                >
                  <div
                    className="h-full rounded-full opacity-90"
                    style={{
                      width: `${barPct}%`,
                      background: `linear-gradient(90deg, ${IG_PINK}, ${IG_PURPLE})`,
                    }}
                  />
                </div>
              )}
              {isBreakdownObj && (
                <div className="mt-2">
                  <BreakdownBlock
                    data={v as BreakdownData}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileSection({
  profile,
  isDark,
}: {
  profile: InstagramProfileSnapshot;
  isDark?: boolean;
}) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  if (profile.username) {
    const un = profile.username;
    rows.push({
      label: "Instagram",
      value: (
        <a
          href={`https://www.instagram.com/${encodeURIComponent(un)}/`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center justify-end gap-1.5 font-medium hover:underline",
            isDark ? "text-purple-300" : "text-[#4A00BE]"
          )}
        >
          @{un}
          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        </a>
      ),
    });
  }
  if (profile.name_of_account)
    rows.push({ label: "Name", value: profile.name_of_account });
  if (profile.account_type)
    rows.push({ label: "Account type", value: profile.account_type });
  if (typeof profile.followers_count === "number")
    rows.push({
      label: "Followers (live total)",
      value: formatInt(profile.followers_count),
    });
  if (typeof profile.follows_count === "number")
    rows.push({ label: "Following", value: formatInt(profile.follows_count) });
  if (typeof profile.media_count === "number")
    rows.push({ label: "Media", value: formatInt(profile.media_count) });

  if (!rows.length) return null;

  return (
    <div
      className={cn(
        "space-y-2 rounded-2xl p-4",
        isDark
          ? "bg-white/[0.04] border border-white/[0.08]"
          : "bg-slate-50/80 border border-slate-200/80"
      )}
    >
      <SectionHeading
        title="Profile"
        hint="Live fields from the connected Instagram account. Follower count is the headline total; audience breakdowns below use different Meta models."
        isDark={isDark}
      />
      <p className="text-xs text-muted-foreground">
        “Followers” here is the current count from Instagram. Audience charts
        below are separate estimates per bucket and won’t add up to this
        number.
      </p>
      <div
        className={cn(
          "rounded-xl border overflow-hidden",
          isDark ? "border-white/10" : "border-slate-200"
        )}
      >
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className={cn(
                  "border-b last:border-b-0",
                  isDark
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-slate-100 bg-slate-50/50"
                )}
              >
                <td className="p-2 font-medium text-muted-foreground w-[40%]">
                  {r.label}
                </td>
                <td className="p-2 text-right tabular-nums [&_a]:tabular-nums">
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type InstagramCreatorAnalyticsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  creatorId: string;
  creatorLabel: string;
  isDark?: boolean;
  /** Called after each fetch completes (including initial open) so parents can clear button loaders. */
  onFetchComplete?: () => void;
};

export function InstagramCreatorAnalyticsModal({
  open,
  onOpenChange,
  contestId,
  creatorId,
  creatorLabel,
  isDark,
  onFetchComplete,
}: InstagramCreatorAnalyticsModalProps) {
  const onFetchCompleteRef = useRef(onFetchComplete);
  onFetchCompleteRef.current = onFetchComplete;

  const [preset, setPreset] = useState<Preset>("overall");
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPreset("overall");
      setCustomSince("");
      setCustomUntil("");
      setProfileSummary(null);
    }
    onOpenChange(next);
  };
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [entry, setEntry] = useState<{
    fetched_at?: string;
    since?: number;
    until?: number;
    metrics?: Record<string, unknown>;
    error?: string;
    preset?: string;
    demographics?: InstagramDemographicsBundle;
    profile?: InstagramProfileSnapshot;
  } | null>(null);
  const [profileSummary, setProfileSummary] =
    useState<InstagramProfileSnapshot | null>(null);
  const [source, setSource] = useState<"cache" | "network" | null>(null);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      setLoading(true);
      try {
        const body: Record<string, unknown> = {
          preset: preset === "custom" ? "custom" : preset,
          forceRefresh,
        };
        if (preset === "custom" && customSince && customUntil) {
          const s = Math.floor(new Date(customSince).getTime() / 1000);
          const u = Math.floor(new Date(customUntil).getTime() / 1000);
          body.since = s;
          body.until = u;
        }
        const res = await fetch(
          `/api/admin/contests/${contestId}/creators/${creatorId}/instagram-account-analytics`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEntry({
            error: data.error || `Request failed (${res.status})`,
            metrics: {},
          });
          setProfileSummary(null);
          setSource(null);
          return;
        }
        setEntry(data.entry ?? null);
        setProfileSummary(data.profileSummary ?? null);
        setSource(data.source ?? null);
      } finally {
        setLoading(false);
        onFetchCompleteRef.current?.();
      }
    },
    [contestId, creatorId, preset, customSince, customUntil]
  );

  useEffect(() => {
    if (!open) return;
    if (preset === "custom") return;
    setEntry(null);
    setSource(null);
    setProfileSummary(null);
    load(false);
  }, [open, preset, contestId, creatorId, load]);

  const presets: { id: Preset; label: string }[] = [
    { id: "day", label: "24h" },
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    { id: "365d", label: "365d" },
    { id: "overall", label: "Overall (max ~90d)" },
    { id: "custom", label: "Custom" },
  ];

  const displayProfile = entry?.profile ?? profileSummary;
  const metricKeys = entry?.metrics ? sortMetricKeys(Object.keys(entry.metrics)) : [];
  const hasMetrics = metricKeys.length > 0;

  return (
    <TooltipProvider delayDuration={250}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={cn(
            "max-w-2xl max-h-[90vh] overflow-y-auto gap-0",
            isDark
              ? "bg-[#050505] border-white/10 text-white shadow-2xl shadow-black/50"
              : ""
          )}
        >
          <DialogHeader className="pb-2">
            <DialogTitle
              className={cn(
                "text-lg font-bold tracking-tight",
                isDark && "text-white"
              )}
            >
              Instagram insights
            </DialogTitle>
            <DialogDescription
              className={cn(isDark ? "text-slate-400" : "", "text-xs")}
            >
              Creator: {creatorLabel}
              <span className="block mt-1.5 leading-relaxed">
                Admin-only. Cached per range — use{" "}
                <span className="font-medium text-foreground/80">
                  Refresh from Meta
                </span>{" "}
                for the latest numbers (including audience).
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={preset === p.id ? "default" : "outline"}
                className={cn(
                  "rounded-full h-8",
                  preset === p.id &&
                    "bg-[#4A00BE] hover:bg-[#4A00BE]/90 text-white border-0",
                  isDark &&
                    preset !== p.id &&
                    "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                )}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={customSince}
                  onChange={(e) => setCustomSince(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={customUntil}
                  onChange={(e) => setCustomUntil(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="col-span-2"
                variant="secondary"
                size="sm"
                disabled={!customSince || !customUntil || loading}
                onClick={() => load(false)}
              >
                Apply range
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && source && (
            <p className="text-xs text-muted-foreground">
              Source: {source === "cache" ? "Cached (DB)" : "Live (Meta API)"}
              {entry?.fetched_at && (
                <span className="ml-2">
                  · Fetched {new Date(entry.fetched_at).toLocaleString()}
                </span>
              )}
            </p>
          )}

          {entry?.error && (
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                isDark
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              {entry.error}
            </div>
          )}

          {displayProfile && (
            <>
              <ProfileSection profile={displayProfile} isDark={isDark} />
              <Separator className={isDark ? "bg-white/10" : ""} />
            </>
          )}

          {hasMetrics && entry?.metrics && (
            <div className="space-y-2">
              {formatInteractionWindow(entry?.since, entry?.until) && (
                <p className="text-xs text-muted-foreground px-1">
                  Selected window:{" "}
                  <span className="font-medium text-foreground/90">
                    {formatInteractionWindow(entry?.since, entry?.until)}
                  </span>
                </p>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                There is no separate “engaged views” line in Meta’s API — use{" "}
                <span className="font-medium text-foreground/85">Views</span>{" "}
                and{" "}
                <span className="font-medium text-foreground/85">
                  Accounts engaged
                </span>
                . Bars compare metrics relative to the largest value in this
                list.
              </p>
              <InteractionMetricsCard
                metricKeys={metricKeys}
                metrics={entry.metrics}
                isDark={isDark}
              />
            </div>
          )}

          {entry?.demographics && (
            <>
              <Separator className={isDark ? "bg-white/10" : ""} />
              <DemographicsSection
                bundle={entry.demographics}
                isDark={isDark}
              />
            </>
          )}

          {!loading &&
            !entry?.error &&
            entry &&
            !hasMetrics &&
            !entry?.demographics && (
              <p className="text-sm text-muted-foreground">
                No metric values returned for this window (Meta may return empty
                data for small accounts or delayed processing). Try Refresh from
                Meta or pick another range.
              </p>
            )}
        </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              className={cn(isDark && "border-white/15 bg-white/5 hover:bg-white/10")}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className={cn(
                "gap-2 rounded-full",
                "bg-[#4A00BE] hover:bg-[#4A00BE]/90 text-white"
              )}
              disabled={
                loading ||
                (preset === "custom" && (!customSince || !customUntil))
              }
              onClick={() => load(true)}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh from Meta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

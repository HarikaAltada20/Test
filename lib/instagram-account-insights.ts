/**
 * Instagram user (account) insights via graph.instagram.com — complements per-media insights in lib/instagram-insights.ts
 * @see https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
 */

import { classifyInsightsError } from "@/lib/instagram-insights";
import type {
  InstagramDemographicRow,
  InstagramDemographicsBundle,
} from "@/lib/platform-social-archive";

const GRAPH_IG = "https://graph.instagram.com";

const DEMOGRAPHIC_TIMEFRAME_TOKENS = new Set([
  "LAST_7_DAYS",
  "LAST_14_DAYS",
  "LAST_30_DAYS",
  "LAST_90_DAYS",
  "LAST_365_DAYS",
  "PREV_MONTH",
  "THIS_MONTH",
  "THIS_WEEK",
]);

/** Meta often retains ~90 days of user-level insights; cap "overall" / long presets. */
export const MAX_ACCOUNT_INSIGHTS_RANGE_SECONDS = 90 * 24 * 60 * 60;

export type AccountInsightsPreset =
  | "day"
  | "7d"
  | "30d"
  | "365d"
  | "overall"
  | "custom";

const ACCOUNT_INSIGHTS_PRESET_SET = new Set<string>([
  "day",
  "7d",
  "30d",
  "365d",
  "overall",
  "custom",
]);

/** Normalize API/query input to a supported preset (invalid values → fallback). */
export function normalizeAccountInsightsPreset(
  raw: unknown,
  fallback: AccountInsightsPreset = "overall"
): AccountInsightsPreset {
  if (typeof raw === "string" && ACCOUNT_INSIGHTS_PRESET_SET.has(raw)) {
    return raw as AccountInsightsPreset;
  }
  return fallback;
}

/**
 * Meta IG user demographics `timeframe` values (Graph API).
 * @see https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
 */
export type DemographicsTimeframe =
  | "last_14_days"
  | "last_30_days"
  | "last_90_days"
  | "this_week"
  | "this_month"
  | "prev_month";

const META_DEMOGRAPHICS_TIMEFRAMES = new Set<string>([
  "last_14_days",
  "last_30_days",
  "last_90_days",
  "this_week",
  "this_month",
  "prev_month",
]);

const DEMOGRAPHICS_TIMEFRAME_FALLBACKS: DemographicsTimeframe[] = [
  "last_90_days",
  "last_30_days",
  "last_14_days",
];

/** Normalize stored or legacy timeframe strings to a Meta-supported value. */
export function normalizeDemographicsTimeframe(
  raw: string | undefined,
  fallback: DemographicsTimeframe = "last_30_days"
): DemographicsTimeframe {
  if (raw && META_DEMOGRAPHICS_TIMEFRAMES.has(raw)) {
    return raw as DemographicsTimeframe;
  }
  if (raw === "last_7_days") return "last_14_days";
  return fallback;
}

export function demographicsBundleHasRows(
  bundle: InstagramDemographicsBundle | undefined
): boolean {
  if (!bundle) return false;
  const hasIn = (
    m:
      | InstagramDemographicsBundle["follower_demographics"]
      | InstagramDemographicsBundle["engaged_audience_demographics"]
  ) =>
    !!m &&
    (["country", "age", "gender"] as const).some(
      (k) => (m[k]?.length ?? 0) > 0
    );
  return (
    hasIn(bundle.follower_demographics) ||
    hasIn(bundle.engaged_audience_demographics)
  );
}

export function isDemographicsTimeframeApiError(
  message: string | undefined,
): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("timeframe must be one of") ||
    m.includes("must be one of the following values")
  );
}

/** Hide legacy/invalid Meta timeframe errors in UI and exports; keep real failures. */
export function filterDemographicsErrorsForDisplay(
  bundle: InstagramDemographicsBundle,
): string[] {
  const raw = bundle.errors ?? [];
  if (!raw.length) return [];

  const hasRows = demographicsBundleHasRows(bundle);
  const meaningful = raw.filter((e) => !isDemographicsTimeframeApiError(e));

  if (meaningful.length > 0) {
    return meaningful.slice(0, 10);
  }

  if (hasRows) {
    return [];
  }

  if (raw.some(isDemographicsTimeframeApiError)) {
    return [
      "Audience demographics use Meta rolling windows only (last 14, 30, or 90 days—not the same as 24h/7d interaction ranges). Refresh from Meta to reload this preset.",
    ];
  }

  return raw.slice(0, 5);
}

/**
 * Maps the interaction-metrics preset to the closest Meta-supported demographics timeframe.
 */
export function demographicsTimeframeForPreset(
  preset: AccountInsightsPreset,
  customSince?: number,
  customUntil?: number
): DemographicsTimeframe {
  if (preset === "custom" && customSince != null && customUntil != null) {
    const spanSec = Math.abs(customUntil - customSince);
    const days = spanSec / (24 * 60 * 60);
    if (days <= 14) return "last_14_days";
    if (days <= 30) return "last_30_days";
    return "last_90_days";
  }
  switch (preset) {
    case "day":
    case "7d":
      return "last_14_days";
    case "30d":
      return "last_30_days";
    case "365d":
    case "overall":
      return "last_90_days";
    default:
      return "last_30_days";
  }
}

export function computeSinceUntilForPreset(
  preset: AccountInsightsPreset,
  nowSec: number = Math.floor(Date.now() / 1000),
  customSince?: number,
  customUntil?: number
): { since: number; until: number; entryKey: string } {
  const until = nowSec;
  if (preset === "custom") {
    const s = customSince ?? until - 24 * 60 * 60;
    const u = customUntil ?? until;
    return {
      since: Math.min(s, u),
      until: Math.max(s, u),
      entryKey: `custom:${Math.min(s, u)}:${Math.max(s, u)}`,
    };
  }
  let secondsBack: number;
  switch (preset) {
    case "day":
      secondsBack = 24 * 60 * 60;
      break;
    case "7d":
      secondsBack = 7 * 24 * 60 * 60;
      break;
    case "30d":
      secondsBack = 30 * 24 * 60 * 60;
      break;
    case "365d":
      secondsBack = 365 * 24 * 60 * 60;
      break;
    case "overall":
    default:
      secondsBack = MAX_ACCOUNT_INSIGHTS_RANGE_SECONDS;
      break;
  }
  const capped = Math.min(secondsBack, MAX_ACCOUNT_INSIGHTS_RANGE_SECONDS);
  return {
    since: until - capped,
    until,
    entryKey: preset,
  };
}

interface IgUserInsightMetric {
  name: string;
  period?: string;
  title?: string;
  total_value?: {
    value?: number;
    breakdowns?: Array<{
      dimension_keys?: string[];
      results?: Array<{
        dimension_values?: string[];
        value?: number;
      }>;
    }>;
  };
  values?: Array<{ value?: number; end_time?: string }>;
}

interface IgUserInsightsResponse {
  data?: IgUserInsightMetric[];
  error?: { message?: string; code?: number; error_subcode?: number };
}

/** Metrics for period=day + metric_type=total_value (interaction metrics). */
const USER_INSIGHT_METRICS =
  "reach,views,accounts_engaged,likes,comments,saves,shares";

export type FetchUserAccountInsightsResult =
  | {
      kind: "success";
      metrics: Record<string, unknown>;
      raw: IgUserInsightsResponse;
    }
  | {
      kind: "error";
      message?: string;
      code?: number;
      classification: "account_token" | "temporary";
    };

/**
 * Fetch Instagram professional account insights for a time range.
 * Uses app-scoped user id (IG user id) as required by the Graph API.
 */
export async function fetchUserAccountInsights(
  igUserId: string,
  accessToken: string,
  since: number,
  until: number
): Promise<FetchUserAccountInsightsResult> {
  const params = new URLSearchParams({
    metric: USER_INSIGHT_METRICS,
    period: "day",
    metric_type: "total_value",
    since: String(since),
    until: String(until),
    access_token: accessToken,
  });
  const tryUrls = [
    `${GRAPH_IG}/${encodeURIComponent(igUserId)}/insights?${params.toString()}`,
    `${GRAPH_IG}/${encodeURIComponent(igUserId)}/insights?${new URLSearchParams({
      metric: "reach,views,accounts_engaged",
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(until),
      access_token: accessToken,
    }).toString()}`,
  ];

  try {
    let response: Response | null = null;
    let body: IgUserInsightsResponse = {};

    for (const url of tryUrls) {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      body = (await response.json()) as IgUserInsightsResponse;
      if (response.ok && !body.error) break;
    }

    if (!response) {
      return {
        kind: "error",
        message: "No response",
        classification: "temporary",
      };
    }

    if (!response.ok || body.error) {
      const code = body.error?.code ?? response.status;
      const sub = body.error?.error_subcode;
      const classification = classifyInsightsError(code, sub);
      return {
        kind: "error",
        message: body.error?.message,
        code,
        classification:
          classification === "account_token" ? "account_token" : "temporary",
      };
    }

    const metrics: Record<string, unknown> = {};
    for (const m of body.data ?? []) {
      if (m.total_value && typeof m.total_value.value === "number") {
        metrics[m.name] = m.total_value.value;
      } else if (m.total_value?.breakdowns?.length) {
        metrics[m.name] = {
          breakdowns: m.total_value.breakdowns,
        };
      } else if (m.values?.length) {
        const sum = m.values.reduce(
          (acc, v) => acc + (typeof v.value === "number" ? v.value : 0),
          0
        );
        metrics[m.name] = sum;
      }
    }

    return { kind: "success", metrics, raw: body };
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
      classification: "temporary",
    };
  }
}

function dimensionLabel(dims: string[]): string {
  const cleaned = dims.filter(
    (d) => !DEMOGRAPHIC_TIMEFRAME_TOKENS.has(d.toUpperCase())
  );
  return (cleaned.length ? cleaned : dims).join(" · ") || "—";
}

function parseDemographicRowsFromInsightsBody(
  body: IgUserInsightsResponse
): InstagramDemographicRow[] {
  const rows: InstagramDemographicRow[] = [];
  const metric = body.data?.[0];
  const breakdowns = metric?.total_value?.breakdowns ?? [];
  for (const b of breakdowns) {
    for (const r of b.results ?? []) {
      const dims = r.dimension_values ?? [];
      if (typeof r.value === "number") {
        rows.push({
          label: dimensionLabel(dims),
          value: r.value,
        });
      }
    }
  }
  return rows.sort((a, b) => b.value - a.value).slice(0, 50);
}

const DEMOGRAPHICS_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

type FollowerDemoMap = NonNullable<
  InstagramDemographicsBundle["follower_demographics"]
>;
type EngagedDemoMap = NonNullable<
  InstagramDemographicsBundle["engaged_audience_demographics"]
>;

function engagedAudienceHasAnyRows(
  engaged: InstagramDemographicsBundle["engaged_audience_demographics"]
): boolean {
  if (!engaged) return false;
  return ["country", "age", "gender"].some((k) => {
    const rows = engaged[k as "country" | "age" | "gender"];
    return rows && rows.length > 0;
  });
}

async function fetchDemographicBreakdown(
  igUserId: string,
  accessToken: string,
  metric: "follower_demographics" | "engaged_audience_demographics",
  breakdown: "country" | "age" | "gender",
  preferredTimeframe: DemographicsTimeframe
): Promise<{
  rows: InstagramDemographicRow[];
  usedTimeframe: DemographicsTimeframe;
  error?: string;
}> {
  const tryOrder: DemographicsTimeframe[] = [
    preferredTimeframe,
    ...DEMOGRAPHICS_TIMEFRAME_FALLBACKS.filter((t) => t !== preferredTimeframe),
  ];
  let lastMessage: string | undefined;

  for (const timeframe of tryOrder) {
    const params = new URLSearchParams({
      metric,
      period: "lifetime",
      timeframe,
      metric_type: "total_value",
      breakdown,
      access_token: accessToken,
    });
    const url = `${GRAPH_IG}/${encodeURIComponent(igUserId)}/insights?${params.toString()}`;
    const res = await fetch(url, { headers: DEMOGRAPHICS_FETCH_HEADERS });
    const body = (await res.json()) as IgUserInsightsResponse;
    if (res.ok && !body.error) {
      return {
        rows: parseDemographicRowsFromInsightsBody(body),
        usedTimeframe: timeframe,
      };
    }
    lastMessage = body.error?.message ?? String(res.status);
    if (!isDemographicsTimeframeApiError(lastMessage)) {
      break;
    }
  }

  return {
    rows: [],
    usedTimeframe: preferredTimeframe,
    error: `${metric} (${breakdown}): ${lastMessage ?? "request failed"}`,
  };
}

async function runEngagedAudienceOnly(
  igUserId: string,
  accessToken: string,
  timeframe: DemographicsTimeframe
): Promise<{
  engaged: EngagedDemoMap;
  errors: string[];
}> {
  const errors: string[] = [];
  const engaged: EngagedDemoMap = {};

  const run = async (breakdown: "country" | "age" | "gender") => {
    const result = await fetchDemographicBreakdown(
      igUserId,
      accessToken,
      "engaged_audience_demographics",
      breakdown,
      timeframe
    );
    if (result.error && result.rows.length === 0) {
      errors.push(result.error);
      return;
    }
    engaged[breakdown] = result.rows;
  };

  await Promise.all([run("country"), run("age"), run("gender")]);

  return { engaged, errors };
}

/**
 * Follower + engaged-audience demographics (lifetime + timeframe).
 * If engaged-audience rows are empty with the selected window, retries engaged-only with last_90_days once.
 */
export async function fetchAccountDemographics(
  igUserId: string,
  accessToken: string,
  timeframe: DemographicsTimeframe = "last_30_days"
): Promise<InstagramDemographicsBundle> {
  const preferredTf = normalizeDemographicsTimeframe(timeframe);
  const errors: string[] = [];
  const follower: FollowerDemoMap = {};
  let engaged: EngagedDemoMap = {};
  let usedTimeframe = preferredTf;

  const run = async (
    metric: "follower_demographics" | "engaged_audience_demographics",
    breakdown: "country" | "age" | "gender"
  ) => {
    const result = await fetchDemographicBreakdown(
      igUserId,
      accessToken,
      metric,
      breakdown,
      preferredTf
    );
    if (result.usedTimeframe !== preferredTf) {
      usedTimeframe = result.usedTimeframe;
    }
    if (result.error && result.rows.length === 0) {
      errors.push(result.error);
      return;
    }
    if (metric === "follower_demographics") {
      follower[breakdown] = result.rows;
    } else {
      engaged[breakdown] = result.rows;
    }
  };

  await Promise.all([
    run("follower_demographics", "country"),
    run("follower_demographics", "age"),
    run("follower_demographics", "gender"),
    run("engaged_audience_demographics", "country"),
    run("engaged_audience_demographics", "age"),
    run("engaged_audience_demographics", "gender"),
  ]);

  let engagedRetryNote: string | undefined;
  if (
    !engagedAudienceHasAnyRows(engaged) &&
    usedTimeframe !== "last_90_days"
  ) {
    const retry = await runEngagedAudienceOnly(
      igUserId,
      accessToken,
      "last_90_days"
    );
    if (engagedAudienceHasAnyRows(retry.engaged)) {
      engaged = retry.engaged;
      errors.push(
        ...retry.errors.map((e) => `[engaged retry 90d] ${e}`)
      );
      engagedRetryNote =
        "Engaged audience had no data for the selected demographic window; filled using last 90 days instead.";
    } else {
      errors.push(
        ...retry.errors.map((e) => `[engaged retry 90d] ${e}`)
      );
    }
  }

  const tfLabel = usedTimeframe.replace(/_/g, " ");
  const requestedLabel = preferredTf.replace(/_/g, " ");

  const bundleForFilter: InstagramDemographicsBundle = {
    timeframe: usedTimeframe,
    follower_demographics: follower,
    engaged_audience_demographics: engaged,
    errors,
  };
  const displayErrors = filterDemographicsErrorsForDisplay(bundleForFilter);

  return {
    timeframe: usedTimeframe,
    follower_demographics: follower,
    engaged_audience_demographics: engaged,
    errors: displayErrors,
    note: [
      usedTimeframe !== preferredTf
        ? `Demographics use Meta’s “${tfLabel}” window (requested “${requestedLabel}” is not supported for all breakdowns).`
        : `Demographics use Meta’s rolling window “${tfLabel}” (closest match to your preset).`,
      "They are not the same dates as interaction metrics above.",
      "Bucket counts are estimates; rows in a column won’t sum to your profile follower total, and engaged-audience may stay empty until Meta has enough activity in that window.",
      engagedRetryNote,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

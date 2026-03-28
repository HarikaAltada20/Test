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

/** Meta demographic insights only support these rolling windows (not arbitrary ranges). */
export type DemographicsTimeframe =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days";

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
    if (days <= 7) return "last_7_days";
    if (days <= 30) return "last_30_days";
    return "last_90_days";
  }
  switch (preset) {
    case "day":
    case "7d":
      return "last_7_days";
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

function engagedAudienceHasAnyRows(
  engaged: InstagramDemographicsBundle["engaged_audience_demographics"]
): boolean {
  if (!engaged) return false;
  return ["country", "age", "gender"].some((k) => {
    const rows = engaged[k as "country" | "age" | "gender"];
    return rows && rows.length > 0;
  });
}

async function runEngagedAudienceOnly(
  igUserId: string,
  accessToken: string,
  timeframe: DemographicsTimeframe
): Promise<{
  engaged: InstagramDemographicsBundle["engaged_audience_demographics"];
  errors: string[];
}> {
  const errors: string[] = [];
  const engaged: InstagramDemographicsBundle["engaged_audience_demographics"] =
    {};

  const run = async (breakdown: "country" | "age" | "gender") => {
    const params = new URLSearchParams({
      metric: "engaged_audience_demographics",
      period: "lifetime",
      timeframe,
      metric_type: "total_value",
      breakdown,
      access_token: accessToken,
    });
    const url = `${GRAPH_IG}/${encodeURIComponent(igUserId)}/insights?${params.toString()}`;
    const res = await fetch(url, { headers: DEMOGRAPHICS_FETCH_HEADERS });
    const body = (await res.json()) as IgUserInsightsResponse;
    if (!res.ok || body.error) {
      errors.push(
        `engaged_audience_demographics (${breakdown}): ${body.error?.message ?? String(res.status)}`
      );
      return;
    }
    engaged[breakdown] = parseDemographicRowsFromInsightsBody(body);
  };

  await Promise.all([
    run("country"),
    run("age"),
    run("gender"),
  ]);

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
  const errors: string[] = [];
  const follower: InstagramDemographicsBundle["follower_demographics"] = {};
  let engaged: InstagramDemographicsBundle["engaged_audience_demographics"] =
    {};

  const run = async (
    metric: "follower_demographics" | "engaged_audience_demographics",
    breakdown: "country" | "age" | "gender"
  ) => {
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
    if (!res.ok || body.error) {
      errors.push(
        `${metric} (${breakdown}): ${body.error?.message ?? String(res.status)}`
      );
      return;
    }
    const rows = parseDemographicRowsFromInsightsBody(body);
    if (metric === "follower_demographics") {
      follower[breakdown] = rows;
    } else {
      engaged[breakdown] = rows;
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
    timeframe !== "last_90_days"
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

  const tfLabel = timeframe.replace(/_/g, " ");

  return {
    timeframe,
    follower_demographics: follower,
    engaged_audience_demographics: engaged,
    errors,
    note: [
      `Demographics use Meta’s rolling window “${tfLabel}” (closest match to your preset).`,
      "They are not the same dates as interaction metrics above.",
      "Bucket counts are estimates; rows in a column won’t sum to your profile follower total, and engaged-audience may stay empty until Meta has enough activity in that window.",
      engagedRetryNote,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export type CompetitionPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all_time";

export type SubmissionScope = "pending" | "verified" | "all";

const IST_OFFSET_MINUTES = 330;

type CreatorMetrics = {
  creatorId: string;
  username: string;
  fullName: string | null;
  profilePictureUrl: string | null;
  pendingViews: number;
  verifiedViews: number;
  pendingReels: number;
  verifiedReels: number;
  totalViews: number;
  totalReels: number;
};

type CreatorMetricsRpcRow = {
  creator_id: string | null;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
  pending_views: number | string | null;
  verified_views: number | string | null;
  pending_reels: number | string | null;
  verified_reels: number | string | null;
  total_views: number | string | null;
  total_reels: number | string | null;
};

type EligibilityConfig = {
  eventId: string;
  viewsMinViews: number;
  reelsMinReels: number;
  reelsMinViews: number;
  minViewsPerReel: number;
  promoteNextEligible: boolean;
};

type SnapshotOptions = {
  reason?: string;
  allowOverwrite?: boolean;
  useAdminClient?: boolean;
  period?: CompetitionPeriod;
};

type DataClientMode = "session" | "admin";

async function getDataClient(mode: DataClientMode = "session") {
  if (mode === "admin") {
    return createAdminClient();
  }
  return createClient();
}

function toIstDateParts(date: Date) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function makeUtcFromIstParts(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const utcMs =
    Date.UTC(year, month, day, hour, minute, second) -
    IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}

function startOfIstDay(date: Date) {
  const { year, month, day } = toIstDateParts(date);
  return makeUtcFromIstParts(year, month, day, 0, 0, 0);
}

function addIstDays(date: Date, delta: number) {
  const { year, month, day } = toIstDateParts(date);
  return makeUtcFromIstParts(year, month, day + delta, 0, 0, 0);
}

function getIstWeekStart(date: Date) {
  const startDay = startOfIstDay(date);
  const shifted = new Date(startDay.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const day = shifted.getUTCDay(); // 0 Sunday
  const mondayDiff = day === 0 ? -6 : 1 - day;
  return addIstDays(startDay, mondayDiff);
}

function isCurrentPeriod(period: CompetitionPeriod) {
  return period === "today" || period === "this_week" || period === "this_month";
}

function getSnapshotPeriod(period: CompetitionPeriod): "day" | "week" | "month" {
  if (period === "this_week" || period === "last_week") return "week";
  if (period === "this_month" || period === "last_month") return "month";
  return "day";
}

/** Prize tier used for leaderboard copy and locks (day / week / month window). */
export function getPrizeTierForCompetitionPeriod(period: CompetitionPeriod): "day" | "week" | "month" {
  return getSnapshotPeriod(period);
}

type EventPrizeRow = {
  prize_amount_minor_units?: number | string | null;
  weekly_prize_minor_units?: number | string | null;
  monthly_prize_minor_units?: number | string | null;
};

export function prizeMinorUnitsForTier(
  row: EventPrizeRow,
  tier: "day" | "week" | "month",
): number {
  const daily = Math.round(Number(row.prize_amount_minor_units ?? 5000));
  if (tier === "week") return Math.round(Number(row.weekly_prize_minor_units ?? daily));
  if (tier === "month") return Math.round(Number(row.monthly_prize_minor_units ?? daily));
  return daily;
}

function buildLeaderboardEventPayload(
  event: {
    id: string;
    name: string | null;
    starts_at: string | null;
    ends_at: string | null;
    timezone: string | null;
    prize_amount_minor_units?: number | string | null;
    weekly_prize_minor_units?: number | string | null;
    monthly_prize_minor_units?: number | string | null;
    prize_currency?: string | null;
  },
  period: CompetitionPeriod,
) {
  const currency = String(event.prize_currency || "INR");
  const tier = getPrizeTierForCompetitionPeriod(period);
  return {
    id: event.id,
    name: event.name,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    prizeAmountMinorUnits: prizeMinorUnitsForTier(event, "day"),
    weeklyPrizeMinorUnits: prizeMinorUnitsForTier(event, "week"),
    monthlyPrizeMinorUnits: prizeMinorUnitsForTier(event, "month"),
    effectivePrizeMinorUnits: prizeMinorUnitsForTier(event, tier),
    prizeCurrency: currency,
  };
}

/** True when the competition_event row select includes prize columns (for snapshot prize fields). */
function snapshotPrizeFieldsFromPayloadEvent(
  ev: ReturnType<typeof buildLeaderboardEventPayload> | null,
  snapshotTier: "day" | "week" | "month",
): { prize_minor_units: number; prize_currency: string } {
  const row: EventPrizeRow = {
    prize_amount_minor_units: ev?.prizeAmountMinorUnits,
    weekly_prize_minor_units: ev?.weeklyPrizeMinorUnits,
    monthly_prize_minor_units: ev?.monthlyPrizeMinorUnits,
  };
  return {
    prize_minor_units: prizeMinorUnitsForTier(row, snapshotTier),
    prize_currency: String(ev?.prizeCurrency || "INR"),
  };
}

/** For cron: IST calendar day-of-month === 1 (e.g. right after IST month rollover when scheduled ~00:xx IST). */
export function isIstFirstCalendarDay(now = new Date()) {
  return toIstDateParts(now).day === 1;
}

function toIstDateKey(date: Date) {
  const p = toIstDateParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function clampRangeToEvent(
  range: { start: Date; end: Date } | null,
  event?: { starts_at?: string | null; ends_at?: string | null } | null,
) {
  const eventStart = event?.starts_at ? new Date(event.starts_at) : null;
  const eventEnd = event?.ends_at ? new Date(event.ends_at) : null;
  if (!range) {
    if (!eventStart || !eventEnd) return null;
    return { start: eventStart, end: eventEnd };
  }
  const start = eventStart && eventStart > range.start ? eventStart : range.start;
  const end = eventEnd && eventEnd < range.end ? eventEnd : range.end;
  if (end.getTime() <= start.getTime()) return null;
  return { start, end };
}

export function getPeriodRange(period: CompetitionPeriod, now = new Date()) {
  if (period === "all_time") return null;
  const todayStart = startOfIstDay(now);
  const tomorrowStart = addIstDays(todayStart, 1);

  if (period === "today") return { start: todayStart, end: tomorrowStart };
  if (period === "yesterday") {
    const start = addIstDays(todayStart, -1);
    return { start, end: todayStart };
  }

  if (period === "this_week") {
    const start = getIstWeekStart(now);
    /** Exclusive end = start of the following Monday (IST), so the window is 7 full calendar days by IST. */
    const end = addIstDays(start, 7);
    return { start, end };
  }

  if (period === "last_week") {
    const thisWeekStart = getIstWeekStart(now);
    const lastWeekStart = addIstDays(thisWeekStart, -7);
    return { start: lastWeekStart, end: thisWeekStart };
  }

  const { year, month } = toIstDateParts(now);
  if (period === "this_month") {
    const start = makeUtcFromIstParts(year, month, 1);
    /** Exclusive end = first moment of the next calendar month (IST). */
    const end =
      month === 11
        ? makeUtcFromIstParts(year + 1, 0, 1)
        : makeUtcFromIstParts(year, month + 1, 1);
    return { start, end };
  }
  if (period === "last_month") {
    const start = makeUtcFromIstParts(year, month - 1, 1);
    const end = makeUtcFromIstParts(year, month, 1);
    return { start, end };
  }
  if (period === "this_year") {
    return {
      start: makeUtcFromIstParts(year, 0, 1),
      end: makeUtcFromIstParts(year + 1, 0, 1),
    };
  }
  const start = makeUtcFromIstParts(year - 1, 0, 1);
  const end = makeUtcFromIstParts(year, 0, 1);
  return { start, end };
}

async function getActiveEventAndConfig(
  mode: DataClientMode = "session",
  activeWindow?: { start: Date; end: Date } | null,
): Promise<EligibilityConfig | null> {
  const supabase = await getDataClient(mode);
  let eventQuery = supabase
    .from("competition_event")
    .select("id")
    .eq("is_active", true);

  if (activeWindow) {
    eventQuery = eventQuery
      .lte("starts_at", activeWindow.end.toISOString())
      .gte("ends_at", activeWindow.start.toISOString());
  } else {
    const nowIso = new Date().toISOString();
    eventQuery = eventQuery.lte("starts_at", nowIso).gte("ends_at", nowIso);
  }

  const { data: event, error: eventError } = await eventQuery
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    throw eventError;
  }

  if (!event?.id) return null;

  const { data: config, error: configError } = await supabase
    .from("competition_eligibility_config")
    .select(
      "views_min_views,reels_min_reels,reels_min_views,min_views_per_reel_for_reels_lb,promote_next_eligible",
    )
    .eq("event_id", event.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError) {
    throw configError;
  }

  return {
    eventId: event.id,
    viewsMinViews: Number(config?.views_min_views ?? 1000),
    reelsMinReels: Number(config?.reels_min_reels ?? 3),
    reelsMinViews: Number(config?.reels_min_views ?? 1000),
    minViewsPerReel: Number(config?.min_views_per_reel_for_reels_lb ?? 100),
    promoteNextEligible: Boolean(config?.promote_next_eligible ?? false),
  };
}

function rankByMetrics(
  rows: CreatorMetrics[],
  primary: (row: CreatorMetrics) => number,
  secondary: (row: CreatorMetrics) => number,
) {
  return [...rows]
    .sort((a, b) => {
      const p = primary(b) - primary(a);
      if (p !== 0) return p;
      const s = secondary(b) - secondary(a);
      if (s !== 0) return s;
      return a.creatorId.localeCompare(b.creatorId);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function isEligibleForViews(row: CreatorMetrics, config: EligibilityConfig) {
  return row.verifiedViews >= config.viewsMinViews;
}

function isEligibleForReels(row: CreatorMetrics, config: EligibilityConfig) {
  return (
    row.verifiedReels >= config.reelsMinReels &&
    row.verifiedViews >= config.reelsMinViews
  );
}

function buildRemainingText(row: CreatorMetrics, config: EligibilityConfig) {
  const viewDeficit = Math.max(0, config.viewsMinViews - row.verifiedViews);
  const reelsDeficit = Math.max(0, config.reelsMinReels - row.verifiedReels);
  const reelsViewsDeficit = Math.max(0, config.reelsMinViews - row.verifiedViews);

  return {
    views: viewDeficit > 0 ? `You need ${viewDeficit} more views` : "Eligible",
    reels:
      reelsDeficit > 0
        ? `You need ${reelsDeficit} more reel${reelsDeficit > 1 ? "s" : ""}`
        : reelsViewsDeficit > 0
          ? `You need ${reelsViewsDeficit} more views`
          : "Eligible",
  };
}

function asNonNegativeNumber(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

async function fetchCreatorMetrics(
  params: {
    eventStart?: string | null;
    eventEnd?: string | null;
    range?: { start: Date; end: Date } | null;
    mode: DataClientMode;
    minViewsPerReel: number;
  },
): Promise<Map<string, CreatorMetrics>> {
  const supabase = await getDataClient(params.mode);
  const { data, error } = await supabase.rpc(
    "get_daily_challenge_creator_metrics",
    {
      p_event_start: params.eventStart ?? null,
      p_event_end: params.eventEnd ?? null,
      p_range_start: params.range?.start.toISOString() ?? null,
      p_range_end: params.range?.end.toISOString() ?? null,
      p_min_views_per_reel: Math.max(0, params.minViewsPerReel),
    },
  );

  if (error) throw error;

  const metricMap = new Map<string, CreatorMetrics>();
  for (const row of ((data || []) as CreatorMetricsRpcRow[])) {
    const id = row.creator_id ? String(row.creator_id) : "";
    if (!id) continue;
    metricMap.set(id, {
      creatorId: id,
      username: row.username || row.full_name || "anonymous",
      fullName: row.full_name || null,
      profilePictureUrl: row.profile_picture_url || null,
      pendingViews: asNonNegativeNumber(row.pending_views),
      verifiedViews: asNonNegativeNumber(row.verified_views),
      pendingReels: asNonNegativeNumber(row.pending_reels),
      verifiedReels: asNonNegativeNumber(row.verified_reels),
      totalViews: asNonNegativeNumber(row.total_views),
      totalReels: asNonNegativeNumber(row.total_reels),
    });
  }

  return metricMap;
}

export async function getDailyChallengeConfig() {
  const config = await getActiveEventAndConfig("session");
  return config;
}

export async function getDailyChallengeLeaderboard(params: {
  period: CompetitionPeriod;
  scope: SubmissionScope;
  page: number;
  limit: number;
  meUserId?: string | null;
  rangeOverride?: { start: Date; end: Date } | null;
  clientMode?: DataClientMode;
  configOverride?: EligibilityConfig | null;
}) {
  const clientMode = params.clientMode ?? "session";
  const requestedRange = params.rangeOverride ?? getPeriodRange(params.period);
  const config =
    params.configOverride === undefined
      ? await getActiveEventAndConfig(
          clientMode,
          isCurrentPeriod(params.period) ? undefined : requestedRange,
        )
      : params.configOverride;
  if (!config) {
    return {
      hasActiveEvent: false,
      config: null,
      event: null,
      topCreatorsByViews: [],
      topCreatorsByReels: [],
      pagination: { page: params.page, limit: params.limit, totalItems: 0, totalPages: 0 },
      me: null,
      period: params.period,
      effectiveRange: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const supabase = await getDataClient(clientMode);
  const { data: event, error: eventError } = await supabase
    .from("competition_event")
    .select(
      "id,name,starts_at,ends_at,timezone,prize_amount_minor_units,weekly_prize_minor_units,monthly_prize_minor_units,prize_currency",
    )
    .eq("id", config.eventId)
    .single();
  if (eventError) {
    throw eventError;
  }

  const range = clampRangeToEvent(requestedRange, event);
  if (!range) {
    return {
      hasActiveEvent: false,
      config,
      event: event ? buildLeaderboardEventPayload(event, params.period) : null,
      topCreatorsByViews: [],
      topCreatorsByReels: [],
      pagination: { page: params.page, limit: params.limit, totalItems: 0, totalPages: 0 },
      me: null,
      period: params.period,
      effectiveRange: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const metricMap = await fetchCreatorMetrics({
    eventStart: event?.starts_at,
    eventEnd: event?.ends_at,
    range,
    mode: clientMode,
    minViewsPerReel: config.minViewsPerReel,
  });

  let rows = Array.from(metricMap.values());
  if (params.scope === "pending") {
    rows = rows.map((r) => ({ ...r, totalViews: r.pendingViews, totalReels: r.pendingReels }));
  } else if (params.scope === "verified") {
    rows = rows.map((r) => ({ ...r, totalViews: r.verifiedViews, totalReels: r.verifiedReels }));
  }

  const viewsRanked = rankByMetrics(rows, (r) => r.totalViews, (r) => r.totalReels);
  const reelsRanked = rankByMetrics(rows, (r) => r.totalReels, (r) => r.totalViews);

  const totalItems = viewsRanked.length;
  const totalPages = Math.ceil(totalItems / params.limit) || 1;
  const offset = (params.page - 1) * params.limit;
  const pagedViews = viewsRanked.slice(offset, offset + params.limit);
  const pagedReels = reelsRanked.slice(offset, offset + params.limit);

  const meViews = params.meUserId
    ? viewsRanked.find((r) => r.creatorId === params.meUserId)
    : undefined;
  const meReels = params.meUserId
    ? reelsRanked.find((r) => r.creatorId === params.meUserId)
    : undefined;

  return {
    hasActiveEvent: true,
    config,
    event: event ? buildLeaderboardEventPayload(event, params.period) : null,
    period: params.period,
    effectiveRange: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    },
    topCreatorsByViews: pagedViews.map((r) => {
      const eligibility = isEligibleForViews(r, config);
      return {
        ...r,
        eligible: eligibility,
        trophy: r.rank === 1 && eligibility,
      };
    }),
    topCreatorsByReels: pagedReels.map((r) => {
      const eligibility = isEligibleForReels(r, config);
      return {
        ...r,
        eligible: eligibility,
        trophy: r.rank === 1 && eligibility,
      };
    }),
    pagination: {
      page: params.page,
      limit: params.limit,
      totalItems,
      totalPages,
    },
    me:
      meViews || meReels
        ? {
            userId: params.meUserId,
            viewsRank: meViews?.rank ?? null,
            reelsRank: meReels?.rank ?? null,
            views: meViews?.totalViews ?? 0,
            reels: meReels?.totalReels ?? 0,
            eligibility: {
              views: meViews ? isEligibleForViews(meViews, config) : false,
              reels: meReels ? isEligibleForReels(meReels, config) : false,
            },
            remaining: buildRemainingText(
              meViews ||
                meReels || {
                  creatorId: params.meUserId || "",
                  username: "",
                  fullName: null,
                  profilePictureUrl: null,
                  pendingViews: 0,
                  verifiedViews: 0,
                  pendingReels: 0,
                  verifiedReels: 0,
                  totalViews: 0,
                  totalReels: 0,
                },
              config,
            ),
          }
        : null,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDailyWinnersHistory(
  limit = 30,
  eventId?: string | null,
  period?: "day" | "week" | "month" | null,
) {
  const supabase = await createClient();
  let resolvedEventId = eventId ?? null;

  if (!resolvedEventId) {
    let latestQuery = supabase
      .from("competition_daily_winner_snapshot")
      .select("event_id,period_start,snapshot_date")
      .order("period_start", { ascending: false })
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (period) {
      latestQuery = latestQuery.eq("period", period);
    }
    const { data: latestWithSnapshot, error: eventErr } = await latestQuery.maybeSingle();
    if (eventErr) throw eventErr;
    resolvedEventId = latestWithSnapshot?.event_id ?? null;
  }

  if (!resolvedEventId) return [];

  let query = supabase
    .from("competition_daily_winner_snapshot")
    .select("*")
    .eq("event_id", resolvedEventId)
    .order("period_start", { ascending: false })
    .order("snapshot_date", { ascending: false })
    .limit(Math.max(1, limit) * 2);
  if (period) {
    query = query.eq("period", period);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function snapshotWinnersForPeriod(
  period: CompetitionPeriod,
  options: SnapshotOptions = {},
) {
  const mode: DataClientMode = options.useAdminClient ? "admin" : "session";
  const reason = options.reason || "manual_admin_refresh";
  const allowOverwrite = options.allowOverwrite ?? false;

  const supabase = await getDataClient(mode);
  const periodRange = getPeriodRange(period);
  if (!periodRange) return { ok: false, reason: "invalid_snapshot_period" };
  const config = await getActiveEventAndConfig(mode, {
    start: periodRange.start,
    end: periodRange.end,
  });
  if (!config) return { ok: false, reason: "no_event_for_snapshot_period" };

  const payload = await getDailyChallengeLeaderboard({
    period,
    scope: "verified",
    page: 1,
    limit: 200,
    rangeOverride: periodRange,
    clientMode: mode,
    configOverride: config,
  });
  if (!payload.effectiveRange) return { ok: false, reason: "event_does_not_overlap_period" };
  const effectiveStart = new Date(payload.effectiveRange.start);
  const effectiveEnd = new Date(payload.effectiveRange.end);
  const snapshotDate = toIstDateKey(effectiveStart);
  const snapshotPeriod = getSnapshotPeriod(period);

  const pickWinner = (
    rows: Array<{ eligible?: boolean; rank?: number; creatorId?: string }>,
  ) => {
    const top = rows[0];
    if (top?.eligible) return { row: top, promoted: false };
    if (config.promoteNextEligible) {
      const promoted = rows.find((row) => row.eligible);
      if (promoted) return { row: promoted, promoted: true };
    }
    return { row: top, promoted: false };
  };
  const topViews = pickWinner(payload.topCreatorsByViews);
  const topReels = pickWinner(payload.topCreatorsByReels);
  const snapPrize = snapshotPrizeFieldsFromPayloadEvent(payload.event, snapshotPeriod);
  const rows = [
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      period: snapshotPeriod,
      period_start: effectiveStart.toISOString(),
      period_end: effectiveEnd.toISOString(),
      prize_minor_units: snapPrize.prize_minor_units,
      prize_currency: snapPrize.prize_currency,
      category: "views",
      winner_creator_id: topViews.row?.eligible ? topViews.row.creatorId : null,
      rank_at_snapshot: topViews.row?.rank ?? null,
      is_eligible: Boolean(topViews.row?.eligible),
      promoted: topViews.promoted,
      metrics_json: topViews.row || {},
      rules_json: {
        ...config,
        event: payload.event,
      },
      reason: topViews.row?.eligible
        ? topViews.promoted
          ? `${reason}_promoted_next_eligible`
          : reason
        : "rank_1_not_eligible",
    },
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      period: snapshotPeriod,
      period_start: effectiveStart.toISOString(),
      period_end: effectiveEnd.toISOString(),
      prize_minor_units: snapPrize.prize_minor_units,
      prize_currency: snapPrize.prize_currency,
      category: "reels",
      winner_creator_id: topReels.row?.eligible ? topReels.row.creatorId : null,
      rank_at_snapshot: topReels.row?.rank ?? null,
      is_eligible: Boolean(topReels.row?.eligible),
      promoted: topReels.promoted,
      metrics_json: topReels.row || {},
      rules_json: {
        ...config,
        event: payload.event,
      },
      reason: topReels.row?.eligible
        ? topReels.promoted
          ? `${reason}_promoted_next_eligible`
          : reason
        : "rank_1_not_eligible",
    },
  ];

  if (allowOverwrite) {
    const { error } = await supabase
      .from("competition_daily_winner_snapshot")
      .upsert(rows, { onConflict: "event_id,period,period_start,period_end,category" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("competition_daily_winner_snapshot")
      .upsert(rows, {
        onConflict: "event_id,period,period_start,period_end,category",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  return {
    ok: true,
    period,
    snapshotPeriod,
    snapshotDate,
    periodStart: effectiveStart.toISOString(),
    periodEnd: effectiveEnd.toISOString(),
    locked: true,
  };
}

export async function snapshotWinnersForIstDate(
  snapshotDate: string,
  options: SnapshotOptions = {},
) {
  const mode: DataClientMode = options.useAdminClient ? "admin" : "session";
  const reason = options.reason || "manual_admin_refresh";
  const allowOverwrite = options.allowOverwrite ?? false;
  const dayStart = new Date(`${snapshotDate}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return { ok: false, reason: "invalid_snapshot_date" };
  }
  const config = await getActiveEventAndConfig(mode, { start: dayStart, end: dayEnd });
  if (!config) return { ok: false, reason: "no_event_for_snapshot_date" };
  const payload = await getDailyChallengeLeaderboard({
    period: "today",
    scope: "verified",
    page: 1,
    limit: 200,
    rangeOverride: { start: dayStart, end: dayEnd },
    clientMode: mode,
    configOverride: config,
  });
  if (!payload.effectiveRange) return { ok: false, reason: "event_does_not_overlap_date" };

  const effectiveStart = new Date(payload.effectiveRange.start);
  const effectiveEnd = new Date(payload.effectiveRange.end);
  const pickWinner = (
    rows: Array<{ eligible?: boolean; rank?: number; creatorId?: string }>,
  ) => {
    const top = rows[0];
    if (top?.eligible) return { row: top, promoted: false };
    if (config.promoteNextEligible) {
      const promoted = rows.find((row) => row.eligible);
      if (promoted) return { row: promoted, promoted: true };
    }
    return { row: top, promoted: false };
  };
  const topViews = pickWinner(payload.topCreatorsByViews);
  const topReels = pickWinner(payload.topCreatorsByReels);
  const snapPrize = snapshotPrizeFieldsFromPayloadEvent(payload.event, "day");
  const rows = [
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      period: "day",
      period_start: effectiveStart.toISOString(),
      period_end: effectiveEnd.toISOString(),
      prize_minor_units: snapPrize.prize_minor_units,
      prize_currency: snapPrize.prize_currency,
      category: "views",
      winner_creator_id: topViews.row?.eligible ? topViews.row.creatorId : null,
      rank_at_snapshot: topViews.row?.rank ?? null,
      is_eligible: Boolean(topViews.row?.eligible),
      promoted: topViews.promoted,
      metrics_json: topViews.row || {},
      rules_json: { ...config, event: payload.event },
      reason: topViews.row?.eligible
        ? topViews.promoted
          ? `${reason}_promoted_next_eligible`
          : reason
        : "rank_1_not_eligible",
    },
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      period: "day",
      period_start: effectiveStart.toISOString(),
      period_end: effectiveEnd.toISOString(),
      prize_minor_units: snapPrize.prize_minor_units,
      prize_currency: snapPrize.prize_currency,
      category: "reels",
      winner_creator_id: topReels.row?.eligible ? topReels.row.creatorId : null,
      rank_at_snapshot: topReels.row?.rank ?? null,
      is_eligible: Boolean(topReels.row?.eligible),
      promoted: topReels.promoted,
      metrics_json: topReels.row || {},
      rules_json: { ...config, event: payload.event },
      reason: topReels.row?.eligible
        ? topReels.promoted
          ? `${reason}_promoted_next_eligible`
          : reason
        : "rank_1_not_eligible",
    },
  ];

  if (allowOverwrite) {
    const { error } = await (await getDataClient(mode))
      .from("competition_daily_winner_snapshot")
      .upsert(rows, { onConflict: "event_id,period,period_start,period_end,category" });
    if (error) throw error;
  } else {
    const { error } = await (await getDataClient(mode))
      .from("competition_daily_winner_snapshot")
      .upsert(rows, {
        onConflict: "event_id,period,period_start,period_end,category",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  return {
    ok: true,
    period: "today",
    snapshotPeriod: "day",
    snapshotDate,
    periodStart: effectiveStart.toISOString(),
    periodEnd: effectiveEnd.toISOString(),
    locked: true,
  };
}

export async function snapshotTodayWinners(
  reason = "manual_admin_refresh",
  period: CompetitionPeriod = "today",
) {
  return snapshotWinnersForPeriod(period, {
    reason,
    allowOverwrite: true,
  });
}

export function getYesterdayIstDateKey(now = new Date()) {
  const yesterday = addIstDays(startOfIstDay(now), -1);
  const p = toIstDateParts(yesterday);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

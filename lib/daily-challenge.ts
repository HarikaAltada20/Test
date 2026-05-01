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
type AggregateRow = {
  creator_id: string | null;
  status: string | null;
  sum_views: number | string | null;
  reels_count: number | string | null;
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
    return { start, end: tomorrowStart };
  }

  if (period === "last_week") {
    const thisWeekStart = getIstWeekStart(now);
    const lastWeekStart = addIstDays(thisWeekStart, -7);
    return { start: lastWeekStart, end: thisWeekStart };
  }

  const { year, month } = toIstDateParts(now);
  if (period === "this_month") {
    return {
      start: makeUtcFromIstParts(year, month, 1),
      end: tomorrowStart,
    };
  }
  if (period === "last_month") {
    const start = makeUtcFromIstParts(year, month - 1, 1);
    const end = makeUtcFromIstParts(year, month, 1);
    return { start, end };
  }
  if (period === "this_year") {
    return {
      start: makeUtcFromIstParts(year, 0, 1),
      end: tomorrowStart,
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
    .eq("is_active", true)
    .eq("status", "active");

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
  let aggQuery = supabase
    .from("submissions")
    .select("creator_id,status,sum_views:views.sum(),reels_count:id.count()")
    .not("creator_id", "is", null)
    .in("status", ["pending", "verified", "paid"]);

  if (params.eventStart) aggQuery = aggQuery.gte("created_at", params.eventStart);
  if (params.eventEnd) aggQuery = aggQuery.lte("created_at", params.eventEnd);
  if (params.range) {
    aggQuery = aggQuery
      .gte("created_at", params.range.start.toISOString())
      .lt("created_at", params.range.end.toISOString());
  }

  const { data: aggRowsRaw, error: aggError } = await aggQuery;
  if (aggError) throw aggError;
  const aggRows = (aggRowsRaw || []) as AggregateRow[];

  let reelsQuery = supabase
    .from("submissions")
    .select("creator_id,status,reels_count:id.count()")
    .not("creator_id", "is", null)
    .in("status", ["pending", "verified", "paid"])
    .gte("views", params.minViewsPerReel);
  if (params.eventStart) reelsQuery = reelsQuery.gte("created_at", params.eventStart);
  if (params.eventEnd) reelsQuery = reelsQuery.lte("created_at", params.eventEnd);
  if (params.range) {
    reelsQuery = reelsQuery
      .gte("created_at", params.range.start.toISOString())
      .lt("created_at", params.range.end.toISOString());
  }
  const { data: reelsRowsRaw, error: reelsErr } = await reelsQuery;
  if (reelsErr) throw reelsErr;
  const reelsRows = (reelsRowsRaw || []) as AggregateRow[];

  const creatorIds = Array.from(
    new Set(
      aggRows
        .map((r) => (r.creator_id ? String(r.creator_id) : ""))
        .filter((id) => id.length > 0),
    ),
  );
  if (creatorIds.length === 0) {
    return new Map();
  }

  const { data: usersRows, error: usersError } = await supabase
    .from("users")
    .select("id,username,full_name,profile_picture_url")
    .in("id", creatorIds);
  if (usersError) throw usersError;
  const usersById = new Map(
    (usersRows || []).map((u) => [String(u.id), u]),
  );

  const metricMap = new Map<string, CreatorMetrics>();
  for (const id of creatorIds) {
    const user = usersById.get(id);
    metricMap.set(id, {
      creatorId: id,
      username: user?.username || user?.full_name || "anonymous",
      fullName: user?.full_name || null,
      profilePictureUrl: user?.profile_picture_url || null,
      pendingViews: 0,
      verifiedViews: 0,
      pendingReels: 0,
      verifiedReels: 0,
      totalViews: 0,
      totalReels: 0,
    });
  }

  for (const row of aggRows) {
    const creatorId = row.creator_id ? String(row.creator_id) : "";
    if (!creatorId) continue;
    const metrics = metricMap.get(creatorId);
    if (!metrics) continue;
    const status = String(row.status || "pending").toLowerCase();
    const sumViews = asNonNegativeNumber(row.sum_views);
    const reelsCount = asNonNegativeNumber(row.reels_count);

    if (status === "pending") {
      metrics.pendingViews += sumViews;
    } else {
      metrics.verifiedViews += sumViews;
    }
    metrics.totalViews += sumViews;
    metrics.totalReels += reelsCount;
  }

  for (const row of reelsRows) {
    const creatorId = row.creator_id ? String(row.creator_id) : "";
    if (!creatorId) continue;
    const metrics = metricMap.get(creatorId);
    if (!metrics) continue;
    const status = String(row.status || "pending").toLowerCase();
    const reelsCount = asNonNegativeNumber(row.reels_count);
    if (status === "pending") {
      metrics.pendingReels += reelsCount;
    } else {
      metrics.verifiedReels += reelsCount;
    }
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
  const config =
    params.configOverride === undefined
      ? await getActiveEventAndConfig(clientMode)
      : params.configOverride;
  if (!config) {
    return {
      hasActiveEvent: false,
      config: null,
      topCreatorsByViews: [],
      topCreatorsByReels: [],
      pagination: { page: params.page, limit: params.limit, totalItems: 0, totalPages: 0 },
      me: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const supabase = await getDataClient(clientMode);
  const { data: event, error: eventError } = await supabase
    .from("competition_event")
    .select("starts_at,ends_at")
    .eq("id", config.eventId)
    .single();
  if (eventError) {
    throw eventError;
  }

  const range = params.rangeOverride ?? getPeriodRange(params.period);
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

export async function getDailyWinnersHistory(days = 30, eventId?: string | null) {
  const supabase = await createClient();
  let resolvedEventId = eventId ?? null;

  if (!resolvedEventId) {
    const { data: latestWithSnapshot, error: eventErr } = await supabase
      .from("competition_daily_winner_snapshot")
      .select("event_id,snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eventErr) throw eventErr;
    resolvedEventId = latestWithSnapshot?.event_id ?? null;
  }

  if (!resolvedEventId) return [];

  const { data, error } = await supabase
    .from("competition_daily_winner_snapshot")
    .select("*")
    .eq("event_id", resolvedEventId)
    .order("snapshot_date", { ascending: false })
    .limit(Math.max(1, days) * 2);
  if (error) {
    throw error;
  }
  return data || [];
}

export async function snapshotWinnersForIstDate(
  snapshotDate: string,
  options: SnapshotOptions = {},
) {
  const mode: DataClientMode = options.useAdminClient ? "admin" : "session";
  const reason = options.reason || "manual_admin_refresh";
  const allowOverwrite = options.allowOverwrite ?? false;

  const supabase = await getDataClient(mode);
  const dayStart = new Date(`${snapshotDate}T00:00:00+05:30`);
  const dayEnd = new Date(new Date(`${snapshotDate}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return { ok: false, reason: "invalid_snapshot_date" };
  }
  const config = await getActiveEventAndConfig(mode, {
    start: dayStart,
    end: dayEnd,
  });
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
  const rows = [
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      category: "views",
      winner_creator_id: topViews.row?.eligible ? topViews.row.creatorId : null,
      rank_at_snapshot: topViews.row?.rank ?? null,
      is_eligible: Boolean(topViews.row?.eligible),
      promoted: topViews.promoted,
      metrics_json: topViews.row || {},
      rules_json: config,
      reason: topViews.row?.eligible
        ? topViews.promoted
          ? `${reason}_promoted_next_eligible`
          : reason
        : "rank_1_not_eligible",
    },
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      category: "reels",
      winner_creator_id: topReels.row?.eligible ? topReels.row.creatorId : null,
      rank_at_snapshot: topReels.row?.rank ?? null,
      is_eligible: Boolean(topReels.row?.eligible),
      promoted: topReels.promoted,
      metrics_json: topReels.row || {},
      rules_json: config,
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
      .upsert(rows, { onConflict: "event_id,snapshot_date,category" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("competition_daily_winner_snapshot")
      .upsert(rows, {
        onConflict: "event_id,snapshot_date,category",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }

  return { ok: true, snapshotDate, locked: true };
}

export async function snapshotTodayWinners(reason = "manual_admin_refresh") {
  const today = toIstDateParts(new Date());
  const snapshotDate = `${today.year}-${String(today.month + 1).padStart(2, "0")}-${String(
    today.day,
  ).padStart(2, "0")}`;
  return snapshotWinnersForIstDate(snapshotDate, {
    reason,
    allowOverwrite: true,
  });
}

export function getYesterdayIstDateKey(now = new Date()) {
  const yesterday = addIstDays(startOfIstDay(now), -1);
  const p = toIstDateParts(yesterday);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

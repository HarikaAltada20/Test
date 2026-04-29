import { createClient } from "@/utils/supabase/server";

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
};

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

async function getActiveEventAndConfig(): Promise<EligibilityConfig | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: event } = await supabase
    .from("competition_event")
    .select("id")
    .eq("is_active", true)
    .eq("status", "active")
    .lte("starts_at", nowIso)
    .gte("ends_at", nowIso)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!event?.id) return null;

  const { data: config } = await supabase
    .from("competition_eligibility_config")
    .select(
      "views_min_views,reels_min_reels,reels_min_views,min_views_per_reel_for_reels_lb,promote_next_eligible",
    )
    .eq("event_id", event.id)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

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

export async function getDailyChallengeConfig() {
  const config = await getActiveEventAndConfig();
  return config;
}

export async function getDailyChallengeLeaderboard(params: {
  period: CompetitionPeriod;
  scope: SubmissionScope;
  page: number;
  limit: number;
  meUserId?: string | null;
  rangeOverride?: { start: Date; end: Date } | null;
}) {
  const config = await getActiveEventAndConfig();
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

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("competition_event")
    .select("starts_at,ends_at")
    .eq("id", config.eventId)
    .single();

  let query = supabase
    .from("submissions")
    .select(
      "id,creator_id,views,status,created_at,users!inner(id,username,full_name,profile_picture_url)",
    )
    .not("creator_id", "is", null)
    .in("status", ["pending", "verified", "paid"]);

  if (event?.starts_at) query = query.gte("created_at", event.starts_at);
  if (event?.ends_at) query = query.lte("created_at", event.ends_at);

  const range = params.rangeOverride ?? getPeriodRange(params.period);
  if (range) {
    query = query.gte("created_at", range.start.toISOString());
    query = query.lt("created_at", range.end.toISOString());
  }

  const { data: submissions, error } = await query;
  if (error) throw error;

  const metricMap = new Map<string, CreatorMetrics>();
  for (const sub of submissions || []) {
    const creatorId = sub.creator_id as string;
    if (!creatorId) continue;
    const user = Array.isArray(sub.users) ? sub.users[0] : sub.users;
    if (!metricMap.has(creatorId)) {
      metricMap.set(creatorId, {
        creatorId,
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
    const row = metricMap.get(creatorId)!;
    const views = Number(sub.views || 0);
    const status = String(sub.status || "pending");
    row.totalViews += views;
    row.totalReels += 1;
    if (status === "pending") {
      row.pendingViews += views;
      if (views >= config.minViewsPerReel) row.pendingReels += 1;
    } else {
      row.verifiedViews += views;
      if (views >= config.minViewsPerReel) row.verifiedReels += 1;
    }
  }

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

export async function getDailyWinnersHistory(days = 30) {
  const config = await getActiveEventAndConfig();
  if (!config) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("competition_daily_winner_snapshot")
    .select("*")
    .eq("event_id", config.eventId)
    .order("snapshot_date", { ascending: false })
    .limit(days * 2);
  return data || [];
}

export async function snapshotWinnersForIstDate(
  snapshotDate: string,
  options: SnapshotOptions = {},
) {
  const config = await getActiveEventAndConfig();
  if (!config) return { ok: false, reason: "no_active_event" };
  const reason = options.reason || "manual_admin_refresh";
  const allowOverwrite = options.allowOverwrite ?? false;

  const supabase = await createClient();
  if (!allowOverwrite) {
    const { data: existing } = await supabase
      .from("competition_daily_winner_snapshot")
      .select("id")
      .eq("event_id", config.eventId)
      .eq("snapshot_date", snapshotDate)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ok: true, snapshotDate, locked: true, skipped: true };
    }
  }

  const dayStart = new Date(`${snapshotDate}T00:00:00+05:30`);
  const dayEnd = new Date(new Date(`${snapshotDate}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000);
  const payload = await getDailyChallengeLeaderboard({
    period: "today",
    scope: "verified",
    page: 1,
    limit: 200,
    rangeOverride: { start: dayStart, end: dayEnd },
  });
  if (Number.isNaN(dayStart.getTime()) || Number.isNaN(dayEnd.getTime())) {
    return { ok: false, reason: "invalid_snapshot_date" };
  }

  const topViews = payload.topCreatorsByViews[0];
  const topReels = payload.topCreatorsByReels[0];
  const rows = [
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      category: "views",
      winner_creator_id: topViews?.eligible ? topViews.creatorId : null,
      rank_at_snapshot: topViews?.rank ?? null,
      is_eligible: Boolean(topViews?.eligible),
      promoted: false,
      metrics_json: topViews || {},
      rules_json: config,
      reason: topViews?.eligible ? reason : "rank_1_not_eligible",
    },
    {
      event_id: config.eventId,
      snapshot_date: snapshotDate,
      category: "reels",
      winner_creator_id: topReels?.eligible ? topReels.creatorId : null,
      rank_at_snapshot: topReels?.rank ?? null,
      is_eligible: Boolean(topReels?.eligible),
      promoted: false,
      metrics_json: topReels || {},
      rules_json: config,
      reason: topReels?.eligible ? reason : "rank_1_not_eligible",
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
      .insert(rows);
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

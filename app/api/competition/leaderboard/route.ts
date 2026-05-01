import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  dailyChallengeCache,
  getDailyChallengeCacheKey,
} from "@/lib/cache-utils";
import {
  CompetitionPeriod,
  SubmissionScope,
  getDailyChallengeLeaderboard,
} from "@/lib/daily-challenge";
import {
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN,
  DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR,
} from "@/lib/constants";

const VALID_PERIODS: CompetitionPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "all_time",
];
const VALID_SCOPES: SubmissionScope[] = ["pending", "verified", "all"];

export const dynamic = "force-dynamic";

function parsePositiveInt(
  value: string | null,
  fallback: number,
  bounds?: { min?: number; max?: number },
): number {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return fallback;
  const rounded = Math.floor(raw);
  const min = bounds?.min ?? Number.MIN_SAFE_INTEGER;
  const max = bounds?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(max, Math.max(min, rounded));
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "today") as CompetitionPeriod;
    const scope = (searchParams.get("scope") || "verified") as SubmissionScope;
    const page = parsePositiveInt(searchParams.get("page"), 1, { min: 1 });
    const limit = parsePositiveInt(searchParams.get("limit"), 25, {
      min: 5,
      max: 100,
    });
    const fresh = searchParams.get("fresh") === "1";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const nowIso = new Date().toISOString();
    const { data: activeEventRow, error: activeEventErr } = await supabaseAdmin
      .from("competition_event")
      .select("id")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeEventErr) throw activeEventErr;

    if (fresh) {
      if (!user) {
        return NextResponse.json(
          { error: "Authentication required for refresh" },
          { status: 401 },
        );
      }

      const { data: userRow, error: userError } = await supabaseAdmin
        .from("users")
        .select("user_type")
        .eq("id", user.id)
        .single();
      if (userError) throw userError;

      const userType = String(userRow?.user_type || "creator");
      const cooldownMs =
        userType === "admin"
          ? DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_ADMIN
          : DAILY_CHALLENGE_REFRESH_COOLDOWN_MS_CREATOR;

      if (!activeEventRow?.id) {
        return NextResponse.json(
          { error: "No active competition event found" },
          { status: 400 },
        );
      }

      const { data: gateRaw, error: gateErr } = await supabaseAdmin.rpc(
        "competition_consume_leaderboard_refresh",
        {
          p_event_id: activeEventRow.id,
          p_cooldown_ms: cooldownMs,
        },
      );
      if (gateErr) throw gateErr;

      const gate = (gateRaw || {}) as {
        allowed?: boolean;
        next_refresh_available_at?: string | null;
        remaining_ms?: number;
      };
      if (!gate.allowed) {
        return NextResponse.json(
          {
            error: "Refresh cooldown active. Please wait before refreshing again.",
            nextRefreshAvailable: gate.next_refresh_available_at ?? null,
            remainingMs: Math.max(0, Number(gate.remaining_ms || 0)),
          },
          { status: 429 },
        );
      }
    }

    const eventCacheSegment = activeEventRow?.id || "no-active-event";
    const cacheKey = `${getDailyChallengeCacheKey({
      period,
      scope,
      page,
      limit,
    })}:event:${eventCacheSegment}:user:${user.id}`;
    if (!fresh) {
      const cached = dailyChallengeCache.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }

    const payload = await getDailyChallengeLeaderboard({
      period,
      scope,
      page,
      limit,
        meUserId: user.id,
    });

    dailyChallengeCache.set(cacheKey, payload, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[competition/leaderboard] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

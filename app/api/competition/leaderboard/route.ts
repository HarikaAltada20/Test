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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get("period") || "today") as CompetitionPeriod;
    const scope = (searchParams.get("scope") || "verified") as SubmissionScope;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") || 25)));
    const fresh = searchParams.get("fresh") === "1";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }
    if (!VALID_SCOPES.includes(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    if (fresh) {
      if (!user) {
        return NextResponse.json(
          { error: "Authentication required for refresh" },
          { status: 401 },
        );
      }

      const supabaseAdmin = createAdminClient();
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

      const nowIso = new Date().toISOString();
      const { data: eventRow, error: eventErr } = await supabaseAdmin
        .from("competition_event")
        .select("id")
        .eq("is_active", true)
        .eq("status", "active")
        .lte("starts_at", nowIso)
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (eventErr) throw eventErr;
      if (!eventRow?.id) {
        return NextResponse.json(
          { error: "No active competition event found" },
          { status: 400 },
        );
      }

      const { data: gateRaw, error: gateErr } = await supabaseAdmin.rpc(
        "competition_consume_leaderboard_refresh",
        {
          p_event_id: eventRow.id,
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

    const cacheKey = getDailyChallengeCacheKey({ period, scope, page, limit });
    if (!fresh) {
      const cached = dailyChallengeCache.get<any>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, cached: true });
    }

    const payload = await getDailyChallengeLeaderboard({
      period,
      scope,
      page,
      limit,
      meUserId: user?.id || null,
    });

    dailyChallengeCache.set(cacheKey, payload, 60 * 60 * 1000);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[competition/leaderboard] error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

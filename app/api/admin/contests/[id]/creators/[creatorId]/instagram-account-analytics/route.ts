import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  computeSinceUntilForPreset,
  demographicsTimeframeForPreset,
  fetchAccountDemographics,
  fetchUserAccountInsights,
  type AccountInsightsPreset,
} from "@/lib/instagram-account-insights";
import {
  buildInstagramProfileSnapshot,
  mergeInstagramAnalyticsEntry,
  parseInstagramArchive,
  type InstagramAnalyticsEntry,
} from "@/lib/platform-social-archive";
import { isTokenExpiring, refreshToken } from "@/lib/instagram-insights";

export const dynamic = "force-dynamic";

async function assertCreatorInContest(
  admin: ReturnType<typeof createAdminClient>,
  contestId: string,
  creatorId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("submissions")
    .select("id")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[instagram-account-analytics] submission check:", error);
    return false;
  }
  return !!data;
}

function entryKeyForRequest(
  preset: AccountInsightsPreset,
  since?: number,
  until?: number
): string {
  const { entryKey } = computeSinceUntilForPreset(
    preset,
    Math.floor(Date.now() / 1000),
    since,
    until
  );
  return entryKey;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; creatorId: string }> }
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: contestId, creatorId } = await context.params;
  const preset = (request.nextUrl.searchParams.get("preset") ||
    "overall") as AccountInsightsPreset;
  const sinceParam = request.nextUrl.searchParams.get("since");
  const untilParam = request.nextUrl.searchParams.get("until");
  const since = sinceParam ? parseInt(sinceParam, 10) : undefined;
  const until = untilParam ? parseInt(untilParam, 10) : undefined;

  const admin = createAdminClient();
  const inContest = await assertCreatorInContest(admin, contestId, creatorId);
  if (!inContest) {
    return NextResponse.json(
      { error: "Creator not found in this contest" },
      { status: 404 }
    );
  }

  const { data: profile, error } = await admin
    .from("creator_profiles")
    .select("instagram_archive, instagram_account")
    .eq("id", creatorId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
  }

  const parsed = parseInstagramArchive(profile.instagram_archive);
  const key = entryKeyForRequest(
    preset,
    since ?? undefined,
    until ?? undefined
  );
  const entry = parsed.analytics?.entries?.[key];

  return NextResponse.json({
    entry: entry ?? null,
    entryKey: key,
    instagramAccountPresent: !!profile.instagram_account,
    profileSummary: buildInstagramProfileSnapshot(
      profile.instagram_account as Record<string, unknown>
    ),
    archive: parsed,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; creatorId: string }> }
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: contestId, creatorId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const preset = (body.preset || "overall") as AccountInsightsPreset;
  const forceRefresh = Boolean(body.forceRefresh);
  const customSince = typeof body.since === "number" ? body.since : undefined;
  const customUntil = typeof body.until === "number" ? body.until : undefined;

  const admin = createAdminClient();
  const inContest = await assertCreatorInContest(admin, contestId, creatorId);
  if (!inContest) {
    return NextResponse.json(
      { error: "Creator not found in this contest" },
      { status: 404 }
    );
  }

  const { data: profile, error: profErr } = await admin
    .from("creator_profiles")
    .select("instagram_archive, instagram_account")
    .eq("id", creatorId)
    .single();

  if (profErr || !profile) {
    return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const { since, until, entryKey } = computeSinceUntilForPreset(
    preset,
    nowSec,
    customSince,
    customUntil
  );

  const parsed = parseInstagramArchive(profile.instagram_archive);
  const cached = parsed.analytics?.entries?.[entryKey];

  if (!forceRefresh && cached) {
    return NextResponse.json({
      source: "cache" as const,
      entry: cached,
      entryKey,
      since,
      until,
      profileSummary: buildInstagramProfileSnapshot(
        profile.instagram_account as Record<string, unknown>
      ),
    });
  }

  const ig = profile.instagram_account as
    | {
        access_token?: string;
        app_scoped_user_id?: string;
        token_expiry?: string;
      }
    | null;

  if (!ig?.access_token || !ig.app_scoped_user_id) {
    const errEntry: InstagramAnalyticsEntry = {
      fetched_at: new Date().toISOString(),
      since,
      until,
      preset,
      metrics: {},
      error: "Instagram not connected or missing app_scoped_user_id",
    };
    const merged = mergeInstagramAnalyticsEntry(
      profile.instagram_archive,
      entryKey,
      errEntry
    );
    await admin
      .from("creator_profiles")
      .update({ instagram_archive: merged as unknown as Record<string, unknown> })
      .eq("id", creatorId);

    return NextResponse.json({
      source: "network" as const,
      entry: errEntry,
      entryKey,
      since,
      until,
      profileSummary: buildInstagramProfileSnapshot(
        profile.instagram_account as Record<string, unknown>
      ),
    });
  }

  let accessToken = ig.access_token;
  if (ig.token_expiry && isTokenExpiring(ig.token_expiry)) {
    const refreshed = await refreshToken(creatorId, accessToken);
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token;
      const updatedAccount = {
        ...ig,
        access_token: refreshed.access_token,
        token_expiry: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
          : ig.token_expiry,
      };
      await admin
        .from("creator_profiles")
        .update({
          instagram_account: updatedAccount as unknown as Record<string, unknown>,
        })
        .eq("id", creatorId);
    }
  }

  const result = await fetchUserAccountInsights(
    ig.app_scoped_user_id,
    accessToken,
    since,
    until
  );

  let entry: InstagramAnalyticsEntry;

  if (result.kind === "success") {
    const demoTf = demographicsTimeframeForPreset(
      preset,
      customSince,
      customUntil
    );
    const demographics = await fetchAccountDemographics(
      ig.app_scoped_user_id,
      accessToken,
      demoTf
    );
    const profileSnap = buildInstagramProfileSnapshot(
      ig as Record<string, unknown>
    );
    entry = {
      fetched_at: new Date().toISOString(),
      since,
      until,
      preset,
      metrics: result.metrics,
      demographics,
      ...(profileSnap ? { profile: profileSnap } : {}),
    };
  } else {
    entry = {
      fetched_at: new Date().toISOString(),
      since,
      until,
      preset,
      metrics: {},
      error: result.message || "Failed to fetch insights",
    };
  }

  const mergedArchive = mergeInstagramAnalyticsEntry(
    profile.instagram_archive,
    entryKey,
    entry
  );

  await admin
    .from("creator_profiles")
    .update({
      instagram_archive: mergedArchive as unknown as Record<string, unknown>,
    })
    .eq("id", creatorId);

  return NextResponse.json({
    source: "network" as const,
    entry,
    entryKey,
    since,
    until,
    profileSummary: buildInstagramProfileSnapshot(
      profile.instagram_account as Record<string, unknown>
    ),
  });
}

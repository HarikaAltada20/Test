import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  buildBrandAnalyticsGraph,
  normalizeBrandPlatformKey,
} from "@/lib/brand-analytics-graph";
import {
  parseBrandAnalyticsDateRange,
  parseBrandContestIdSet,
  parseBrandContestTypeSet,
  parseBrandAnalyticsSource,
  validateBrandAnalyticsDateRange,
} from "@/lib/brand-analytics-query";
import { fetchBrandPcSubmissionsAsAnalyticsRows } from "@/lib/brand-analytics-pc-submissions";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const source = parseBrandAnalyticsSource(searchParams);
    const isPc = source === "pc_submissions";

    const statusRaw = (searchParams.get("status") ?? "all").trim().toLowerCase();
    const notRejected = searchParams.get("notRejected") === "true";
    const resolvedFilter = notRejected
      ? "not_rejected"
      : statusRaw === "verifiedpaid"
        ? "verifiedPaid"
        : statusRaw;
    const contestTypeSet = parseBrandContestTypeSet(searchParams);
    const contestIdSet = parseBrandContestIdSet(searchParams);
    const contentType = (searchParams.get("contentType") ?? "video")
      .trim()
      .toLowerCase();
    const videoPlatform = (searchParams.get("videoPlatform") ?? "all")
      .trim()
      .toLowerCase();
    const tiktokParam = searchParams.get("tiktok");
    const tiktokAnalytics = tiktokParam === "true" || tiktokParam === "1";
    const twitterParam = searchParams.get("twitter");
    const twitterAnalytics = isPc
      ? false
      : twitterParam === "true" || twitterParam === "1";

    const dateRange = parseBrandAnalyticsDateRange(searchParams);
    const dateValidation = validateBrandAnalyticsDateRange(dateRange);
    if (!dateValidation.ok) {
      return NextResponse.json({ error: dateValidation.error }, { status: 400 });
    }
    const { from, to } = dateRange;

    let contests: {
      id: string;
      platform?: string | null;
      contest_type?: string | null;
      contest_based_details?: unknown;
    }[] = [];
    const CHUNK_CONTEST = 1000;
    let contestRangeFrom = 0;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("contests")
        .select("id, platform, contest_type, contest_based_details")
        .eq("advertiser_id", user.id)
        .order("created_at", { ascending: false })
        .range(contestRangeFrom, contestRangeFrom + CHUNK_CONTEST - 1);

      if (error) {
        console.error("Brand graph contests error:", error);
        return NextResponse.json(
          { error: "Failed to fetch contests" },
          { status: 500 },
        );
      }
      if (!chunk || chunk.length === 0) break;
      contests = contests.concat(chunk);
      if (chunk.length < CHUNK_CONTEST) break;
      contestRangeFrom += CHUNK_CONTEST;
    }

    if (contestIdSet !== null) {
      contests = contests.filter((c) => contestIdSet.has(c.id));
    }

    const contestsFilteredByType =
      contestTypeSet === null
        ? contests
        : contests.filter((c) =>
            contestTypeSet.has((c.contest_type ?? "").toString().toLowerCase()),
          );

    const allowedPlatforms = ((): string[] => {
      const platforms: string[] = [];
      if (contentType === "video") {
        if (videoPlatform === "all") {
          platforms.push("youtube", "instagram", "tiktok");
        } else if (videoPlatform === "youtube_instagram") {
          platforms.push("youtube", "instagram");
        } else if (videoPlatform === "youtube_tiktok") {
          platforms.push("youtube", "tiktok");
        } else if (videoPlatform === "instagram_tiktok") {
          platforms.push("instagram", "tiktok");
        } else if (
          ["youtube", "instagram", "tiktok"].includes(videoPlatform)
        ) {
          platforms.push(videoPlatform);
        } else {
          platforms.push("youtube", "instagram");
          if (tiktokAnalytics) platforms.push("tiktok");
        }
      }
      if (twitterAnalytics) platforms.push("twitter");
      if (platforms.length === 0) {
        return ["youtube", "instagram", "tiktok", "twitter"];
      }
      return platforms;
    })();

    const contestsFiltered = contestsFilteredByType.filter((c) =>
      allowedPlatforms.includes(normalizeBrandPlatformKey(c)),
    );
    const contestIds = contestsFiltered.map((c) => c.id);
    const twitterContestIds = isPc
      ? []
      : contestsFiltered
          .filter((c) => normalizeBrandPlatformKey(c) === "twitter")
          .map((c) => c.id);
    const videoContestIds = contestsFiltered
      .filter((c) => normalizeBrandPlatformKey(c) !== "twitter")
      .map((c) => c.id);

    let submissions: {
      id: string;
      contest_id: string;
      created_at: string;
      status: string | null;
      platform?: string | null;
      views?: number | null;
      other_stats?: Record<string, unknown> | null;
    }[] = [];

    if (videoContestIds.length > 0) {
      if (isPc) {
        const pcRows = await fetchBrandPcSubmissionsAsAnalyticsRows(
          supabase,
          videoContestIds,
          {
            dateFrom: from,
            dateTo: to,
          },
        );
        submissions = pcRows.map((row) => ({
          id: String(row.id),
          contest_id: String(row.contest_id),
          created_at: String(row.created_at ?? ""),
          status: (row.status as string | null) ?? null,
          platform: (row.platform as string | null) ?? null,
          views: Number(row.views ?? 0) || 0,
          other_stats:
            (row.other_stats as Record<string, unknown> | null) ?? null,
        }));
      } else {
        const CHUNK = 1000;
        const CONTEST_ID_CHUNK = 200;
        for (
          let idFrom = 0;
          idFrom < videoContestIds.length;
          idFrom += CONTEST_ID_CHUNK
        ) {
          const contestIdChunk = videoContestIds.slice(
            idFrom,
            idFrom + CONTEST_ID_CHUNK,
          );
          let rangeFrom = 0;
          while (true) {
            const { data: chunk, error } = await supabase
              .from("submissions")
              .select(
                "id, contest_id, created_at, status, platform, views, other_stats",
              )
              .in("contest_id", contestIdChunk)
              .gte("created_at", from.toISOString())
              .lte("created_at", to.toISOString())
              .range(rangeFrom, rangeFrom + CHUNK - 1);

            if (error) {
              console.error("Brand graph submissions error:", error);
              return NextResponse.json(
                { error: "Failed to fetch submissions" },
                { status: 500 },
              );
            }
            if (!chunk || chunk.length === 0) break;
            submissions = submissions.concat(chunk);
            if (chunk.length < CHUNK) break;
            rangeFrom += CHUNK;
          }
        }
      }
    }

    let tweets:
      | {
          contest_id?: string;
          tweet_created_at?: string | null;
          impressions?: number | null;
          likes?: number | null;
          replies?: number | null;
          moderation_status?: string | null;
        }[]
      | undefined;

    if (twitterAnalytics && twitterContestIds.length > 0) {
      const { data: twitterRows, error: twitterError } = await supabase
        .from("twitter_campaign_tweets")
        .select(
          "contest_id, tweet_created_at, impressions, likes, replies, moderation_status",
        )
        .in("contest_id", twitterContestIds)
        .gte("tweet_created_at", from.toISOString())
        .lte("tweet_created_at", to.toISOString());

      if (twitterError) {
        console.error("Brand graph twitter error:", twitterError);
      } else {
        tweets = twitterRows ?? [];
      }
    }

    const result = buildBrandAnalyticsGraph({
      contests: contestsFiltered,
      submissions,
      tweets,
      from,
      to,
      activeFilter: resolvedFilter,
      includeTwitter: twitterAnalytics,
    });

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      dataSource: source,
      ...result,
    });
  } catch (error) {
    console.error("Brand analytics graph error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}

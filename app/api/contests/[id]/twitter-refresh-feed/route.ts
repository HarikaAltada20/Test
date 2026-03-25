import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import {
  METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES,
  METRICS_REFRESH_COOLDOWN_MS_BRAND,
  METRICS_REFRESH_COOLDOWN_MS_ADMIN,
} from "@/lib/constants";
import { verifyAdminAccess } from "@/utils/admin-auth";
import {
  isMetricsQueueEnabled,
  enqueueMetricsRefreshJob,
  type MetricsRefreshJob,
} from "@/lib/queue/metrics-refresh-queue";
import { isQStashEnabled, triggerProcessMetricsQueue } from "@/lib/qstash";

export const dynamic = "force-dynamic";

// IMPORTANT: This endpoint triggers Twitter API calls
// This is called ONLY when "Refresh Feed" button is clicked
// All other operations (tab switch, pagination) only read from DB
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: contestId } = await params;
    const now = new Date();

    // Check if user is admin
    const { isAdmin } = await verifyAdminAccess();

    // Get contest details including last metrics update time, advertiser_id, and campaign type (for queue)
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, platform, last_metrics_updated, advertiser_id, contest_based_details, post_contest_status"
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Hard lock: same as refresh-metrics - no feed refresh after review begins
    if (
      contest.post_contest_status === "in_review" ||
      contest.post_contest_status === "verification_complete" ||
      contest.post_contest_status === "payouts_processed"
    ) {
      return NextResponse.json(
        {
          error:
            "Metrics are locked after contest review begins. No further refresh allowed.",
        },
        { status: 400 }
      );
    }

    // Check if user is the contest owner (brand/advertiser)
    const isOwner = contest.advertiser_id === user.id;

    // When caller is a creator (opportunities side), refresh only that creator's tweets.
    const creatorOnly = !isAdmin && !isOwner;

    // Creator-only cooldown is based on twitter_campaign_leaderboard.next_refresh_available_at,
    // so it doesn't affect contests.last_metrics_updated (brand/admin cooldown).
    if (creatorOnly) {
      const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Creator-only refresh is allowed only for active participants.
      const { data: participant } = await supabaseAdmin
        .from("twitter_campaign_participants")
        .select("creator_id")
        .eq("contest_id", contestId)
        .eq("creator_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!participant) {
        return NextResponse.json(
          {
            error: "Please participate in the campaign before refreshing ....",
          },
          { status: 403 }
        );
      }

      const { data: creatorLb } = await supabaseAdmin
        .from("twitter_campaign_leaderboard")
        .select("next_refresh_available_at, last_refreshed_at")
        .eq("contest_id", contestId)
        .eq("creator_id", user.id)
        .maybeSingle();

      const nextRefresh = creatorLb?.next_refresh_available_at
        ? new Date(creatorLb.next_refresh_available_at)
        : null;

      if (nextRefresh && nextRefresh.getTime() > now.getTime()) {
        const remainingMs = nextRefresh.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        return NextResponse.json(
          {
            error: `Please wait ${remainingMinutes} more minutes before refreshing again`,
            nextRefreshAvailable: nextRefresh.toISOString(),
          },
          { status: 429 }
        );
      }
    } else {
      // Determine cooldown period based on user type for full refreshes.
      const cooldownMs = isAdmin
        ? METRICS_REFRESH_COOLDOWN_MS_ADMIN // 1 minute for admins
        : isOwner
        ? METRICS_REFRESH_COOLDOWN_MS_BRAND // 3 minutes for brands/advertisers
        : METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES; // fallback

      if (contest.last_metrics_updated) {
        const lastUpdate = new Date(contest.last_metrics_updated);
        const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();

        if (timeSinceLastUpdate < cooldownMs) {
          const remainingMs = cooldownMs - timeSinceLastUpdate;
          const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
          return NextResponse.json(
            {
              error: `Feed was updated ${Math.floor(
                timeSinceLastUpdate / 1000 / 60
              )} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
              nextRefreshAvailable: new Date(
                lastUpdate.getTime() + cooldownMs
              ).toISOString(),
            },
            { status: 429 }
          );
        }
      }
    }

    // Creator-only: queue background refresh (so the browser doesn't hang)
    if (creatorOnly && isMetricsQueueEnabled()) {
      const platform = (contest?.platform ?? "").toString().toLowerCase();
      const isTwitterPlatform = platform === "twitter" || platform === "x";
      const campaignType =
        (
          contest as {
            contest_based_details?: {
              twitter_campaign?: { campaign_type?: string };
            };
          }
        )?.contest_based_details?.twitter_campaign?.campaign_type ?? "";
      const isRaidCampaign =
        isTwitterPlatform &&
        typeof campaignType === "string" &&
        campaignType.toLowerCase().trim() === "raid";

      const job: MetricsRefreshJob = isRaidCampaign
        ? {
            contestId,
            isRaid: true,
            batchIndex: 0,
            totalBatches: 1,
            creatorId: user.id,
          }
        : {
            contestId,
            isRaid: false,
            batchIndex: 0,
            totalBatches: 1,
            creatorId: user.id,
          };

      const enqueueResult = await enqueueMetricsRefreshJob(job);
      if (enqueueResult.error) {
        console.error(
          `[twitter-refresh-feed] Creator queue enqueue failed for ${contestId}:`,
          enqueueResult.error
        );
        return NextResponse.json(
          { error: "Failed to start creator feed refresh" },
          { status: 500 }
        );
      }

      console.log(
        `[twitter-refresh-feed] Enqueued creator-only job for contest ${contestId} (isRaid=${isRaidCampaign})`
      );

      const host = request.headers.get("host");
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const baseUrlFromHeaders = host ? `${protocol}://${host}` : "";
      const baseUrl =
        baseUrlFromHeaders ||
        process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
        "";

      if (!baseUrl) {
        return NextResponse.json(
          { error: "Missing base URL for background refresh" },
          { status: 500 }
        );
      }

      const doFetch = () =>
        fetch(`${baseUrl}/api/cron/process-metrics-queue`, {
          method: "POST",
          headers: process.env.CRON_SECRET
            ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
            : {},
        }).catch((e) =>
          console.warn(
            "[twitter-refresh-feed] Trigger process-metrics-queue failed:",
            e
          )
        );

      if (isQStashEnabled()) {
        triggerProcessMetricsQueue(baseUrl)
          .then((res) => {
            if (res?.error) {
              doFetch();
            } else if (res?.messageId) {
              console.log(
                "[twitter-refresh-feed] QStash trigger sent messageId=",
                res.messageId
              );
            }
          })
          .catch(() => doFetch());
      } else {
        doFetch();
      }

      return NextResponse.json({
        success: true,
        queued: true,
        message:
          "Creator feed refresh started in background. Page will reload when done.",
        contestId,
        contestTitle: contest.title,
        nextRefreshAvailable: new Date(
          now.getTime() + METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES
        ).toISOString(),
        lastMetricsUpdated: contest.last_metrics_updated || null,
      });
    }

    // Full refresh (brand/admin): use Redis queue when enabled to avoid timeout
    if (!creatorOnly && isMetricsQueueEnabled()) {
      const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const platform = (contest?.platform ?? "").toString().toLowerCase();
      const isTwitterPlatform = platform === "twitter" || platform === "x";
      const campaignType =
        (
          contest as {
            contest_based_details?: {
              twitter_campaign?: { campaign_type?: string };
            };
          }
        )?.contest_based_details?.twitter_campaign?.campaign_type ?? "";
      const isRaidCampaign =
        isTwitterPlatform &&
        typeof campaignType === "string" &&
        campaignType.toLowerCase().trim() === "raid";

      const { count } = await supabaseAdmin
        .from("twitter_campaign_participants")
        .select("*", { count: "exact", head: true })
        .eq("contest_id", contestId)
        .eq("is_active", true);
      const BATCH_SIZE = 5;
      const participantCount = count ?? 0;
      const totalBatches = Math.max(
        1,
        Math.ceil(participantCount / BATCH_SIZE)
      );
      let job:
        | {
            contestId: string;
            isRaid: true;
            batchIndex?: number;
            totalBatches?: number;
          }
        | {
            contestId: string;
            isRaid: false;
            batchIndex: number;
            totalBatches: number;
          };
      if (isRaidCampaign) {
        job = {
          contestId,
          isRaid: true,
          batchIndex: 0,
          totalBatches,
        };
      } else {
        job = { contestId, isRaid: false, batchIndex: 0, totalBatches };
      }

      const enqueueResult = await enqueueMetricsRefreshJob(job);
      if (enqueueResult.error) {
        console.error(
          `[twitter-refresh-feed] Enqueue failed for ${contestId}:`,
          enqueueResult.error
        );
        // Fall through to sync refresh below
      } else {
        console.log(
          `[twitter-refresh-feed] Enqueued job for contest ${contestId} (full refresh)`
        );
        const host = request.headers.get("host");
        const protocol = request.headers.get("x-forwarded-proto") || "http";
        const baseUrl = host ? `${protocol}://${host}` : "";
        if (baseUrl) {
          const doFetch = () =>
            fetch(`${baseUrl}/api/cron/process-metrics-queue`, {
              method: "POST",
              headers: process.env.CRON_SECRET
                ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
                : {},
            }).catch((e) =>
              console.warn(
                "[twitter-refresh-feed] Trigger process-metrics-queue failed:",
                e
              )
            );
          if (isQStashEnabled()) {
            triggerProcessMetricsQueue(baseUrl)
              .then((res) => {
                if (res?.error) {
                  doFetch();
                } else if (res?.messageId) {
                  console.log(
                    "[twitter-refresh-feed] QStash trigger sent messageId=",
                    res.messageId
                  );
                }
              })
              .catch(() => doFetch());
          } else {
            doFetch();
          }
        }
        return NextResponse.json({
          success: true,
          queued: true,
          message:
            "Feed refresh started in background. Page will reload when done.",
          contestId,
          contestTitle: contest.title,
          nextRefreshAvailable: new Date(
            now.getTime() +
              (isAdmin
                ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
                : METRICS_REFRESH_COOLDOWN_MS_BRAND)
          ).toISOString(),
          lastMetricsUpdated: contest.last_metrics_updated || null,
        });
      }
    }

    // Sync path: creator-only or queue disabled
    const baseUrl = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const refreshUrl = `${protocol}://${baseUrl}/api/contests/${contestId}/twitter-refresh-tweets`;
    const body: { creatorId?: string } = creatorOnly
      ? { creatorId: user.id }
      : {};

    console.log(
      `Manual feed refresh triggered for contest ${contestId} (${
        contest.title
      })${creatorOnly ? ` creatorOnly=${user.id}` : " sync"}`
    );

    const cookieHeader = request.headers.get("cookie");
    const refreshResponse = await fetch(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error(
        `Twitter refresh failed for contest ${contestId}:`,
        errorText
      );
      return NextResponse.json(
        {
          error: "Failed to refresh Twitter feed",
        },
        { status: 500 }
      );
    }

    const refreshResult = await refreshResponse.json();
    console.log(`Successfully refreshed Twitter feed for contest ${contestId}`);

    const { data: updatedContest } = await supabase
      .from("contests")
      .select("last_metrics_updated")
      .eq("id", contestId)
      .single();

    return NextResponse.json({
      success: true,
      message: "Twitter feed refreshed successfully",
      contestId,
      contestTitle: contest.title,
      nextRefreshAvailable: new Date(
        now.getTime() +
          (creatorOnly
            ? METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES
            : isAdmin
            ? METRICS_REFRESH_COOLDOWN_MS_ADMIN
            : isOwner
            ? METRICS_REFRESH_COOLDOWN_MS_BRAND
            : METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES)
      ).toISOString(),
      lastMetricsUpdated: updatedContest?.last_metrics_updated || null,
      refreshResult,
    });
  } catch (error: any) {
    console.error("Error in twitter-refresh-feed API:", error);
    return NextResponse.json(
      { error: `Refresh failed: ${error.message}` },
      { status: 500 }
    );
  }
}

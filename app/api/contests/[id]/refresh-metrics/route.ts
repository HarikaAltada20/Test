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
  getMissingQueueEnv,
  enqueueMetricsRefreshJob,
} from "@/lib/queue/metrics-refresh-queue";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const refreshMetricsStartMs = Date.now();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const resolvedParams = await params;
    const contestId = resolvedParams.id;
    const now = new Date();

    // Get contest details including last metrics update time and Twitter campaign type (for queue)
    const { data: contest, error: contestError } = await supabase
      .from("contests")
      .select(
        "id, title, platform, advertiser_id, last_metrics_updated, post_contest_status, contest_based_details"
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    // Hard lock: once in review, verification complete, or payouts processed, do not refresh
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

    // Check if user has access (either owns the contest, is admin, or is viewing opportunities)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const isOwner = contest.advertiser_id === authUser?.id;

    // Check if user is admin
    const { isAdmin } = await verifyAdminAccess();

    // For opportunities side, we'll allow any authenticated user to refresh
    // For owner side, we'll check ownership or admin status
    const isOpportunitiesRefresh =
      request.headers.get("x-refresh-source") === "opportunities";

    if (!isOpportunitiesRefresh && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine cooldown period based on user type
    const cooldownMs = isOpportunitiesRefresh
      ? METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES // 60 minutes (1 hour) for creators
      : isAdmin
      ? METRICS_REFRESH_COOLDOWN_MS_ADMIN // 1 minute for admins
      : METRICS_REFRESH_COOLDOWN_MS_BRAND; // 3 minutes for brands/advertisers

    // Database-based rate limiting using last_metrics_updated
    if (contest.last_metrics_updated) {
      const lastUpdate = new Date(contest.last_metrics_updated);
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();

      if (timeSinceLastUpdate < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastUpdate;
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        const userType = isOpportunitiesRefresh
          ? "creators"
          : isAdmin
          ? "admins"
          : "brands/owners";
        return NextResponse.json(
          {
            error: `Metrics were updated ${Math.floor(
              timeSinceLastUpdate / 1000 / 60
            )} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
            nextRefreshAvailable: new Date(
              lastUpdate.getTime() + cooldownMs
            ).toISOString(),
            userType,
          },
          { status: 429 }
        );
      }
    }

    // Determine which cron job to call based on platform
    let cronEndpoint: string;
    let cronName: string;
    let isTwitter = false;

    switch (contest.platform?.toLowerCase()) {
      case "instagram":
        cronEndpoint = "/api/cron/update-instagram-insights";
        cronName = "Instagram Insights";
        break;
      case "youtube":
        cronEndpoint = "/api/cron/update-youtube-metrics";
        cronName = "YouTube Metrics";
        break;
      case "twitter":
      case "x":
        isTwitter = true;
        cronEndpoint = `/api/contests/${contestId}/twitter-refresh-tweets`;
        cronName = "Twitter Metrics";
        break;
      default:
        return NextResponse.json(
          {
            error: `Metrics refresh not supported for platform: ${contest.platform}`,
          },
          { status: 400 }
        );
    }

    // Twitter: use Upstash Redis + QStash queue when configured to avoid Vercel timeout (100+ participants, 1000+ tweets)
    const queueEnabled = isMetricsQueueEnabled();
    const useQueue = isTwitter && queueEnabled;
    if (isTwitter) {
      const why = queueEnabled
        ? "using queue (background refresh)"
        : `queue not configured (missing: ${getMissingQueueEnv().join(
            ", "
          )}), using sync`;
      console.log(
        `[metrics-refresh-queue] Twitter refresh for contest ${contestId}: ${why}`
      );
    }
    if (useQueue) {
      const protocol = request.headers.get("x-forwarded-proto") || "http";
      const host = request.headers.get("host");
      const baseUrl = host
        ? `${protocol}://${host}`
        : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "";

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

      // Raid → enqueue job for fetch-raid-engagements. Awareness → enqueue job for twitter-refresh-tweets.
      let job: Parameters<typeof enqueueMetricsRefreshJob>[0];
      if (isRaidCampaign) {
        job = { contestId, isRaid: true };
      } else {
        const supabaseAdmin = createAdminSupabaseClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { count } = await supabaseAdmin
          .from("twitter_campaign_participants")
          .select("*", { count: "exact", head: true })
          .eq("contest_id", contestId)
          .eq("is_active", true);
        const participantCount = count ?? 0;
        const BATCH_SIZE = 20;
        const totalBatches = Math.max(
          1,
          Math.ceil(participantCount / BATCH_SIZE)
        );
        job = { contestId, isRaid: false, batchIndex: 0, totalBatches };
      }

      console.log(
        `[metrics-refresh-queue] Enqueueing job for contest ${contestId}`,
        job
      );
      const enqueueResult = await enqueueMetricsRefreshJob(job);
      if (enqueueResult.error) {
        console.error(
          `[metrics-refresh-queue] Enqueue failed for contest ${contestId}:`,
          enqueueResult.error
        );
        return NextResponse.json(
          {
            error: `Failed to start metrics refresh: ${enqueueResult.error}`,
          },
          { status: 500 }
        );
      }

      const enqueueElapsedMs = Date.now() - refreshMetricsStartMs;
      console.log(
        `[refresh-metrics] contestId=${contestId} enqueued in ${enqueueElapsedMs}ms - ${cronName} - Source: ${isOpportunitiesRefresh ? "Opportunities" : "Owner"}`
      );
      // Trigger processor once so first job runs soon (cron will process remaining batches)
      const processUrl = `${baseUrl}/api/cron/process-metrics-queue`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          ...(process.env.CRON_SECRET
            ? { Authorization: `Bearer ${process.env.CRON_SECRET}` }
            : {}),
        },
      }).catch((e) =>
        console.warn("[metrics-refresh-queue] Trigger process-metrics-queue failed:", e)
      );

      return NextResponse.json({
        success: true,
        queued: true,
        message: "Refresh started in background. Metrics will update shortly.",
        contestId,
        contestTitle: contest.title,
        platform: contest.platform,
        nextRefreshAvailable: new Date(
          now.getTime() + cooldownMs
        ).toISOString(),
        timeSinceLastUpdate: contest.last_metrics_updated
          ? Math.floor(
              (now.getTime() -
                new Date(contest.last_metrics_updated).getTime()) /
                1000 /
                60
            )
          : null,
        messageId: enqueueResult.messageId,
      });
    }

    // Sync path: call the appropriate cron job or endpoint
    const baseUrl = request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || "http";

    let cronUrl: string;
    if (isTwitter) {
      cronUrl = `${protocol}://${baseUrl}${cronEndpoint}`;
    } else {
      cronUrl = `${protocol}://${baseUrl}${cronEndpoint}?contestId=${contestId}`;
    }

    console.log(
      `[refresh-metrics] contestId=${contestId} starting sync refresh - ${cronName} - Source: ${
        isOpportunitiesRefresh ? "Opportunities" : "Owner"
      }`
    );

    const cookieHeader = request.headers.get("cookie");
    const cronResponse = await fetch(cronUrl, {
      method: isTwitter ? "POST" : "GET",
      headers: {
        ...(isTwitter
          ? {}
          : { Authorization: `Bearer ${process.env.CRON_SECRET}` }),
        "Content-Type": "application/json",
        ...(isTwitter ? {} : { "X-Contest-Id": contestId }),
        ...(isTwitter && cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!cronResponse.ok) {
      const errorText = await cronResponse.text();
      console.error(`Cron job failed for contest ${contestId}:`, errorText);
      return NextResponse.json(
        {
          error: `Failed to refresh ${cronName.toLowerCase()}`,
        },
        { status: 500 }
      );
    }

    const cronResult = await cronResponse.json();
    const currentTime = new Date().toISOString();

    const supabaseAdmin = createAdminSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("contests")
      .update({ last_metrics_updated: currentTime })
      .eq("id", contestId)
      .select();

    if (updateError) {
      console.error(
        `Failed to update last_metrics_updated for contest ${contestId}:`,
        updateError
      );
    } else {
      console.log(
        `Successfully updated last_metrics_updated for contest ${contestId} to ${currentTime}`
      );
    }

    const syncElapsedMs = Date.now() - refreshMetricsStartMs;
    console.log(
      `[refresh-metrics] contestId=${contestId} sync refresh completed in ${syncElapsedMs}ms`
    );

    return NextResponse.json({
      success: true,
      message: `${cronName} refreshed successfully`,
      contestId,
      contestTitle: contest.title,
      platform: contest.platform,
      nextRefreshAvailable: new Date(now.getTime() + cooldownMs).toISOString(),
      timeSinceLastUpdate: contest.last_metrics_updated
        ? Math.floor(
            (now.getTime() - new Date(contest.last_metrics_updated).getTime()) /
              1000 /
              60
          )
        : null,
      lastMetricsUpdated: currentTime,
      cronResult,
    });
  } catch (error: any) {
    const errorElapsedMs = Date.now() - refreshMetricsStartMs;
    console.error(
      `[refresh-metrics] Error after ${errorElapsedMs}ms:`,
      error
    );
    return NextResponse.json(
      { error: `Refresh failed: ${error.message}` },
      { status: 500 }
    );
  }
}

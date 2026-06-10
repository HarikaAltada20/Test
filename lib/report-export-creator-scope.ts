import type { PlatformMetrics } from "@/lib/submission-leaderboard-export";

function normalizeExportSubmissionStatus(
  submission: Record<string, unknown>,
  getStatus: (submission: Record<string, unknown>) => string,
): string {
  const isTwitter = submission.is_twitter_tweet === true;
  const raw = isTwitter
    ? String(
        submission.moderation_status || submission.status || "pending",
      ).toLowerCase()
    : getStatus(submission).toLowerCase();

  if (!isTwitter) return raw;

  if (raw === "approved" || raw === "verified" || raw === "paid") {
    return submission.paid === true || raw === "paid" ? "paid" : "verified";
  }
  if (raw === "rejected") return "rejected";
  return "pending";
}

function accumulateCreatorMetrics(
  metrics: Record<string, number>,
  submission: Record<string, unknown>,
  getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics,
): void {
  const isTwitter = submission.is_twitter_tweet === true;

  if (isTwitter) {
    const stats = (submission.other_stats || {}) as Record<string, unknown>;
    metrics.likes += Number(stats.likes) || 0;
    metrics.comments += Number(stats.replies) || 0;
    metrics.retweets += Number(stats.retweets) || 0;
    metrics.quote_reposts += Number(stats.quote_reposts) || 0;
    metrics.impressions += Number(stats.impressions) || 0;
    metrics.base_points += Number(stats.base_points) || 0;
    metrics.points += Number(stats.points) || 0;
    metrics.tweet_manual_points_adjustment +=
      Number(
        submission.manual_points_adjustment ?? stats.manual_points_adjustment,
      ) || 0;
    return;
  }

  const platformMetrics = (getMetrics?.(submission) ?? {}) as Record<
    string,
    unknown
  >;
  metrics.views += Number(platformMetrics.views) || 0;
  metrics.likes += Number(platformMetrics.likes) || 0;
  metrics.comments += Number(platformMetrics.comments) || 0;
  metrics.shares += Number(platformMetrics.shares) || 0;
  metrics.saves += Number(platformMetrics.saves) || 0;
  metrics.reach += Number(platformMetrics.reach) || 0;
  metrics.interactions +=
    Number(platformMetrics.total_interactions ?? platformMetrics.interactions) ||
    0;
  metrics.avg_watch_time_ms += Number(platformMetrics.avg_watch_time_ms) || 0;
  metrics.total_watch_time_ms +=
    Number(platformMetrics.total_watch_time_ms) || 0;

  const stats = (submission.other_stats || {}) as Record<string, unknown>;
  metrics.base_points += Number(stats.base_points) || 0;
  metrics.points += Number(stats.points) || 0;
}

function rebuildCreatorGroupForScopedSubmissions(
  template: Record<string, unknown>,
  scopedSubmissions: Record<string, unknown>[],
  getStatus: (submission: Record<string, unknown>) => string,
  getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics,
  getExpectedCents?: (submission: Record<string, unknown>) => number,
): Record<string, unknown> {
  const templateMetrics = (template.metrics || {}) as Record<string, unknown>;
  const creatorManual =
    Number(templateMetrics.creator_manual_points_adjustment) || 0;

  const statusCounts = {
    all: 0,
    verified: 0,
    paid: 0,
    pending: 0,
    rejected: 0,
    verified_paid: 0,
  };
  const insightsCounts = {
    ok: 0,
    temporary_failure: 0,
    permanent_failure: 0,
    never: 0,
  };
  const metrics: Record<string, number> = {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    reach: 0,
    interactions: 0,
    avg_watch_time_ms: 0,
    total_watch_time_ms: 0,
    retweets: 0,
    quote_reposts: 0,
    impressions: 0,
    points: 0,
    base_points: 0,
    manual_points_adjustment: creatorManual,
    creator_manual_points_adjustment: creatorManual,
    tweet_manual_points_adjustment: 0,
  };

  let earningsExpected = 0;
  let earningsGranted = 0;
  let bonusExpected = 0;
  let bonusGranted = 0;
  let paid = false;
  let firstSubmittedAt = String(template.firstSubmittedAt || "");

  for (const submission of scopedSubmissions) {
    statusCounts.all++;
    const status = normalizeExportSubmissionStatus(submission, getStatus);

    if (status === "paid" || submission.paid === true) {
      statusCounts.paid++;
      paid = true;
    } else if (status === "verified") {
      statusCounts.verified++;
    } else if (status === "pending") {
      statusCounts.pending++;
    } else if (status === "rejected") {
      statusCounts.rejected++;
    }

    if (submission.paid === true) {
      statusCounts.verified_paid++;
    }

    const insightsStatus = String(submission.insights_status ?? "");
    if (insightsStatus === "ok") insightsCounts.ok++;
    else if (insightsStatus === "temporary_failure") {
      insightsCounts.temporary_failure++;
    } else if (insightsStatus === "permanent_failure") {
      insightsCounts.permanent_failure++;
    } else {
      insightsCounts.never++;
    }

    accumulateCreatorMetrics(metrics, submission, getMetrics);

    if (getExpectedCents) {
      earningsExpected += getExpectedCents(submission);
    }

    if (status === "paid" || submission.paid === true) {
      earningsGranted += Number(submission.earnings) || 0;
    }

    if (submission.bonus_paid === true) {
      bonusGranted += Number(submission.bonus_amount) || 0;
    } else if (status === "verified" || status === "paid") {
      bonusExpected += Number(submission.bonus_amount) || 0;
    }

    const createdAt = String(submission.created_at || "");
    if (createdAt && (!firstSubmittedAt || createdAt < firstSubmittedAt)) {
      firstSubmittedAt = createdAt;
    }
  }

  metrics.manual_points_adjustment =
    creatorManual + metrics.tweet_manual_points_adjustment;

  return {
    ...template,
    submissions: scopedSubmissions,
    totalCount: scopedSubmissions.length,
    statusCounts,
    insightsCounts,
    metrics: {
      ...templateMetrics,
      ...metrics,
      manual_points_reason: templateMetrics.manual_points_reason ?? null,
    },
    earnings: { expected: earningsExpected, granted: earningsGranted },
    bonus: { expected: bonusExpected, granted: bonusGranted },
    paid,
    firstSubmittedAt,
  };
}

/** Rebuild creator-wise export rows using only submissions in the selected data scope. */
export function scopeCreatorGroupsForReportExport(
  creatorGroups: Record<string, unknown>[],
  scopedSubmissions: Record<string, unknown>[],
  opts: {
    getStatus: (submission: Record<string, unknown>) => string;
    getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics;
    getExpectedCents?: (submission: Record<string, unknown>) => number;
  },
): Record<string, unknown>[] {
  const submissionsByCreator = new Map<string, Record<string, unknown>[]>();
  const templateByCreator = new Map<string, Record<string, unknown>>();

  for (const group of creatorGroups) {
    const creatorId = String(
      (group.creator as { id?: string } | undefined)?.id ?? "",
    ).trim();
    if (creatorId) templateByCreator.set(creatorId, group);
  }

  for (const submission of scopedSubmissions) {
    const creatorId = String(submission.creator_id ?? "").trim();
    if (!creatorId) continue;
    const bucket = submissionsByCreator.get(creatorId) ?? [];
    bucket.push(submission);
    submissionsByCreator.set(creatorId, bucket);
  }

  const scopedGroups: Record<string, unknown>[] = [];

  for (const [creatorId, scopedSubs] of submissionsByCreator) {
    const template =
      templateByCreator.get(creatorId) ??
      buildMinimalCreatorGroupTemplate(scopedSubs[0]!);

    scopedGroups.push(
      rebuildCreatorGroupForScopedSubmissions(
        template,
        scopedSubs,
        opts.getStatus,
        opts.getMetrics,
        opts.getExpectedCents,
      ),
    );
  }

  return scopedGroups;
}

function buildMinimalCreatorGroupTemplate(
  submission: Record<string, unknown>,
): Record<string, unknown> {
  const creator = (submission.creator || {}) as Record<string, unknown>;
  return {
    creator: {
      id: submission.creator_id,
      username:
        submission.creator_username ||
        submission.user_username ||
        creator.username ||
        "Unknown",
      profile_picture_url: creator.profile_picture_url ?? null,
      full_name: creator.full_name ?? null,
    },
    instagram_archive:
      submission.creator_instagram_archive ?? creator.instagram_archive ?? null,
    submissions: [],
    totalCount: 0,
    statusCounts: {
      all: 0,
      verified: 0,
      paid: 0,
      pending: 0,
      rejected: 0,
      verified_paid: 0,
    },
    insightsCounts: {
      ok: 0,
      temporary_failure: 0,
      permanent_failure: 0,
      never: 0,
    },
    metrics: {},
    earnings: { expected: 0, granted: 0 },
    bonus: { expected: 0, granted: 0 },
    firstSubmittedAt: submission.created_at,
  };
}

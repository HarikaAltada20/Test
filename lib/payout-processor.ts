import { createAdminClient } from "@/utils/supabase/admin";
import { MetricsService } from "@/lib/metrics-service";
import {
  creditCreatorWithdrawableBalance,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import { computeCpmRawCentsForRow } from "@/lib/cpm-expected-cents";
import {
  isKeyedMaxEarningsMap,
  resolveMaxEarningsCentsForSubmission,
} from "@/lib/video-platform-campaigns";
import {
  acquireCreatorContestPayoutLease,
  releaseCreatorContestPayoutLease,
  type CreatorContestPayoutLease,
} from "@/lib/creator-contest-payout-lease";

export interface PayoutJobResult {
  id: string;
  status: "done" | "error";
  error?: string;
}

// Processes up to batchSize queued payout jobs. Returns per-job results.
export async function processQueuedPayouts(
  batchSize: number = 10,
): Promise<PayoutJobResult[]> {
  const supabaseAdmin = createAdminClient();

  const { data: jobs, error: jobsErr } = await supabaseAdmin
    .from("payout_jobs")
    .select("id, submission_id, requested_by, payload, status, created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (jobsErr) {
    throw new Error(`Failed to load jobs: ${jobsErr.message}`);
  }

  if (!jobs || jobs.length === 0) {
    return [];
  }

  const results: PayoutJobResult[] = [];

  for (const job of jobs) {
    let payoutLease: CreatorContestPayoutLease | null = null;
    try {
      const { data: claimedJob, error: claimErr } = await supabaseAdmin
        .from("payout_jobs")
        .update({ status: "processing" })
        .eq("id", job.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();
      if (claimErr) {
        throw new Error(`Failed to claim job: ${claimErr.message}`);
      }
      if (!claimedJob) {
        results.push({ id: job.id, status: "done" });
        continue;
      }

      // Load submission + contest
      const { data: sub, error: subErr } = await supabaseAdmin
        .from("submissions")
        .select("id, contest_id, creator_id, status, earnings, views, platform")
        .eq("id", job.submission_id)
        .single();
      if (subErr || !sub)
        throw new Error(`Submission not found: ${subErr?.message || ""}`);

      const { data: contest, error: contestErr } = await supabaseAdmin
        .from("contests")
        .select(
          "title, contest_type, contest_format, platform, contest_based_details, max_earnings_per_creator",
        )
        .eq("id", sub.contest_id)
        .single();
      if (contestErr || !contest)
        throw new Error(`Contest not found: ${contestErr?.message || ""}`);

      if (
        (contest as { contest_type?: string }).contest_type === "dual_rewards"
      ) {
        throw new Error(
          "Dual rewards contests require per-component payout via admin verify-submission; queued payout jobs are not supported.",
        );
      }

      if (isTwitterTextImageLeaderboardContest(contest)) {
        throw new Error(
          "Twitter text/image leaderboard contests must be paid via the Twitter creator payout APIs, not queued payout jobs.",
        );
      }

      const leaseResult = await acquireCreatorContestPayoutLease({
        contestId: String(sub.contest_id),
        creatorId: String(sub.creator_id),
      });
      if (!leaseResult.ok) {
        if (leaseResult.busy) {
          await supabaseAdmin
            .from("payout_jobs")
            .update({ status: "queued" })
            .eq("id", job.id)
            .eq("status", "processing");
          results.push({
            id: job.id,
            status: "error",
            error: leaseResult.error,
          });
          continue;
        }
        throw new Error(leaseResult.error);
      }
      payoutLease = leaseResult.lease;

      // Compute reward amount with support for custom payload
      let rewardAmount = sub.earnings || 0; // cents
      let payoutType: "custom" | "standard" = "standard";

      // Parse job payload
      let payload: any = (job as any)?.payload;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = undefined;
        }
      }

      if (
        payload?.isCustom &&
        typeof payload?.amountInCents === "number" &&
        payload.amountInCents > 0
      ) {
        rewardAmount = payload.amountInCents;
        payoutType = "custom";
      }

      if (!rewardAmount || rewardAmount <= 0) {
        if ((contest as any).contest_type === "cpm") {
          rewardAmount = computeCpmRawCentsForRow(
            {
              views: sub.views,
              platform: (sub as any).platform,
              other_stats: (sub as any).other_stats,
            },
            ((contest as any)?.contest_based_details as Record<
              string,
              unknown
            >) || null,
            (contest as any)?.platform,
          );
        } else if ((contest as any).contest_type === "leaderboard") {
          const {
            applyCreatorMaxEarningsCapCents,
            computeNonTwitterLeaderboardSubmissionPrizeCents,
          } = await import("@/lib/non-twitter-leaderboard-creator-prize");
          const { fetchContestSubmissionsAllPages } =
            await import("@/lib/fetch-contest-submissions");
          const prizes =
            (contest as any)?.contest_based_details?.leaderboard_contest
              ?.prizes || [];
          const prizeResult =
            await computeNonTwitterLeaderboardSubmissionPrizeCents({
              supabaseAdmin,
              contestId: sub.contest_id,
              submissionId: sub.id,
              views: sub.views,
              platform: (sub as any).platform,
              prizes,
              contestBasedDetails:
                ((contest as any)?.contest_based_details as Record<
                  string,
                  unknown
                >) || null,
              contestPlatform: (contest as any)?.platform,
            });
          if (prizeResult.error) {
            throw new Error(
              `Failed to compute leaderboard prize: ${prizeResult.error}`,
            );
          }
          rewardAmount = prizeResult.prizeCents;
          const maxEarningsPerCreator = resolveMaxEarningsCentsForSubmission(
            contest as any,
            (sub as any).platform,
          );
          if (rewardAmount > 0 && maxEarningsPerCreator && maxEarningsPerCreator > 0) {
            const { data: paidRowsForCap, error: paidRowsForCapErr } =
              await fetchContestSubmissionsAllPages(
                supabaseAdmin,
                sub.contest_id,
                "earnings, paid, platform",
                {
                  creatorId: sub.creator_id,
                  paid: true,
                  order: { column: "created_at", ascending: true },
                },
              );
            if (paidRowsForCapErr) {
              throw new Error(
                `Failed to load creator paid earnings for cap: ${String(
                  (paidRowsForCapErr as { message?: string })?.message ??
                    paidRowsForCapErr,
                )}`,
              );
            }
            const alreadyPaidCents = (
              (paidRowsForCap || []) as Array<{
                earnings?: number | null;
                paid?: boolean | null;
                platform?: string | null;
              }>
            ).reduce((sum, row) => {
              if (row.paid !== true) return sum;
              if (
                isKeyedMaxEarningsMap((contest as any).max_earnings_per_creator) &&
                String(row.platform || "").toLowerCase() !==
                  String((sub as any).platform || "").toLowerCase()
              ) {
                return sum;
              }
              return sum + Math.max(0, Number(row.earnings) || 0);
            }, 0);
            rewardAmount = applyCreatorMaxEarningsCapCents({
              amountCents: rewardAmount,
              alreadyPaidCents,
              maxEarningsCents: maxEarningsPerCreator,
            });
          }
        }
      }

      if (rewardAmount > 0) {
        // 1) Idempotency-safe wallet crediting
        // Determine payout cycle based on prior rewards/refunds for this submission
        const [{ data: existingRewards }, { data: existingRefunds }] =
          await Promise.all([
            supabaseAdmin
              .from("money_transactions")
              .select("id")
              .eq("user_id", sub.creator_id)
              .eq("type", "reward")
              .contains("metadata", { submission_id: sub.id }),
            supabaseAdmin
              .from("money_transactions")
              .select("id, remarks")
              .eq("user_id", sub.creator_id)
              .eq("type", "refund")
              .contains("metadata", { submission_id: sub.id }),
          ] as any);

        const rewardsCount = (existingRewards || []).length;
        const refundsCount =
          (existingRefunds || [])?.filter(
            (r: any) => !r.remarks || r.remarks === REVERSAL_TRANSACTION_REMARK,
          ).length || 0;
        const nextCycle =
          rewardsCount > refundsCount ? rewardsCount : rewardsCount + 1;

        // Avoid duplicate reward for the same cycle
        const { data: rewardInThisCycle } = await supabaseAdmin
          .from("money_transactions")
          .select("id")
          .eq("user_id", sub.creator_id)
          .eq("type", "reward")
          .contains("metadata", {
            submission_id: sub.id,
            payout_cycle: nextCycle,
          });

        if (!rewardInThisCycle || rewardInThisCycle.length === 0) {
          const customRemarks = payload?.customRemarks as string | undefined;
          const contestRewardIdempotencyKey =
            payoutType === "custom"
              ? `contest_reward:v1:${sub.id}:cycle:${nextCycle}:amt:${rewardAmount}`
              : `contest_reward:v1:${sub.id}:cycle:${nextCycle}`;
          const creditRes = await creditCreatorWithdrawableBalance(
            sub.creator_id,
            rewardAmount,
            payoutType === "custom"
              ? `Custom contest payment credited - ${(contest as any)?.title || "Contest"}`
              : `Contest reward credited - ${(contest as any)?.title || "Contest"}`,
            {
              idempotencyKey: contestRewardIdempotencyKey,
              remarks:
                customRemarks ||
                (payoutType === "custom"
                  ? "Custom payout credited to creator wallet"
                  : "Standard payout credited to creator wallet"),
              metadata: {
                contest_id: sub.contest_id,
                submission_id: sub.id,
                payout_type: payoutType,
                payout_cycle: nextCycle,
              },
            },
          );
          if (!creditRes.success) {
            throw new Error(
              `Failed to credit creator wallet: ${creditRes.error}`,
            );
          }
        }

        // 2) Mark submission paid only after the wallet credit is known to be safe.
        const paidAt = new Date().toISOString();
        const { error: paidUpdateErr } = await supabaseAdmin
          .from("submissions")
          .update({
            earnings: rewardAmount,
            status: "paid",
            paid: true,
            paid_at: paidAt,
          })
          .eq("id", sub.id);
        if (paidUpdateErr) {
          throw new Error(
            `Reward credited but failed to mark submission paid: ${paidUpdateErr.message}`,
          );
        }

        // 3) Metrics are now updated automatically by database triggers when status changes to 'paid'
        // No need to manually call MetricsService.incrementSubmissionWin() here
        // The trigger on submissions.status will handle it when we update status to 'paid' above
      }

      await supabaseAdmin
        .from("payout_jobs")
        .update({ status: "done", processed_at: new Date().toISOString() })
        .eq("id", job.id);

      results.push({ id: job.id, status: "done" });
    } catch (e: any) {
      const message = e?.message || "unknown error";
      await supabaseAdmin
        .from("payout_jobs")
        .update({
          status: "error",
          error: message,
          processed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      results.push({ id: job.id, status: "error", error: message });
    } finally {
      await releaseCreatorContestPayoutLease(payoutLease);
    }
  }

  return results;
}

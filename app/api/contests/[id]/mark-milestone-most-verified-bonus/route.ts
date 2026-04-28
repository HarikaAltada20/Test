import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { creditCreatorWithdrawableBalance } from "@/lib/payment-utils";
import { revalidateLeaderboardCache } from "@/lib/leaderboard-cache";
import {
  buildMilestoneMostVerifiedBonusByCreatorMap,
  type MilestoneBudgetSubmission,
} from "@/lib/milestone-contest-expected-spend";

function normalizeStatus(raw: string | null | undefined): string {
  const t = String(raw || "pending").toLowerCase();
  return t === "approved" ? "verified" : t;
}

function isVerifiedLike(st: string): boolean {
  return st === "verified" || st === "paid" || st === "approved";
}

/**
 * POST /api/contests/[id]/mark-milestone-most-verified-bonus
 * Admin: credit creator wallet and record bonus_amount on a submission for
 * milestone "most verified views" or "most verified reels" winner payout.
 *
 * Body: { creatorId: string, track: "views" | "reels" }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: contestId } = await params;
    const body = await request.json();
    const creatorId = body?.creatorId as string | undefined;
    const track = body?.track as "views" | "reels" | undefined;

    if (!creatorId || (track !== "views" && track !== "reels")) {
      return NextResponse.json(
        { error: "creatorId and track ('views' | 'reels') are required" },
        { status: 400 },
      );
    }

    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: contest, error: contestError } = await supabaseAdmin
      .from("contests")
      .select(
        "id, title, contest_type, contest_based_details, post_contest_status",
      )
      .eq("id", contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: "Contest not found" }, { status: 404 });
    }

    if (contest.contest_type !== "milestone") {
      return NextResponse.json(
        { error: "Contest is not a milestone contest" },
        { status: 400 },
      );
    }

    if (contest.post_contest_status !== "verification_complete") {
      return NextResponse.json(
        {
          error:
            "Most verified milestone bonuses can only be marked when contest post-status is verification_complete",
        },
        { status: 400 },
      );
    }

    const bonus = (contest.contest_based_details as any)?.milestone_contest
      ?.bonus;
    if (!bonus?.enabled) {
      return NextResponse.json(
        { error: "Milestone bonus is not enabled for this contest" },
        { status: 400 },
      );
    }

    const { data: subs, error: subsError } = await supabaseAdmin
      .from("submissions")
      .select(
        "id, creator_id, status, views, created_at, bonus_paid, bonus_amount, milestone_bonus_paid, metadata",
      )
      .eq("contest_id", contestId);

    if (subsError) {
      return NextResponse.json(
        { error: subsError.message || "Failed to load submissions" },
        { status: 500 },
      );
    }

    const submissions = (subs || []) as MilestoneBudgetSubmission[];
    const map = buildMilestoneMostVerifiedBonusByCreatorMap(submissions, bonus);
    const row = map.get(creatorId);
    if (!row) {
      return NextResponse.json(
        { error: "No bonus data for this creator" },
        { status: 400 },
      );
    }

    const V = row.viewsExpectedCents;
    const R = row.expectedCents;

    const { data: paidRewards, error: paidRewardsError } = await supabaseAdmin
      .from("money_transactions")
      .select("amount, metadata")
      .eq("user_id", creatorId)
      .eq("type", "reward")
      .eq("status", "success")
      .contains("metadata", { contest_id: contestId });

    if (paidRewardsError) {
      return NextResponse.json(
        {
          error:
            paidRewardsError.message ||
            "Failed to load creator reward history for milestone bonus",
        },
        { status: 500 },
      );
    }

    const viewsBonusType = "milestone_most_verified_views";
    const reelsBonusType = "milestone_most_verified_reels";
    const paidByTrack = (paidRewards || []).reduce(
      (sum, tx: any) => {
        const bt = String(tx?.metadata?.bonus_type || "");
        const amt = Number(tx?.amount) || 0;
        if (bt === viewsBonusType) sum.views += amt;
        if (bt === reelsBonusType) sum.reels += amt;
        return sum;
      },
      { views: 0, reels: 0 },
    );

    let creditCents = 0;
    if (track === "views") {
      if (V <= 0) {
        return NextResponse.json(
          { error: "This creator is not eligible for the most verified views bonus" },
          { status: 400 },
        );
      }
      const viewsPaid = Math.min(paidByTrack.views, V);
      creditCents = Math.max(0, V - viewsPaid);
    } else {
      if (R <= 0) {
        return NextResponse.json(
          { error: "This creator is not eligible for the most verified reels bonus" },
          { status: 400 },
        );
      }
      const paidReels = Math.min(paidByTrack.reels, R);
      creditCents = Math.max(0, R - paidReels);
    }

    if (creditCents <= 0) {
      return NextResponse.json(
        { error: "Nothing to pay for this track (already recorded as paid)" },
        { status: 400 },
      );
    }

    const creatorSubs = (subs || []).filter(
      (s: any) => s.creator_id === creatorId,
    );

    const verifiedLike = creatorSubs.filter((s: any) =>
      isVerifiedLike(normalizeStatus(s.status)),
    );

    const withBonus = creatorSubs.filter((s: any) => s.bonus_paid === true);
    let target: (typeof creatorSubs)[0] | undefined;
    if (withBonus.length > 0) {
      target = [...withBonus].sort(
        (a: any, b: any) =>
          (Number(b.bonus_amount) || 0) - (Number(a.bonus_amount) || 0),
      )[0];
    } else if (verifiedLike.length > 0) {
      target = [...verifiedLike].sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )[0];
    }

    if (!target) {
      return NextResponse.json(
        {
          error:
            "No verified submission found for this creator to attach the bonus record",
        },
        { status: 400 },
      );
    }

    const creditResult = await creditCreatorWithdrawableBalance(
      creatorId,
      creditCents,
      `Milestone most verified ${track === "views" ? "views" : "reels"} bonus — ${
        contest.title || "Contest"
      }`,
      {
        remarks: `Milestone most_verified_${track} bonus (contest ${contestId})`,
        metadata: {
          contest_id: contestId,
          bonus_type: `milestone_most_verified_${track}`,
          // Keep a track-specific submission key so this reward does not collide
          // with normal per-submission reward rows on ux_reward_per_submission_cycle.
          submission_id: `${target.id}:milestone_most_verified_${track}`,
          source_submission_id: target.id,
        },
      },
    );

    if (!creditResult.success) {
      return NextResponse.json(
        {
          error: creditResult.error || "Failed to credit creator balance",
        },
        { status: 500 },
      );
    }

    const prevAmount = target.bonus_paid
      ? Number(target.bonus_amount) || 0
      : 0;
    const prevMeta =
      target?.metadata && typeof target.metadata === "object"
        ? { ...target.metadata }
        : {};
    // Prefer the first-class column; fall back to legacy metadata during rollout.
    const prevTrackPaidRawFromColumn =
      (target as any)?.milestone_bonus_paid &&
      typeof (target as any).milestone_bonus_paid === "object"
        ? (target as any).milestone_bonus_paid
        : null;
    const prevTrackPaidRawFromMeta =
      prevMeta?.milestone_bonus_paid &&
      typeof prevMeta.milestone_bonus_paid === "object"
        ? prevMeta.milestone_bonus_paid
        : null;
    const prevTrackPaidRaw =
      prevTrackPaidRawFromColumn || prevTrackPaidRawFromMeta || {};
    const prevTrackPaid = {
      views: Number(prevTrackPaidRaw?.views || 0),
      reels: Number(prevTrackPaidRaw?.reels || 0),
    };
    const nextTrackPaid =
      track === "views"
        ? {
            views: prevTrackPaid.views + creditCents,
            reels: prevTrackPaid.reels,
          }
        : {
            views: prevTrackPaid.views,
            reels: prevTrackPaid.reels + creditCents,
          };

    // Remove the legacy key from metadata (the column is the source of truth now).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { milestone_bonus_paid: _legacyMilestoneBonusPaid, ...metaWithoutLegacy } =
      prevMeta || {};

    const { error: updErr } = await supabaseAdmin
      .from("submissions")
      .update({
        bonus_paid: true,
        bonus_paid_at: new Date().toISOString(),
        bonus_amount: prevAmount + creditCents,
        milestone_bonus_paid: nextTrackPaid,
        metadata: metaWithoutLegacy,
      })
      .eq("id", target.id);

    if (updErr) {
      return NextResponse.json(
        { error: updErr.message || "Failed to update submission bonus fields" },
        { status: 500 },
      );
    }
    revalidateLeaderboardCache(contestId);

    return NextResponse.json({
      success: true,
      creditedCents: creditCents,
      submissionId: target.id,
      track,
    });
  } catch (e: any) {
    console.error("[mark-milestone-most-verified-bonus]", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  debitCreatorReversalClawback,
  logTransactionAsAdmin,
  REVERSAL_TRANSACTION_REMARK,
} from "@/lib/payment-utils";
import {
  buildLedgerScopedReversalDebitIdempotencyKey,
  sortUniqueTransactionIds,
} from "@/lib/bulk-payment-rollback";
import { filterMoneyTxnsForContest } from "@/lib/dual-rewards-pool-budget";

export type TwitterTweetReversalRefund = {
  cpmCents: number;
  bonusCents: number;
  totalCents: number;
};

export type MoneyTxn = {
  id?: string | null;
  amount?: number | null;
  metadata?: Record<string, unknown> | null;
  remarks?: string | null;
};

function metaOf(tx: MoneyTxn): Record<string, unknown> {
  return tx?.metadata && typeof tx.metadata === "object" ? tx.metadata : {};
}

function isFlatFeeBonus(tx: MoneyTxn): boolean {
  return metaOf(tx).bonus_type === "flat_fee";
}

function isReversalRefund(tx: MoneyTxn): boolean {
  return !tx.remarks || tx.remarks === REVERSAL_TRANSACTION_REMARK;
}

function tweetIdMatches(tx: MoneyTxn, tweetId: string): boolean {
  const tweetIdRaw = metaOf(tx).tweet_id;
  return tweetIdRaw != null && String(tweetIdRaw) === tweetId;
}

function breakdownAmount(tx: MoneyTxn, key: string, tweetId: string): number {
  const breakdown = metaOf(tx)[key];
  if (!breakdown || typeof breakdown !== "object") return 0;
  const cents = Number((breakdown as Record<string, unknown>)[tweetId]);
  return Number.isFinite(cents) && cents > 0 ? cents : 0;
}

export function cpmAmountForTweet(tx: MoneyTxn, tweetId: string): number {
  if (isFlatFeeBonus(tx)) return 0;
  if (tweetIdMatches(tx, tweetId)) return Math.max(0, Number(tx.amount) || 0);
  return breakdownAmount(tx, "cpm_breakdown", tweetId);
}

export function bonusAmountForTweet(tx: MoneyTxn, tweetId: string): number {
  if (tweetIdMatches(tx, tweetId) && isFlatFeeBonus(tx)) {
    return Math.max(0, Number(tx.amount) || 0);
  }
  const bulkBonus = breakdownAmount(tx, "twitter_bulk_bonus_breakdown", tweetId);
  if (bulkBonus > 0) return bulkBonus;
  if (!isFlatFeeBonus(tx)) return 0;
  return 0;
}

function hasCpmBreakdown(tx: MoneyTxn): boolean {
  const breakdown = metaOf(tx).cpm_breakdown;
  return Boolean(breakdown && typeof breakdown === "object");
}

function hasBonusBreakdown(tx: MoneyTxn): boolean {
  const breakdown = metaOf(tx).twitter_bulk_bonus_breakdown;
  return Boolean(breakdown && typeof breakdown === "object");
}

/** Creator-level main reward/refund: no tweet_id and no per-tweet CPM breakdown. */
export function isCreatorLevelMainTxn(tx: MoneyTxn): boolean {
  const m = metaOf(tx);
  if (m.tweet_id != null && String(m.tweet_id) !== "") {
    return false;
  }
  if (isFlatFeeBonus(tx)) return false;
  if (hasCpmBreakdown(tx)) return false;
  const payoutType = String(m.payout_type || "");
  if (m.twitter_creator_id != null && String(m.twitter_creator_id) !== "") {
    return true;
  }
  return (
    payoutType === "twitter_cpm_creator" ||
    payoutType === "standard" ||
    payoutType === "custom" ||
    payoutType === "twitter_creator_rollback"
  );
}

/** Creator-level bonus with no tweet_id and no per-tweet bonus breakdown. */
export function isCreatorLevelBonusTxn(tx: MoneyTxn): boolean {
  if (metaOf(tx).tweet_id != null && String(metaOf(tx).tweet_id) !== "") {
    return false;
  }
  if (hasBonusBreakdown(tx)) return false;
  return isFlatFeeBonus(tx);
}

export function creatorShareCents(
  totalCents: number,
  shareIds: string[],
  tweetId: string,
): number {
  const ids = [...new Set(shareIds.map(String).filter(Boolean))].sort();
  const n = ids.length;
  const total = Math.max(0, Math.round(Number(totalCents) || 0));
  if (n === 0 || total <= 0) return 0;
  const idx = ids.indexOf(String(tweetId));
  if (idx < 0) return 0;
  const base = Math.floor(total / n);
  const rem = total % n;
  return base + (idx < rem ? 1 : 0);
}

export function resolveTwitterTweetShareIds(options: {
  tweetId: string;
  siblingTweetIds?: string[] | null;
  creatorTweets: Array<{
    id: string;
    moderation_status?: string | null;
    earnings?: number | null;
  }>;
}): string[] {
  const tweetId = String(options.tweetId);
  const siblingSet = new Set(
    (options.siblingTweetIds || []).map(String).filter(Boolean),
  );
  const ids = new Set<string>([tweetId]);
  for (const row of options.creatorTweets) {
    const id = String(row.id || "");
    if (!id) continue;
    const status = String(row.moderation_status || "");
    const earnings = Math.round(Number(row.earnings) || 0);
    if (
      status !== "rejected" ||
      earnings > 0 ||
      siblingSet.has(id)
    ) {
      ids.add(id);
    }
  }
  return [...ids].sort();
}

export function computeTwitterTweetReversalDue(options: {
  tweetId: string;
  shareIds: string[];
  rewards: MoneyTxn[];
  refunds: MoneyTxn[];
  storedCpmCents?: number | null;
  storedBonusCents?: number | null;
  bonusPaid?: boolean | null;
}): { cpmCents: number; bonusCents: number; totalCents: number } {
  const tweetId = String(options.tweetId);
  const rewards = options.rewards;
  const refunds = options.refunds.filter(isReversalRefund);

  const tweetCpmRewardTxns = rewards.filter(
    (tx) => cpmAmountForTweet(tx, tweetId) > 0,
  );
  const tweetCpmRefundTxns = refunds.filter(
    (tx) => cpmAmountForTweet(tx, tweetId) > 0,
  );
  const tweetRewardSum = tweetCpmRewardTxns.reduce(
    (sum, tx) => sum + cpmAmountForTweet(tx, tweetId),
    0,
  );
  const tweetRefundSum = tweetCpmRefundTxns.reduce(
    (sum, tx) => sum + cpmAmountForTweet(tx, tweetId),
    0,
  );

  const creatorMainNet = Math.max(
    0,
    rewards.filter(isCreatorLevelMainTxn).reduce(
      (sum, tx) => sum + Math.max(0, Number(tx.amount) || 0),
      0,
    ) -
      refunds
        .filter(isCreatorLevelMainTxn)
        .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount) || 0), 0),
  );
  const creatorShare = creatorShareCents(
    creatorMainNet,
    options.shareIds,
    tweetId,
  );

  let cpmReversalCents = Math.max(
    0,
    tweetRewardSum + creatorShare - tweetRefundSum,
  );
  const storedCpmCents = Math.round(Number(options.storedCpmCents) || 0);
  if (cpmReversalCents <= 0 && storedCpmCents > 0 && tweetRefundSum <= 0) {
    cpmReversalCents = storedCpmCents;
  }

  const tweetBonusRewardTxns = rewards.filter(
    (tx) => bonusAmountForTweet(tx, tweetId) > 0,
  );
  const tweetBonusRefundTxns = refunds.filter(
    (tx) => bonusAmountForTweet(tx, tweetId) > 0,
  );
  const bonusRewardSum = tweetBonusRewardTxns.reduce(
    (sum, tx) => sum + bonusAmountForTweet(tx, tweetId),
    0,
  );
  const bonusRefundSum = tweetBonusRefundTxns.reduce(
    (sum, tx) => sum + bonusAmountForTweet(tx, tweetId),
    0,
  );
  const creatorBonusNet = Math.max(
    0,
    rewards.filter(isCreatorLevelBonusTxn).reduce(
      (sum, tx) => sum + Math.max(0, Number(tx.amount) || 0),
      0,
    ) -
      refunds
        .filter(isCreatorLevelBonusTxn)
        .reduce((sum, tx) => sum + Math.max(0, Number(tx.amount) || 0), 0),
  );
  const creatorBonusShare = creatorShareCents(
    creatorBonusNet,
    options.shareIds,
    tweetId,
  );

  let bonusReversalAmount = Math.max(
    0,
    bonusRewardSum + creatorBonusShare - bonusRefundSum,
  );
  const storedBonusCents = Math.round(Number(options.storedBonusCents) || 0);
  if (
    bonusReversalAmount <= 0 &&
    options.bonusPaid === true &&
    storedBonusCents > 0 &&
    bonusRefundSum <= 0
  ) {
    bonusReversalAmount = storedBonusCents;
  }

  return {
    cpmCents: cpmReversalCents,
    bonusCents: bonusReversalAmount,
    totalCents: cpmReversalCents + bonusReversalAmount,
  };
}

async function fetchCreatorContestTxns(
  supabaseAdmin: SupabaseClient,
  creatorId: string,
  contestId: string,
): Promise<
  | { ok: true; rewards: MoneyTxn[]; refunds: MoneyTxn[] }
  | { ok: false; error: string }
> {
  const [
    { data: rewardTxnsAll, error: rewardErr },
    { data: refundTxnsAll, error: refundErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("money_transactions")
      .select("id, amount, metadata")
      .eq("user_id", creatorId)
      .eq("type", "reward")
      .limit(5000),
    supabaseAdmin
      .from("money_transactions")
      .select("id, amount, metadata, remarks")
      .eq("user_id", creatorId)
      .eq("type", "refund")
      .limit(5000),
  ]);

  if (rewardErr || refundErr) {
    return {
      ok: false,
      error: `Failed to fetch transactions for reversal: ${
        rewardErr?.message || refundErr?.message || "unknown"
      }`,
    };
  }

  const rewards = filterMoneyTxnsForContest(
    (rewardTxnsAll || []) as MoneyTxn[],
    contestId,
    new Set(),
  );
  const refunds = filterMoneyTxnsForContest(
    (refundTxnsAll || []) as MoneyTxn[],
    contestId,
    new Set(),
  );
  return { ok: true, rewards, refunds };
}

/**
 * Reverse a Twitter tweet payout (CPM, bulk CPM, creator-level, or leaderboard)
 * into the creator wallet and money_transactions. Idempotent on ledger net.
 */
export async function reverseTwitterTweetPayment(options: {
  supabaseAdmin: SupabaseClient;
  contestId: string;
  contestTitle: string;
  tweetId: string;
  creatorId: string;
  storedCpmCents?: number | null;
  storedBonusCents?: number | null;
  bonusPaid?: boolean | null;
  siblingTweetIds?: string[] | null;
}): Promise<
  | { ok: true; refund: TwitterTweetReversalRefund }
  | { ok: false; error: string }
> {
  const {
    supabaseAdmin,
    contestId,
    contestTitle,
    tweetId,
    creatorId,
  } = options;
  const tweetIdStr = String(tweetId);

  const txns = await fetchCreatorContestTxns(
    supabaseAdmin,
    creatorId,
    contestId,
  );
  if (!txns.ok) return txns;

  const { data: creatorTweets, error: tweetsErr } = await supabaseAdmin
    .from("twitter_campaign_tweets")
    .select("id, moderation_status, earnings")
    .eq("contest_id", contestId)
    .eq("creator_id", creatorId);

  if (tweetsErr) {
    return {
      ok: false,
      error: `Failed to fetch tweets for reversal share: ${tweetsErr.message}`,
    };
  }

  const shareIds = resolveTwitterTweetShareIds({
    tweetId: tweetIdStr,
    siblingTweetIds: options.siblingTweetIds,
    creatorTweets: (creatorTweets || []) as Array<{
      id: string;
      moderation_status?: string | null;
      earnings?: number | null;
    }>,
  });

  const due = computeTwitterTweetReversalDue({
    tweetId: tweetIdStr,
    shareIds,
    rewards: txns.rewards,
    refunds: txns.refunds,
    storedCpmCents: options.storedCpmCents,
    storedBonusCents: options.storedBonusCents,
    bonusPaid: options.bonusPaid,
  });



  if (due.totalCents <= 0) {
    return {
      ok: true,
      refund: { cpmCents: 0, bonusCents: 0, totalCents: 0 },
    };
  }

  const refunds = txns.refunds.filter(isReversalRefund);
  const tweetCpmRewardTxns = txns.rewards.filter(
    (tx) =>
      cpmAmountForTweet(tx, tweetIdStr) > 0 || isCreatorLevelMainTxn(tx),
  );
  const tweetCpmRefundTxns = refunds.filter(
    (tx) =>
      cpmAmountForTweet(tx, tweetIdStr) > 0 || isCreatorLevelMainTxn(tx),
  );
  const tweetBonusRewardTxns = txns.rewards.filter(
    (tx) =>
      bonusAmountForTweet(tx, tweetIdStr) > 0 || isCreatorLevelBonusTxn(tx),
  );
  const tweetBonusRefundTxns = refunds.filter(
    (tx) =>
      bonusAmountForTweet(tx, tweetIdStr) > 0 || isCreatorLevelBonusTxn(tx),
  );

  const reversalDebitKey = buildLedgerScopedReversalDebitIdempotencyKey({
    prefix: "twitter_tweet_reversal:v1",
    reason: "moderate_submission_reversal",
    scope: {
      contestId,
      creatorId,
      tweetId: tweetIdStr,
    },
    rewardTransactionIds: [
      ...sortUniqueTransactionIds(tweetCpmRewardTxns),
      ...sortUniqueTransactionIds(tweetBonusRewardTxns),
    ],
    refundTransactionIds: [
      ...sortUniqueTransactionIds(tweetCpmRefundTxns),
      ...sortUniqueTransactionIds(tweetBonusRefundTxns),
    ],
    debitCents: due.totalCents,
  });

  const debitRes = await debitCreatorReversalClawback(
    creatorId,
    due.totalCents,
    { idempotencyKey: reversalDebitKey },
  );
  if (!debitRes.success) {
    return {
      ok: false,
      error: `Failed to reverse tweet payment: ${debitRes.error}`,
    };
  }

  if (due.cpmCents > 0) {
    const logged = await logTransactionAsAdmin(
      creatorId,
      "refund",
      due.cpmCents,
      "success",
      `Reversal of Twitter tweet reward — ${contestTitle}`,
      {
        remarks: REVERSAL_TRANSACTION_REMARK,
        paymentMethod: "refund",
        metadata: {
          contest_id: contestId,
          twitter_creator_id: creatorId,
          tweet_id: tweetIdStr,
          payout_type: "twitter_cpm_tweet_reversal",
        },
      },
    );
    if (!logged) {
      return {
        ok: false,
        error:
          "Reversal debit succeeded but failed to log reward refund in transaction history.",
      };
    }
  }

  if (due.bonusCents > 0) {
    const logged = await logTransactionAsAdmin(
      creatorId,
      "refund",
      due.bonusCents,
      "success",
      `Reversal of Twitter tweet bonus — ${contestTitle}`,
      {
        remarks: REVERSAL_TRANSACTION_REMARK,
        paymentMethod: "refund",
        metadata: {
          contest_id: contestId,
          twitter_creator_id: creatorId,
          tweet_id: tweetIdStr,
          bonus_type: "flat_fee",
        },
      },
    );
    if (!logged) {
      return {
        ok: false,
        error:
          "Reversal debit succeeded but failed to log bonus refund in transaction history.",
      };
    }
  }

  return {
    ok: true,
    refund: {
      cpmCents: due.cpmCents,
      bonusCents: due.bonusCents,
      totalCents: due.totalCents,
    },
  };
}

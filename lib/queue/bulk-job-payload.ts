import type { BulkPaymentQueueItem } from "@/lib/queue/bulk-payment-queue";

export type BulkPaymentJobPayload = {
  items: BulkPaymentQueueItem[];
};

export type BulkModerationWalletRefundSummary = {
  reward_refunded_cents: number;
  bonus_refunded_cents: number;
  total_refunded_cents: number;
  cpm_refunded_cents: number;
  milestone_refunded_cents: number;
};

export type BulkModerationChannel = "submissions" | "twitter_tweets";

export type BulkModerationJobPayload = {
  submissionIds: string[];
  channel?: BulkModerationChannel;
  walletPreflightDone?: boolean;
  walletSkipSubmissionIds?: string[];
  walletRefundSummaries?: Record<string, BulkModerationWalletRefundSummary>;
};

function normalizePaymentItems(raw: unknown): BulkPaymentQueueItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const creatorId = String(
        (item as { creatorId?: unknown }).creatorId || "",
      ).trim();
      const submissionIds = Array.isArray(
        (item as { submissionIds?: unknown }).submissionIds,
      )
        ? (item as { submissionIds: unknown[] }).submissionIds
            .map(String)
            .map((id) => id.trim())
            .filter(Boolean)
        : [];
      if (!creatorId || submissionIds.length === 0) return null;
      return { creatorId, submissionIds };
    })
    .filter((item): item is BulkPaymentQueueItem => item != null);
}

export function parseBulkPaymentJobPayload(
  raw: unknown,
): BulkPaymentJobPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const items = normalizePaymentItems((raw as BulkPaymentJobPayload).items);
  if (items.length === 0) return null;
  return { items };
}

export function parseBulkModerationJobPayload(
  raw: unknown,
): BulkModerationJobPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const submissionIds = Array.isArray(
    (raw as BulkModerationJobPayload).submissionIds,
  )
    ? (raw as BulkModerationJobPayload).submissionIds
        .map(String)
        .filter(Boolean)
    : [];
  if (submissionIds.length === 0) return null;
  const walletSkipSubmissionIds = Array.isArray(
    (raw as BulkModerationJobPayload).walletSkipSubmissionIds,
  )
    ? (raw as BulkModerationJobPayload).walletSkipSubmissionIds!.map(String)
    : undefined;
  const channelRaw = String(
    (raw as BulkModerationJobPayload).channel || "submissions",
  );
  const channel: BulkModerationChannel =
    channelRaw === "twitter_tweets" ? "twitter_tweets" : "submissions";
  return {
    submissionIds,
    channel,
    walletPreflightDone: Boolean(
      (raw as BulkModerationJobPayload).walletPreflightDone,
    ),
    walletSkipSubmissionIds,
    walletRefundSummaries:
      (raw as BulkModerationJobPayload).walletRefundSummaries ?? undefined,
  };
}

export function readQueueOffset(
  row: { queue_offset?: unknown; processed_count?: unknown } | null | undefined,
  fallback = 0,
): number {
  if (
    row &&
    typeof row.queue_offset === "number" &&
    Number.isFinite(row.queue_offset)
  ) {
    return Math.max(0, Math.floor(row.queue_offset));
  }
  return Math.max(0, Math.floor(Number(row?.processed_count) || fallback));
}

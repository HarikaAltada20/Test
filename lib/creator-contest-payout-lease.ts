import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";

export type CreatorContestPayoutLease = {
  contestId: string;
  creatorId: string;
  ownerToken: string;
  /** Absolute ms timestamp when this process last extended the lease. */
  lastRenewedAtMs?: number;
};

/** Default hold long enough for large creator bulk pays; SQL max is 1800s. */
export const CREATOR_CONTEST_PAYOUT_LEASE_TTL_SECONDS = 900;

/** Renew before half the TTL elapses so a slow pay cannot be stolen. */
export const CREATOR_CONTEST_PAYOUT_LEASE_RENEW_EVERY_MS = 120_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rpcAcquireLease(params: {
  contestId: string;
  creatorId: string;
  ownerToken: string;
  ttlSeconds: number;
}): Promise<{ acquired: boolean; error?: string }> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.rpc(
    "acquire_creator_contest_payout_lease",
    {
      p_contest_id: params.contestId,
      p_creator_id: params.creatorId,
      p_owner_token: params.ownerToken,
      p_ttl_seconds: params.ttlSeconds,
    },
  );
  if (error) {
    return {
      acquired: false,
      error: `Failed to acquire payout lease: ${error.message}`,
    };
  }
  return { acquired: data === true };
}

/**
 * Acquire a cross-request lease before reading rank/cap/ledger state. The
 * database function atomically replaces only expired leases. The same owner
 * token may re-acquire to renew TTL while work is still in progress.
 */
export async function acquireCreatorContestPayoutLease(params: {
  contestId: string;
  creatorId: string;
  waitMs?: number;
  ttlSeconds?: number;
}): Promise<
  | { ok: true; lease: CreatorContestPayoutLease }
  | { ok: false; error: string; busy?: boolean }
> {
  const ownerToken = randomUUID();
  const deadline = Date.now() + Math.max(0, params.waitMs ?? 8_000);
  const ttlSeconds =
    params.ttlSeconds ?? CREATOR_CONTEST_PAYOUT_LEASE_TTL_SECONDS;

  do {
    const result = await rpcAcquireLease({
      contestId: params.contestId,
      creatorId: params.creatorId,
      ownerToken,
      ttlSeconds,
    });
    if (result.error) {
      return { ok: false, error: result.error };
    }
    if (result.acquired) {
      return {
        ok: true,
        lease: {
          contestId: params.contestId,
          creatorId: params.creatorId,
          ownerToken,
          lastRenewedAtMs: Date.now(),
        },
      };
    }
    if (Date.now() >= deadline) {
      return {
        ok: false,
        busy: true,
        error:
          "Another payout for this creator and contest is still in progress. Retry shortly.",
      };
    }
    await sleep(200);
  } while (true);
}

/**
 * Extend an owned lease. Safe to call frequently; no-ops when called too soon
 * unless `force` is set.
 */
export async function renewCreatorContestPayoutLease(
  lease: CreatorContestPayoutLease | null | undefined,
  opts?: { force?: boolean; ttlSeconds?: number },
): Promise<boolean> {
  if (!lease) return false;
  const now = Date.now();
  if (
    !opts?.force &&
    typeof lease.lastRenewedAtMs === "number" &&
    now - lease.lastRenewedAtMs < CREATOR_CONTEST_PAYOUT_LEASE_RENEW_EVERY_MS
  ) {
    return true;
  }

  const result = await rpcAcquireLease({
    contestId: lease.contestId,
    creatorId: lease.creatorId,
    ownerToken: lease.ownerToken,
    ttlSeconds: opts?.ttlSeconds ?? CREATOR_CONTEST_PAYOUT_LEASE_TTL_SECONDS,
  });
  if (!result.acquired) {
    console.error(
      "[payout-lease] Failed to renew payout lease:",
      result.error || "not acquired",
    );
    return false;
  }
  lease.lastRenewedAtMs = now;
  return true;
}

export async function releaseCreatorContestPayoutLease(
  lease: CreatorContestPayoutLease | null | undefined,
): Promise<void> {
  if (!lease) return;
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.rpc(
    "release_creator_contest_payout_lease",
    {
      p_contest_id: lease.contestId,
      p_creator_id: lease.creatorId,
      p_owner_token: lease.ownerToken,
    },
  );
  if (error) {
    console.error("[payout-lease] Failed to release payout lease:", error);
  }
}

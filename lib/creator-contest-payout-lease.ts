import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";

export type CreatorContestPayoutLease = {
  contestId: string;
  creatorId: string;
  ownerToken: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Acquire a cross-request lease before reading rank/cap/ledger state. The
 * database function atomically replaces only expired leases.
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
  const supabaseAdmin = createAdminClient();

  do {
    const { data, error } = await supabaseAdmin.rpc(
      "acquire_creator_contest_payout_lease",
      {
        p_contest_id: params.contestId,
        p_creator_id: params.creatorId,
        p_owner_token: ownerToken,
        p_ttl_seconds: params.ttlSeconds ?? 300,
      },
    );
    if (error) {
      return {
        ok: false,
        error: `Failed to acquire payout lease: ${error.message}`,
      };
    }
    if (data === true) {
      return {
        ok: true,
        lease: {
          contestId: params.contestId,
          creatorId: params.creatorId,
          ownerToken,
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

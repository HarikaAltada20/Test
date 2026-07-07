/**
 * Dual-rewards: main `earnings` split (cents) plus optional payment audit when written from admin pay.
 * Stored on `submissions.dual_rewards_payout` as JSON.
 */
export type DualRewardsPayoutJson = {
  cpm_cents: number;
  milestone_cents: number;
  type?: "payment";
  timestamp?: string;
  updatedBy?: string;
  customRemarks?: string | null;
};

const DUAL_SCOPE_RE = /dual_component:\s*(cpm|milestone|both)/i;

export type DualRewardPayoutScope = "cpm" | "milestone" | "both";

/** When `dual_rewards_payout` JSON is missing, infer which component was paid from totals (cents). */
export type DualPayoutScopeHint = {
  paidTotalCents: number;
  cpmExpectedCents: number;
  milestoneExpectedCents: number;
};

const PAID_SCOPE_MATCH_TOL_CENTS = 2;

/**
 * Match `paidTotalCents` to adjusted expected CPM / milestone / sum so UI does not
 * mis-split a milestone-only payment across columns via proportional weights.
 */
export function inferDualPayoutScopeFromPaidTotal(
  paidTotalCents: number,
  cpmExpectedCents: number,
  milestoneExpectedCents: number,
): DualRewardPayoutScope | null {
  const paid = Math.round(Number(paidTotalCents) || 0);
  if (paid <= 0) return null;
  const cpm = Math.round(Number(cpmExpectedCents) || 0);
  const ms = Math.round(Number(milestoneExpectedCents) || 0);
  const combined = cpm + ms;
  const near = (a: number, b: number) =>
    Math.abs(a - b) <= PAID_SCOPE_MATCH_TOL_CENTS;

  if (ms > 0 && near(paid, ms) && !near(paid, cpm)) return "milestone";
  if (cpm > 0 && near(paid, cpm) && !near(paid, ms)) return "cpm";
  if (combined > 0 && near(paid, combined)) return "both";
  return null;
}

export function parseDualRewardPayoutScopeFromRemarks(
  remarks: string | null | undefined,
): DualRewardPayoutScope | null {
  const m = String(remarks || "").match(DUAL_SCOPE_RE);
  return m ? (m[1].toLowerCase() as DualRewardPayoutScope) : null;
}

/** Strip machine-readable dual_component tag; leave any human note for metadata. */
export function stripDualComponentTagFromRemarks(
  remarks: string | null | undefined,
): string {
  return String(remarks || "")
    .replace(DUAL_SCOPE_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseDualRewardsPayoutJson(
  raw: unknown,
): DualRewardsPayoutJson | null {
  if (raw == null) return null;
  let o: Record<string, unknown>;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      o = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === "object") {
    if (Array.isArray(raw)) return null;
    o = raw as Record<string, unknown>;
  } else {
    return null;
  }
  const cRaw =
    o.cpm_cents ?? (o as { cpmCents?: unknown }).cpmCents;
  const mRaw =
    o.milestone_cents ?? (o as { milestoneCents?: unknown }).milestoneCents;
  const c = Number(cRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(c) || !Number.isFinite(m)) return null;
  const out: DualRewardsPayoutJson = {
    cpm_cents: Math.round(c),
    milestone_cents: Math.round(m),
  };
  if (o.type === "payment") out.type = "payment";
  if (typeof o.timestamp === "string") out.timestamp = o.timestamp;
  if (typeof o.updatedBy === "string") out.updatedBy = o.updatedBy;
  if (o.customRemarks === null) out.customRemarks = null;
  else if (typeof o.customRemarks === "string") out.customRemarks = o.customRemarks;
  return out;
}

/** Full JSON persisted on `submissions.dual_rewards_payout` when marking dual-rewards paid. */
export function buildDualRewardsPayoutPersistValue(
  split: { cpm_cents: number; milestone_cents: number },
  audit: {
    updatedBy: string;
    customRemarks: string | null | undefined;
  },
): Record<string, unknown> {
  const remarks =
    audit.customRemarks != null && String(audit.customRemarks).trim()
      ? String(audit.customRemarks).trim()
      : null;
  return {
    cpm_cents: Math.max(0, Math.round(split.cpm_cents)),
    milestone_cents: Math.max(0, Math.round(split.milestone_cents)),
    type: "payment",
    timestamp: new Date().toISOString(),
    updatedBy: audit.updatedBy,
    customRemarks: remarks,
  };
}

/** Row update after dual-rewards wallet credit (CPM and/or milestone). */
export function buildDualRewardsSubmissionPayUpdatePayload(params: {
  /** Cumulative paid CPM + milestone cents (stored in `dual_rewards_payout`). */
  split: { cpm_cents: number; milestone_cents: number };
  updatedBy: string;
  customRemarks?: string | null;
}): Record<string, unknown> {
  const cpmCents = Math.max(0, Math.round(params.split.cpm_cents));
  const milestoneCents = Math.max(0, Math.round(params.split.milestone_cents));
  const totalCents = cpmCents + milestoneCents;
  if (totalCents <= 0) {
    return {};
  }

  return {
    dual_rewards_payout: buildDualRewardsPayoutPersistValue(
      { cpm_cents: cpmCents, milestone_cents: milestoneCents },
      {
        updatedBy: params.updatedBy,
        customRemarks: params.customRemarks ?? null,
      },
    ),
    paid: true,
    status: "paid",
    paid_at: new Date().toISOString(),
    earnings: totalCents,
  };
}

export type DualRewardsPaidComponentSnapshot = {
  cpmCents: number;
  milestoneCents: number;
};

type DualRewardsOptimisticFilterQuery = {
  filter: (
    column: string,
    operator: string,
    value: string,
  ) => DualRewardsOptimisticFilterQuery;
  is: (column: string, value: null) => DualRewardsOptimisticFilterQuery;
  eq: (column: string, value: boolean) => DualRewardsOptimisticFilterQuery;
  neq: (column: string, value: boolean) => DualRewardsOptimisticFilterQuery;
};

/**
 * Compare-and-swap guards for dual-rewards submission row updates (bulk / concurrent pay).
 * When `dual_rewards_payout` JSON exists, match current cpm/milestone cents; otherwise
 * use legacy `paid` / `bonus_paid` flags like standard bulk payment.
 */
/**
 * After a pool-budget commit, `dual_rewards_payout` in the DB already reflects
 * `targetAfter` while the in-memory submission snapshot is still stale. Guards
 * must compare against the committed row state, not the pre-commit snapshot.
 */
export function buildDualRewardsPayUpdateGuardContext(
  snapshot: {
    dual_rewards_payout?: unknown;
    paid?: boolean | null;
    bonus_paid?: boolean | null;
  },
  paidComponents: DualRewardsPaidComponentSnapshot,
  targetAfter: { cpm_cents: number; milestone_cents: number },
  poolCommitted: boolean,
): {
  snapshot: {
    dual_rewards_payout?: unknown;
    paid?: boolean | null;
    bonus_paid?: boolean | null;
  };
  paidComponents: DualRewardsPaidComponentSnapshot;
} {
  if (!poolCommitted) {
    return { snapshot, paidComponents };
  }
  const cpmCents = Math.max(0, Math.round(targetAfter.cpm_cents));
  const milestoneCents = Math.max(0, Math.round(targetAfter.milestone_cents));
  return {
    snapshot: {
      ...snapshot,
      dual_rewards_payout: { cpm_cents: cpmCents, milestone_cents: milestoneCents },
    },
    paidComponents: { cpmCents, milestoneCents },
  };
}

export function applyDualRewardsPayUpdateOptimisticGuards<
  Q extends DualRewardsOptimisticFilterQuery,
>(
  query: Q,
  snapshot: {
    dual_rewards_payout?: unknown;
    paid?: boolean | null;
    bonus_paid?: boolean | null;
  },
  paidComponents: DualRewardsPaidComponentSnapshot,
  paying: { cpm_cents: number; milestone_cents: number },
): Q {
  const dual = parseDualRewardsPayoutJson(snapshot.dual_rewards_payout);
  if (dual) {
    return query
      .filter(
        "dual_rewards_payout->>cpm_cents",
        "eq",
        String(paidComponents.cpmCents),
      )
      .filter(
        "dual_rewards_payout->>milestone_cents",
        "eq",
        String(paidComponents.milestoneCents),
      ) as Q;
  }

  let guarded = query.is("dual_rewards_payout", null);
  if (paying.cpm_cents > 0 && paidComponents.cpmCents === 0) {
    guarded = guarded.neq("paid", true);
  }
  if (paying.milestone_cents > 0 && paidComponents.milestoneCents === 0) {
    if (paying.cpm_cents === 0) {
      guarded = guarded.eq("paid", true);
    }
    guarded = guarded.neq("bonus_paid", true);
  }
  return guarded as Q;
}

/** Restore submission row to pre-bulk-pay component state after a rolled-back wallet credit. */
export function buildDualRewardsBulkRollbackRevertPayload(
  priorComponents: DualRewardsPaidComponentSnapshot,
  item: { cpm_cents: number; milestone_cents: number },
): Record<string, unknown> {
  const nextCpm = Math.max(0, priorComponents.cpmCents);
  const nextMs = Math.max(0, priorComponents.milestoneCents);

  if (nextCpm === 0 && nextMs === 0) {
    return {
      dual_rewards_payout: null,
      status: "verified",
      paid: false,
      paid_at: null,
      earnings: null,
      bonus_paid: false,
      bonus_paid_at: null,
      bonus_amount: null,
    };
  }

  const revertPayload: Record<string, unknown> = {
    dual_rewards_payout: buildDualRewardsPayoutPersistValue(
      { cpm_cents: nextCpm, milestone_cents: nextMs },
      { updatedBy: "system", customRemarks: null },
    ),
    earnings: nextCpm + nextMs,
    paid: true,
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (nextMs > 0) {
    revertPayload.bonus_paid = true;
    revertPayload.bonus_amount = nextMs;
    revertPayload.bonus_paid_at = new Date().toISOString();
  } else {
    revertPayload.bonus_paid = false;
    revertPayload.bonus_amount = null;
    revertPayload.bonus_paid_at = null;
  }
  return revertPayload;
}

/**
 * Infer legacy scope string for getDualGrantedBreakdown / UI branching.
 * Prefers `dual_rewards_payout` JSON, then legacy text column, then metadata tag.
 */
export function getDualPayoutScopeFromSubmission(
  sub: {
    dual_rewards_payout?: unknown;
    dual_reward_payout_scope?: string | null;
    metadata?: {
      customRemarks?: string | null;
      custom_remarks?: string | null;
    } | null;
  },
  hint?: DualPayoutScopeHint | null,
): DualRewardPayoutScope | null {
  const j = parseDualRewardsPayoutJson(sub.dual_rewards_payout);
  if (j) {
    const { cpm_cents: c, milestone_cents: ms } = j;
    if (c > 0 && ms <= 0) return "cpm";
    if (ms > 0 && c <= 0) return "milestone";
    if (c > 0 && ms > 0) return "both";
    const fromJsonRemarks =
      parseDualRewardPayoutScopeFromRemarks(j.customRemarks);
    if (fromJsonRemarks) return fromJsonRemarks;
    return null;
  }
  const legacy = sub.dual_reward_payout_scope;
  if (legacy === "cpm" || legacy === "milestone" || legacy === "both") {
    return legacy;
  }
  const raw =
    sub.metadata?.customRemarks ??
    (sub.metadata as { custom_remarks?: string | null } | null)
      ?.custom_remarks ??
    "";
  const fromRemarks = parseDualRewardPayoutScopeFromRemarks(raw);
  if (fromRemarks) return fromRemarks;
  if (
    hint &&
    Number(hint.paidTotalCents) > 0 &&
    (Number(hint.cpmExpectedCents) > 0 || Number(hint.milestoneExpectedCents) > 0)
  ) {
    const inferred = inferDualPayoutScopeFromPaidTotal(
      hint.paidTotalCents,
      hint.cpmExpectedCents,
      hint.milestoneExpectedCents,
    );
    if (inferred) return inferred;
  }
  return null;
}

/** Remaining payable per component after prior dual-rewards payouts. */
export function getDualRemainingPayableCents(
  component: DualRewardPayoutScope,
  cpmExpectedCents: number,
  milestoneExpectedCents: number,
  dualPayoutRaw: unknown,
): {
  cpmRemaining: number;
  milestoneRemaining: number;
  totalRemaining: number;
} {
  const prev = parseDualRewardsPayoutJson(dualPayoutRaw);
  const prevCpm = Math.max(0, prev?.cpm_cents ?? 0);
  const prevMs = Math.max(0, prev?.milestone_cents ?? 0);
  const cpmRemaining = Math.max(
    0,
    Math.round(Number(cpmExpectedCents) || 0) - prevCpm,
  );
  const milestoneRemaining = Math.max(
    0,
    Math.round(Number(milestoneExpectedCents) || 0) - prevMs,
  );
  const totalRemaining =
    component === "cpm"
      ? cpmRemaining
      : component === "milestone"
        ? milestoneRemaining
        : cpmRemaining + milestoneRemaining;
  return { cpmRemaining, milestoneRemaining, totalRemaining };
}

/** Split reversal total into CPM / milestone using stored `dual_rewards_payout`. */
export function splitDualReversalRefundFromPayout(
  dualPayoutRaw: unknown,
  reversalTotalCents: number,
  fallbackMainCents: number,
  fallbackBonusCents: number,
): { cpmCents: number; milestoneCents: number } {
  const total = Math.max(0, Math.round(Number(reversalTotalCents) || 0));
  if (total <= 0) return { cpmCents: 0, milestoneCents: 0 };

  const dual = parseDualRewardsPayoutJson(dualPayoutRaw);
  const cpmStored = Math.max(0, dual?.cpm_cents ?? 0);
  const msStored = Math.max(0, dual?.milestone_cents ?? 0);
  const splitTotal = cpmStored + msStored;

  if (splitTotal > 0) {
    const scale = total / splitTotal;
    let cpmCents = Math.round(cpmStored * scale);
    let milestoneCents = Math.round(msStored * scale);
    const drift = total - cpmCents - milestoneCents;
    if (drift !== 0) {
      if (msStored >= cpmStored) milestoneCents += drift;
      else cpmCents += drift;
    }
    return { cpmCents, milestoneCents };
  }

  const main = Math.max(0, Math.round(Number(fallbackMainCents) || 0));
  const bonus = Math.max(0, Math.round(Number(fallbackBonusCents) || 0));
  if (bonus > 0) return { cpmCents: main, milestoneCents: bonus };
  return { cpmCents: total, milestoneCents: 0 };
}

/**
 * Build `dual_rewards_payout` after milestone-only pool total changes (e.g.
 * most-verified bonus pay/reversal). Preserves audit fields when present.
 * Returns null when both components are zero (clears pool reservation).
 */
export function dualRewardsPayoutForMilestoneTotal(
  dualPayoutRaw: unknown,
  cpmCents: number,
  milestoneTotalCents: number,
): Record<string, unknown> | null {
  const cpm = Math.max(0, Math.round(cpmCents));
  const milestone = Math.max(0, Math.round(milestoneTotalCents));
  if (cpm <= 0 && milestone <= 0) return null;

  const prev = parseDualRewardsPayoutJson(dualPayoutRaw);
  if (prev) {
    return dualRewardsPayoutJsonToRowValue({
      ...prev,
      cpm_cents: cpm,
      milestone_cents: milestone,
    });
  }

  return {
    cpm_cents: cpm,
    milestone_cents: milestone,
  };
}

export function dualRewardsPayoutJsonToRowValue(
  j: DualRewardsPayoutJson,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    cpm_cents: Math.max(0, Math.round(j.cpm_cents)),
    milestone_cents: Math.max(0, Math.round(j.milestone_cents)),
  };
  if (j.type === "payment") row.type = "payment";
  if (typeof j.timestamp === "string") row.timestamp = j.timestamp;
  if (typeof j.updatedBy === "string") row.updatedBy = j.updatedBy;
  if (j.customRemarks !== undefined) row.customRemarks = j.customRemarks;
  return row;
}

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

/**
 * Match `paidTotalCents` exactly to expected CPM / milestone / sum (cents).
 * Returns null when zero or more than one interpretation matches (UI-only).
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

  const matches: DualRewardPayoutScope[] = [];
  if (combined > 0 && paid === combined) matches.push("both");
  if (cpm > 0 && paid === cpm) matches.push("cpm");
  if (ms > 0 && paid === ms) matches.push("milestone");

  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return null;

  if (paid === combined && matches.includes("both")) return "both";
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

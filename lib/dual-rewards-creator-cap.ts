/**
 * Per-creator max earnings cap for dual rewards: milestone + CPM share one budget
 * in submission `created_at` order. When the cap binds on a submission, both
 * components are reduced proportionally (same rule as contest detail + modal).
 */
export type DualCreatorCapSubmissionRow = {
  id: string;
  created_at: string;
  mRawCents: number;
  cRawCents: number;
};

export function buildDualRewardCreatorCapSplitMaps(
  submissions: DualCreatorCapSubmissionRow[],
  maxEarningsPerCreator: number,
): {
  milestoneCappedBySubmissionId: Map<string, number>;
  cpmCappedBySubmissionId: Map<string, number>;
} {
  const milestoneCappedBySubmissionId = new Map<string, number>();
  const cpmCappedBySubmissionId = new Map<string, number>();
  const max = Math.max(0, Math.round(Number(maxEarningsPerCreator) || 0));

  if (!submissions.length) {
    return { milestoneCappedBySubmissionId, cpmCappedBySubmissionId };
  }

  if (max <= 0) {
    for (const s of submissions) {
      const m = Math.max(0, Math.round(s.mRawCents));
      const c = Math.max(0, Math.round(s.cRawCents));
      milestoneCappedBySubmissionId.set(s.id, m);
      cpmCappedBySubmissionId.set(s.id, c);
    }
    return { milestoneCappedBySubmissionId, cpmCappedBySubmissionId };
  }

  const sorted = [...submissions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  let remaining = max;
  for (const s of sorted) {
    const mRaw = Math.max(0, Math.round(s.mRawCents));
    const cRaw = Math.max(0, Math.round(s.cRawCents));
    const totalRaw = mRaw + cRaw;
    const alloc = Math.min(remaining, totalRaw);
    let mCap = 0;
    let cCap = 0;
    if (totalRaw <= 0) {
      mCap = 0;
      cCap = 0;
    } else if (alloc >= totalRaw) {
      mCap = mRaw;
      cCap = cRaw;
    } else {
      mCap = Math.floor((alloc * mRaw) / totalRaw);
      cCap = alloc - mCap;
    }
    milestoneCappedBySubmissionId.set(s.id, mCap);
    cpmCappedBySubmissionId.set(s.id, cCap);
    remaining -= alloc;
  }

  return { milestoneCappedBySubmissionId, cpmCappedBySubmissionId };
}

/**
 * Split a stored payment total across CPM vs milestone for UI (matches capped
 * expected weights when the paid total differs from the sum of expectations).
 */
export function splitDualPaidTotalByExpectedWeights(
  paidTotalCents: number,
  cpmExpectedCents: number,
  milestoneExpectedCents: number,
  opts?: {
    /** When capped expected is 0/0 but a payment exists, split by uncapped raw weights. */
    cpmUncappedCents?: number;
    milestoneUncappedCents?: number;
  },
): { cpmCents: number; milestoneCents: number } {
  const c = Math.max(0, Math.round(cpmExpectedCents));
  const m = Math.max(0, Math.round(milestoneExpectedCents));
  const sum = c + m;
  const t = Math.max(0, Math.round(paidTotalCents));
  if (sum <= 0) {
    const cu = Math.max(0, Math.round(opts?.cpmUncappedCents ?? 0));
    const mu = Math.max(0, Math.round(opts?.milestoneUncappedCents ?? 0));
    const rawSum = cu + mu;
    if (rawSum > 0 && t > 0) {
      const milestoneOut = Math.floor((t * mu) / rawSum);
      const cpmOut = t - milestoneOut;
      return { cpmCents: cpmOut, milestoneCents: milestoneOut };
    }
    return { cpmCents: t, milestoneCents: 0 };
  }
  if (t >= sum) {
    const extra = t - sum;
    return { cpmCents: c + extra, milestoneCents: m };
  }
  const milestoneOut = Math.floor((t * m) / sum);
  const cpmOut = t - milestoneOut;
  return { cpmCents: cpmOut, milestoneCents: milestoneOut };
}

/**
 * Pure helpers for contest_based_details spend fields.
 * Safe for client + server (no Supabase / side effects).
 */

type Details = Record<string, unknown>;

function asRecord(value: unknown): Details {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Details)
    : {};
}

function nestBudgetSpent(value: unknown): number | undefined {
  const nest = asRecord(value);
  if (nest.budget_spent == null) return undefined;
  const n = Number(nest.budget_spent);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * When rebuilding contest_based_details on save, keep persisted spend if the
 * incoming payload omitted it (milestone/leaderboard rebuilds historically
 * dropped budget_spent and zeroed list Budget Trackers).
 *
 * Does not overwrite an explicit incoming budget_spent (including 0).
 */
export function preserveExistingBudgetSpentFields(
  incomingDetails: unknown,
  existingDetails: unknown,
): Details {
  const incoming = asRecord(incomingDetails);
  const existing = asRecord(existingDetails);
  const next: Details = { ...incoming };

  for (const key of [
    "leaderboard_contest",
    "cpm_contest",
    "milestone_contest",
  ] as const) {
    const incomingNest = incoming[key];
    if (
      !incomingNest ||
      typeof incomingNest !== "object" ||
      Array.isArray(incomingNest)
    ) {
      continue;
    }
    const nest = asRecord(incomingNest);
    if (nest.budget_spent != null) continue;
    const preserved = nestBudgetSpent(existing[key]);
    if (preserved !== undefined) {
      next[key] = { ...nest, budget_spent: preserved };
    }
  }

  if (
    next.pool_budget_spent_cents == null &&
    existing.pool_budget_spent_cents != null
  ) {
    const n = Number(existing.pool_budget_spent_cents);
    if (Number.isFinite(n)) {
      next.pool_budget_spent_cents = n;
    }
  }

  return next;
}

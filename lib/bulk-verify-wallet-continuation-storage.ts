/**
 * Persist signed wallet-reversal continuation tokens across chunk failures /
 * page reloads so admins can retry without re-debiting wallets.
 * Browser-only (sessionStorage).
 */

const STORAGE_PREFIX = "bulk_verify_wallet_cont:v1:";

function sortUniqueIds(ids: readonly string[]): string[] {
  return Array.from(
    new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
}

/** Stable short key from contest + action + full preflight ID set. */
export function bulkVerifyWalletContinuationStorageKey(params: {
  contestId: string;
  action: string;
  reversalSubmissionIds: readonly string[];
}): string {
  const sorted = sortUniqueIds(params.reversalSubmissionIds);
  // djb2 — compact, sync, good enough for sessionStorage keys (not security).
  let hash = 5381;
  const payload = sorted.join(",");
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  const idHash = (hash >>> 0).toString(16);
  return `${STORAGE_PREFIX}${params.contestId}:${params.action}:${sorted.length}:${idHash}`;
}

export function saveBulkVerifyWalletContinuation(params: {
  contestId: string;
  action: string;
  reversalSubmissionIds: readonly string[];
  token: string;
}): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const key = bulkVerifyWalletContinuationStorageKey(params);
    sessionStorage.setItem(
      key,
      JSON.stringify({
        token: params.token,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // Quota / private mode — non-fatal; in-memory continuation still works.
  }
}

export function loadBulkVerifyWalletContinuation(params: {
  contestId: string;
  action: string;
  reversalSubmissionIds: readonly string[];
}): string | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const key = bulkVerifyWalletContinuationStorageKey(params);
    const raw = sessionStorage.getItem(key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { token?: string };
    return typeof parsed?.token === "string" && parsed.token.includes(".")
      ? parsed.token
      : undefined;
  } catch {
    return undefined;
  }
}

export function clearBulkVerifyWalletContinuation(params: {
  contestId: string;
  action: string;
  reversalSubmissionIds: readonly string[];
}): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(bulkVerifyWalletContinuationStorageKey(params));
  } catch {
    // ignore
  }
}

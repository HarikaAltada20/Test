/**
 * Collects last-seen Meta rate-limit headers across multiple graph.instagram.com
 * calls (e.g. one refresh batch). Values are overwritten on each response — useful
 * for a snapshot of usage after concurrent work settles.
 */
export type MetaGraphUsageAccumulator = {
  xAppUsageRaw?: string;
  xBusinessUseCaseRaw?: string;
};

export function applyUsageHeadersToAccumulator(
  headers: Headers,
  acc: MetaGraphUsageAccumulator
): void {
  const app = headers.get("x-app-usage");
  if (app?.trim()) acc.xAppUsageRaw = app.trim();
  const buc = headers.get("x-business-use-case-usage");
  if (buc?.trim()) acc.xBusinessUseCaseRaw = buc.trim();
}

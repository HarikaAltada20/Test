/**
 * Browser helper: drop in-memory list pages + bump Redis gens after brand
 * contest create/update (dashboard writes that skip server mutation APIs).
 */

import { clearServerCampaignListClientCache } from "@/lib/use-server-campaign-list";

export function invalidateBrandCampaignListCachesAfterMutation(options?: {
  /** When true, also bump opportunities generation (publish / visibility). */
  touchOpportunities?: boolean;
}): void {
  clearServerCampaignListClientCache();

  const params = new URLSearchParams({ scope: "self" });
  if (options?.touchOpportunities) {
    params.set("touchOpportunities", "1");
  }

  void fetch(`/api/contests/clear-cache?${params.toString()}`, {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
}

export const BRAND_CONTEST_LIST_TAB_KEY = "gv-dashboard-contests-tab";
export const ADMIN_CONTEST_LIST_TAB_KEY = "gv-dashboard-admin-contests-tab";
export const OPPORTUNITIES_STATUS_TAB_KEY = "gv-dashboard-opportunities-status-tab";

export const DEFAULT_CAMPAIGN_LIST_TAB = "live";

export const BRAND_CONTEST_TAB_IDS = [
  "all",
  "draft",
  "pending_approval",
  "ready",
  "upcoming",
  "live",
  "ended",
  "rejected",
] as const;

export const OPPORTUNITIES_STATUS_TAB_IDS = [
  "all",
  "live",
  "upcoming",
  "ended",
] as const;

const LEGACY_BRAND_CONTEST_TAB_MAP: Record<string, string> = {
  active: "live",
  pending_verification: "ended",
  done: "ended",
};

export function normalizeBrandContestTabFromUrl(tab: string): string | null {
  const mapped = LEGACY_BRAND_CONTEST_TAB_MAP[tab] ?? tab;
  return (BRAND_CONTEST_TAB_IDS as readonly string[]).includes(mapped)
    ? mapped
    : null;
}

export function readStoredCampaignListTab(
  storageKey: string,
  validIds: readonly string[],
  defaultTab: string = DEFAULT_CAMPAIGN_LIST_TAB,
): string {
  if (typeof window === "undefined") return defaultTab;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && validIds.includes(stored)) return stored;
  } catch {
    // ignore quota / private mode
  }
  return defaultTab;
}

export function writeStoredCampaignListTab(
  storageKey: string,
  tab: string,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, tab);
  } catch {
    // ignore
  }
}

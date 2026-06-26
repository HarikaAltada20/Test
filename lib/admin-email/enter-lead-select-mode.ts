const MODE_KEY = "email_lead_mode";
const CAMPAIGN_ID_KEY = "email_lead_campaign_id";
const CAMPAIGN_NAME_KEY = "email_lead_campaign_name";
const PRESELECTED_IDS_KEY = "email_lead_preselected_user_ids";

export type EnterLeadSelectModeOptions = {
  campaignId: string;
  campaignName?: string;
  preselectedUserIds?: string[];
};

export function readEmailLeadPreselectedUserIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(PRESELECTED_IDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function clearEmailLeadSelectModeStorage(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(CAMPAIGN_ID_KEY);
  sessionStorage.removeItem(CAMPAIGN_NAME_KEY);
  sessionStorage.removeItem(PRESELECTED_IDS_KEY);
}

export function enterEmailLeadSelectMode({
  campaignId,
  campaignName,
  preselectedUserIds,
}: EnterLeadSelectModeOptions): void {
  if (typeof window === "undefined") return;

  sessionStorage.setItem(MODE_KEY, "1");
  sessionStorage.setItem(CAMPAIGN_ID_KEY, campaignId);
  if (campaignName?.trim()) {
    sessionStorage.setItem(CAMPAIGN_NAME_KEY, campaignName.trim());
  } else {
    sessionStorage.removeItem(CAMPAIGN_NAME_KEY);
  }

  const uniqueIds = Array.from(
    new Set((preselectedUserIds ?? []).filter((id) => id.trim().length > 0)),
  );
  if (uniqueIds.length > 0) {
    sessionStorage.setItem(PRESELECTED_IDS_KEY, JSON.stringify(uniqueIds));
  } else {
    sessionStorage.removeItem(PRESELECTED_IDS_KEY);
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("tab");
  url.searchParams.delete("campaignId");
  window.history.replaceState({}, "", url.toString());

  window.dispatchEvent(
    new CustomEvent("email:enter-lead-select-mode", {
      detail: {
        campaignId,
        campaignName: campaignName?.trim() || null,
        preselectedUserIds: uniqueIds,
      },
    }),
  );
}

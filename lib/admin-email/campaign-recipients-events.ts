export const CAMPAIGN_RECIPIENTS_CHANGED_EVENT =
  "email:campaign-recipients-changed";

export function notifyCampaignRecipientsChanged(campaignId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CAMPAIGN_RECIPIENTS_CHANGED_EVENT, {
      detail: { campaignId },
    }),
  );
}

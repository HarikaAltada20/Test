/**
 * Listing / UI helpers for twitter_campaign_tweets after filter_status removal.
 */

/** Eligibility bucket: counts toward "Eligible" tab (campaign + still on Twitter). */
export function twitterSubmissionIsCampaignEligible(s: {
  is_eligible?: boolean | null;
  deleted_at?: string | null;
}): boolean {
  return s.is_eligible === true && (s.deleted_at == null || s.deleted_at === "");
}

/** Soft-removed on Twitter side. */
export function twitterSubmissionIsDeletedFromTwitter(s: {
  deleted_at?: string | null;
}): boolean {
  return s.deleted_at != null && s.deleted_at !== "";
}

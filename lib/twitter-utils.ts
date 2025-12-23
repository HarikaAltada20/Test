/**
 * Twitter Campaign Utilities
 * Helper functions for reading/writing Twitter campaign data from contest_based_details JSONB
 */

export interface TwitterCampaignConfig {
  campaign_type?: "raid" | "keyword_hashtag" | "awareness";
  keywords?: string[];
  mentions?: string[];
  keywords_requirement_mode?: "all" | "any" | "";
  mentions_requirement_mode?: "all" | "any" | "";
  raid_target?: {
    link?: string | null;
    description?: string | null;
    metrics?: {
      likes?: number | string | null;
      comments?: number | string | null;
      retweets?: number | string | null;
      quote_reposts?: number | string | null;
    };
    keywords_requirement_mode?: string;
    mentions_requirement_mode?: string;
  };
}

/**
 * Get Twitter campaign config from contest data.
 * We now treat contest_based_details.twitter_campaign as the single source
 * of truth and no longer support legacy twitter_* columns on contests.
 */
export function getTwitterCampaign(
  contest: any
): TwitterCampaignConfig | null {
  const campaign = contest?.contest_based_details?.twitter_campaign;
  return campaign && typeof campaign === "object" ? campaign : null;
}

/**
 * Build Twitter campaign config object for saving to JSONB
 */
export function buildTwitterCampaignConfig(params: {
  keywords: string[];
  mentions: string[];
  contentType?: string;
  keywordsRequirementMode?: "all" | "any";
  mentionsRequirementMode?: "all" | "any";
  raidTarget?: {
    link?: string | null;
    description?: string | null;
    metrics?: {
      likes?: string | number | null;
      comments?: string | number | null;
      retweets?: string | number | null;
      quote_reposts?: string | number | null;
    };
  };
}): TwitterCampaignConfig | null {
  const {
    keywords,
    mentions,
    contentType,
    keywordsRequirementMode,
    mentionsRequirementMode,
    raidTarget,
  } = params;

  const filteredKeywords = keywords.filter((k) => k.trim() !== "");
  const filteredMentions = mentions.filter((m) => m.trim() !== "");

  // Don't create config if no Twitter data
  if (filteredKeywords.length === 0 && filteredMentions.length === 0 && !raidTarget) {
    return null;
  }

  const config: TwitterCampaignConfig = {
    campaign_type:
      contentType === "raid"
        ? "raid"
        : contentType === "awareness"
        ? "awareness"
        : "keyword_hashtag",
  };

  if (filteredKeywords.length > 0) {
    config.keywords = filteredKeywords;
  }
  if (filteredMentions.length > 0) {
    config.mentions = filteredMentions;
  }

  // Add requirement modes for keyword/hashtag campaigns
  if (contentType !== "raid") {
    if (keywordsRequirementMode) {
      config.keywords_requirement_mode = keywordsRequirementMode;
    }
    if (mentionsRequirementMode) {
      config.mentions_requirement_mode = mentionsRequirementMode;
    }
  }

  // Add raid target if provided
  if (raidTarget && (contentType === "raid" || contentType === "awareness")) {
    config.raid_target = {
      link: raidTarget.link || null,
      description: raidTarget.description || null,
      metrics: {
        likes: raidTarget.metrics?.likes || null,
        comments: raidTarget.metrics?.comments || null,
        retweets: raidTarget.metrics?.retweets || null,
        quote_reposts: raidTarget.metrics?.quote_reposts || null,
      },
      keywords_requirement_mode: contentType === "raid" ? "" : keywordsRequirementMode || "",
      mentions_requirement_mode: contentType === "raid" ? "" : mentionsRequirementMode || "",
    };
  }

  return config;
}

/**
 * Get Twitter keywords from contest (JSONB only)
 */
export function getTwitterKeywords(contest: any): string[] {
  const campaign = getTwitterCampaign(contest);
  return campaign?.keywords || [];
}

/**
 * Get Twitter mentions from contest (JSONB only)
 */
export function getTwitterMentions(contest: any): string[] {
  const campaign = getTwitterCampaign(contest);
  return campaign?.mentions || [];
}

/**
 * Get Twitter raid target from contest (JSONB only)
 */
export function getTwitterRaidTarget(contest: any) {
  const campaign = getTwitterCampaign(contest);
  return campaign?.raid_target || null;
}


import { createClient } from "@/utils/supabase/client";

export interface HasSubmittedContentResult {
  success: boolean;
  hasSubmittedContent: boolean;
  hasTwitterSubmissions?: boolean;
  hasTwitterCampaignParticipation?: boolean;
  error?: string;
}

/**
 * Check if a creator user has submitted at least one content
 * Only applies to creators
 * @param userId - The user's ID
 * @returns Result indicating whether the user has submitted content
 */
export async function hasSubmittedContent(
  userId: string
): Promise<HasSubmittedContentResult> {
  try {
    const supabase = createClient();

    // Check if user is a creator
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return {
        success: false,
        hasSubmittedContent: false,
        hasTwitterSubmissions: false,
        hasTwitterCampaignParticipation: false,
        error: "Failed to verify user type",
      };
    }

    // Only check for creators
    if (user.user_type !== "creator") {
      return {
        success: true,
        hasSubmittedContent: true, // Non-creators can always leave reviews
        hasTwitterSubmissions: true,
        hasTwitterCampaignParticipation: true,
      };
    }

    // Check for all content submissions
    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("id, platform")
      .eq("creator_id", userId);

    if (error) {
      console.error("Error checking content submissions:", error);
      return {
        success: false,
        hasSubmittedContent: false,
        hasTwitterSubmissions: false,
        hasTwitterCampaignParticipation: false,
        error: "Failed to check content submissions",
      };
    }

    // Check for Twitter campaign participants
    const { data: twitterParticipants, error: twitterError } = await supabase
      .from("twitter_campaign_participants")
      .select("id")
      .eq("creator_id", userId);

    if (twitterError) {
      console.error("Error checking Twitter campaign participation:", twitterError);
      // Continue with submissions check even if Twitter check fails
    }

    const hasSubmissions = submissions && submissions.length > 0;
    const hasTwitter = submissions ? submissions.some(sub => 
      sub.platform && sub.platform.toLowerCase() === 'twitter'
    ) : false;
    const hasTwitterCampaign = !!(twitterParticipants && twitterParticipants.length > 0);

    const hasAnyContent = hasSubmissions || hasTwitterCampaign;

    return {
      success: true,
      hasSubmittedContent: hasAnyContent,
      hasTwitterSubmissions: hasTwitter,
      hasTwitterCampaignParticipation: hasTwitterCampaign,
    };
  } catch (error) {
    console.error("Error in hasSubmittedContent:", error);
    return {
      success: false,
      hasSubmittedContent: false,
      hasTwitterSubmissions: false,
      hasTwitterCampaignParticipation: false,
      error: "Unknown error occurred",
    };
  }
}

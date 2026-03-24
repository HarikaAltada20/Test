import { createClient } from "@/utils/supabase/client";

export interface HasPublishedContestsResult {
  success: boolean;
  hasPublishedContests: boolean;
  error?: string;
}

/**
 * Check if a user has any published contests
 * Only applies to advertisers (brands)
 * @param userId - The user's ID
 * @returns Result indicating whether the user has published contests
 */
export async function hasPublishedContests(
  userId: string
): Promise<HasPublishedContestsResult> {
  try {
    const supabase = createClient();

    // Check if user is an advertiser
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return {
        success: false,
        hasPublishedContests: false,
        error: "Failed to verify user type",
      };
    }

    // Only check for advertisers
    if (user.user_type !== "advertiser") {
      return {
        success: true,
        hasPublishedContests: true, // Non-advertisers can always leave reviews
      };
    }

    // Check for published contests
    const { data: contests, error } = await supabase
      .from("contests_with_status")
      .select("id")
      .eq("advertiser_id", userId)
      .eq("moderation_status", "published");

    if (error) {
      console.error("Error checking published contests:", error);
      return {
        success: false,
        hasPublishedContests: false,
        error: "Failed to check published contests",
      };
    }

    return {
      success: true,
      hasPublishedContests: contests && contests.length > 0,
    };
  } catch (error) {
    console.error("Error in hasPublishedContests:", error);
    return {
      success: false,
      hasPublishedContests: false,
      error: "Unknown error occurred",
    };
  }
}

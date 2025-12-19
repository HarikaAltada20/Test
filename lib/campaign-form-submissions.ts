import { createClient } from "@/utils/supabase/client";

/**
 * Check if user has already submitted the campaign form
 * Used to hide the "Launch Campaign" button after submission
 */
export async function hasCampaignFormSubmitted(
  email: string
): Promise<boolean> {
  if (!email || email.trim() === "") return false;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaign_form_submissions")
    .select("submitted_at")
    .eq("email", email)
    .order("submitted_at", { ascending: false })
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking campaign_form_submissions:", error);
    return false;
  }

  return !!data && !!(data as { submitted_at: string | null }).submitted_at;
}

/**
 * Save campaign form submission to campaign_form_submissions table
 * Used for "Launch Campaign - Get 50% Off" form submissions
 */
export async function saveCampaignFormSubmission(
  email: string
): Promise<boolean> {
  if (!email || email.trim() === "") return false;

  const supabase = createClient();
  const now = new Date().toISOString();

  // Check if submission already exists
  const { data: existing, error: checkError } = await supabase
    .from("campaign_form_submissions")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    console.error(
      "Error checking existing campaign form submission:",
      checkError
    );
    return false;
  }

  if (existing) {
    // Update existing record with submitted_at timestamp
    const { error: updateError } = await supabase
      .from("campaign_form_submissions")
      .update({ submitted_at: now })
      .eq("email", email);

    if (updateError) {
      console.error("Error updating campaign form submission:", updateError);
      return false;
    }
    return true;
  } else {
    // Insert new record
    const { error: insertError } = await supabase
      .from("campaign_form_submissions")
      .insert({
        email: email,
        submitted_at: now,
      });

    if (insertError) {
      console.error("Error saving campaign form submission:", insertError);
      return false;
    }
    return true;
  }
}

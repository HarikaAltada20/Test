import { createClient } from "@/utils/supabase/client";

export async function hasSubmitted(email: string): Promise<boolean> {
  if (!email || email.trim() === "") return false;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("submitted_at")
    .eq("email", email)
    .order("submitted_at", { ascending: false })
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking form_submissions:", error);
    return false;
  }

  return !!data && !!(data as { submitted_at: string | null }).submitted_at;
}

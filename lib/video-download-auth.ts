import { createClient } from "@/utils/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_BULK_VIDEO_DOWNLOADS } from "@/lib/video-download-ui";

export type DownloadAccessUser = {
  id: string;
  email: string | null;
  user_type: "admin" | "advertiser";
};

export type DownloadAccessResult =
  | { allowed: true; user: DownloadAccessUser; supabase: SupabaseClient }
  | { allowed: false; user: null; supabase: null; error: string };

export { MAX_BULK_VIDEO_DOWNLOADS };

/** Soft cap on total downloaded bytes before zipping (~200MB). */
export const MAX_BULK_DOWNLOAD_BYTES = 200 * 1024 * 1024;

export async function verifyAdminOrBrandDownloadAccess(): Promise<DownloadAccessResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        allowed: false,
        user: null,
        supabase: null,
        error: "Authentication required",
      };
    }

    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("user_type, email")
      .eq("id", user.id)
      .single();

    if (userDataError || !userData) {
      return {
        allowed: false,
        user: null,
        supabase: null,
        error: "User data not found",
      };
    }

    if (userData.user_type !== "admin" && userData.user_type !== "advertiser") {
      return {
        allowed: false,
        user: null,
        supabase: null,
        error: "Admin or brand access required",
      };
    }

    return {
      allowed: true,
      user: {
        id: user.id,
        email: userData.email ?? null,
        user_type: userData.user_type,
      },
      supabase,
    };
  } catch (error) {
    console.error("Download access verification error:", error);
    return {
      allowed: false,
      user: null,
      supabase: null,
      error: "Internal server error",
    };
  }
}

export function isAdminDownloadUser(user: DownloadAccessUser): boolean {
  return user.user_type === "admin";
}

/**
 * Advertisers may only access submissions on contests they own.
 * Admins may access any submission.
 */
export function submissionOwnedByDownloadUser(
  user: DownloadAccessUser,
  advertiserId: string | null | undefined,
): boolean {
  if (user.user_type === "admin") return true;
  return !!advertiserId && advertiserId === user.id;
}

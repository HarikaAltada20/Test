import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

/**
 * Begins Google OAuth to link another creator account to the switcher.
 * Stores the current session refresh in account_switch_oauth_pending so the
 * callback can restore the owner after vault upsert.
 * Add this URL to Supabase Auth → Redirect URLs: /api/account-switch/google/callback
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (userError || !user || !session?.refresh_token) {
      return NextResponse.redirect(
        new URL("/auth/signin?error=account_link_unauthorized", request.url),
      );
    }

    const { data: userRow, error: rowError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (rowError || userRow?.user_type !== "creator") {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=account_link_creator_only", request.url),
      );
    }

    const admin = createAdminClient();
    const origin = new URL(request.url).origin;

    await admin
      .from("account_switch_oauth_pending")
      .delete()
      .eq("owner_user_id", user.id);

    await admin
      .from("account_switch_oauth_pending")
      .delete()
      .lt("expires_at", new Date().toISOString());

    const pendingId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insErr } = await admin
      .from("account_switch_oauth_pending")
      .insert({
        id: pendingId,
        owner_user_id: user.id,
        encrypted_owner_refresh: encrypt(session.refresh_token),
        expires_at: expiresAt,
      });

    if (insErr) {
      console.error("[google/start] pending insert:", insErr);
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=account_link_pending_failed", request.url),
      );
    }

    const { data: oauthData, error: oauthError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/api/account-switch/google/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

    if (oauthError || !oauthData?.url) {
      console.error("[google/start] signInWithOAuth:", oauthError);
      await admin.from("account_switch_oauth_pending").delete().eq("id", pendingId);
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=account_link_oauth_start_failed", request.url),
      );
    }

    const res = NextResponse.redirect(oauthData.url);
    res.cookies.set("account_switch_pending_id", pendingId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("[google/start]", e);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=account_link_unexpected", request.url),
    );
  }
}

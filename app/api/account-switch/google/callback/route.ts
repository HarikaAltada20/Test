import { upsertBidirectionalVaultLinks } from "@/lib/account-switch-vault";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function noopCookieClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() {
          return undefined;
        },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const redirectErr = (key: string) => {
    const url = new URL("/dashboard/settings", request.url);
    url.searchParams.set("error", key);
    return NextResponse.redirect(url);
  };

  const clearPendingCookie = (res: NextResponse) => {
    res.cookies.set("account_switch_pending_id", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
  };

  const searchParams = request.nextUrl.searchParams;
  const err = searchParams.get("error");
  if (err) {
    const res = redirectErr("account_link_oauth_denied");
    clearPendingCookie(res);
    return res;
  }

  const code = searchParams.get("code");
  if (!code) {
    const res = redirectErr("account_link_missing_code");
    clearPendingCookie(res);
    return res;
  }

  const pendingId = request.cookies.get("account_switch_pending_id")?.value;
  if (!pendingId) {
    const res = redirectErr("account_link_missing_state");
    clearPendingCookie(res);
    return res;
  }

  const admin = createAdminClient();

  try {
    const supabase = await createClient();
    const { data: exchanged, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !exchanged.session?.refresh_token) {
      console.error("[google/callback] exchange:", exchangeError);
      const res = redirectErr("account_link_exchange_failed");
      clearPendingCookie(res);
      return res;
    }

    const targetSession = exchanged.session;
    const targetUserId = targetSession.user.id;
    const targetRefresh = targetSession.refresh_token;
    const targetEmail = targetSession.user.email ?? null;

    const { data: pending, error: pendErr } = await admin
      .from("account_switch_oauth_pending")
      .select("owner_user_id, encrypted_owner_refresh, expires_at")
      .eq("id", pendingId)
      .maybeSingle();

    if (pendErr || !pending) {
      await supabase.auth.signOut({ scope: "local" });
      const res = redirectErr("account_link_pending_missing");
      clearPendingCookie(res);
      return res;
    }

    if (new Date(pending.expires_at as string).getTime() < Date.now()) {
      await admin.from("account_switch_oauth_pending").delete().eq("id", pendingId);
      const res = redirectErr("account_link_pending_expired");
      clearPendingCookie(res);
      return res;
    }

    const ownerUserId = pending.owner_user_id as string;
    let ownerRefreshPlain: string;
    try {
      ownerRefreshPlain = decrypt(pending.encrypted_owner_refresh as string);
    } catch (e) {
      console.error("[google/callback] decrypt owner refresh:", e);
      const res = redirectErr("account_link_decrypt_failed");
      clearPendingCookie(res);
      return res;
    }

    await admin.from("account_switch_oauth_pending").delete().eq("id", pendingId);

    if (targetUserId === ownerUserId) {
      const noop = noopCookieClient();
      const { data: restored } = await noop.auth.refreshSession({
        refresh_token: ownerRefreshPlain,
      });
      if (restored.session) {
        await supabase.auth.setSession({
          access_token: restored.session.access_token,
          refresh_token: restored.session.refresh_token,
        });
      }
      const res = redirectErr("account_link_same_account");
      clearPendingCookie(res);
      return res;
    }

    const { data: targetRow } = await admin
      .from("users")
      .select("user_type")
      .eq("id", targetUserId)
      .single();

    if (targetRow?.user_type !== "creator") {
      const noop = noopCookieClient();
      const { data: restored } = await noop.auth.refreshSession({
        refresh_token: ownerRefreshPlain,
      });
      if (restored.session) {
        await supabase.auth.setSession({
          access_token: restored.session.access_token,
          refresh_token: restored.session.refresh_token,
        });
      }
      const res = redirectErr("account_link_target_not_creator");
      clearPendingCookie(res);
      return res;
    }

    const { count: vaultCount, error: countErr } = await admin
      .from("user_sessions_vault")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", ownerUserId);

    if (!countErr && (vaultCount ?? 0) >= 5) {
      const noop = noopCookieClient();
      const { data: restored } = await noop.auth.refreshSession({
        refresh_token: ownerRefreshPlain,
      });
      if (restored.session) {
        await supabase.auth.setSession({
          access_token: restored.session.access_token,
          refresh_token: restored.session.refresh_token,
        });
      }
      const res = redirectErr("account_link_max_accounts");
      clearPendingCookie(res);
      return res;
    }

    const vaultResult = await upsertBidirectionalVaultLinks(
      admin,
      ownerUserId,
      targetUserId,
      ownerRefreshPlain,
      targetRefresh,
      { linkedTargetEmail: targetEmail },
    );

    if (!vaultResult.ok) {
      const noop = noopCookieClient();
      const { data: restored } = await noop.auth.refreshSession({
        refresh_token: ownerRefreshPlain,
      });
      if (restored.session) {
        await supabase.auth.setSession({
          access_token: restored.session.access_token,
          refresh_token: restored.session.refresh_token,
        });
      }
      const res = redirectErr("account_link_vault_failed");
      clearPendingCookie(res);
      return res;
    }

    await admin.rpc("log_action", {
      p_action: "account_link_added",
      p_metadata: { linked_user_id: targetUserId, via: "google_oauth" },
      p_user_id: ownerUserId,
    });

    const noop = noopCookieClient();
    const { data: restored, error: refreshOwnerErr } =
      await noop.auth.refreshSession({
        refresh_token: ownerRefreshPlain,
      });

    if (refreshOwnerErr || !restored.session) {
      console.error("[google/callback] restore owner session:", refreshOwnerErr);
      const res = redirectErr("account_link_restore_owner_failed");
      clearPendingCookie(res);
      return res;
    }

    const { error: setErr } = await supabase.auth.setSession({
      access_token: restored.session.access_token,
      refresh_token: restored.session.refresh_token,
    });

    if (setErr) {
      console.error("[google/callback] setSession owner:", setErr);
      const res = redirectErr("account_link_set_session_failed");
      clearPendingCookie(res);
      return res;
    }

    const okUrl = new URL("/dashboard/settings", origin);
    okUrl.searchParams.set("success", "account_linked_google");
    const res = NextResponse.redirect(okUrl);
    clearPendingCookie(res);
    return res;
  } catch (e) {
    console.error("[google/callback]", e);
    const res = redirectErr("account_link_unexpected");
    clearPendingCookie(res);
    return res;
  }
}

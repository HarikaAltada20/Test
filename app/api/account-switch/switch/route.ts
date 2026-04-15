import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    // 1. Use getUser() for security as recommended by Supabase
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      console.log("Account Switch: Unauthorized access or session missing");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Capture the current session to get the latest refresh token before we switch
    const { data: { session: currentSession } } = await supabase.auth.getSession();

    if (!currentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is a creator
    const { data: currentUserData, error: currentUserError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", currentUser.id)
      .single();

    if (currentUserError || currentUserData?.user_type !== "creator") {
      return NextResponse.json({ 
        error: "Only creator accounts can switch between accounts" 
      }, { status: 403 });
    }

    const { target_user_id } = await req.json();

    if (!target_user_id) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    // Check if target user is also a creator
    const { data: targetUserData, error: targetUserError } = await adminSupabase
      .from("users")
      .select("id, user_type, email")
      .eq("id", target_user_id)
      .single();

    if (targetUserError) {
      return NextResponse.json({ error: "Target account not found" }, { status: 404 });
    }

    // 2. Retrieve encrypted refresh token from vault
    const { data: vaultEntry, error: vaultError } = await adminSupabase
      .from("user_sessions_vault")
      .select("encrypted_refresh_token")
      .eq("owner_user_id", currentUser.id)
      .eq("target_user_id", target_user_id)
      .single();

    if (vaultError || !vaultEntry) {
      return NextResponse.json({ 
        error: "No saved session found for this account" 
      }, { status: 404 });
    }

    // 3. Decrypt the refresh token
    const refreshToken = decrypt(vaultEntry.encrypted_refresh_token);

    // 4. Perform a session refresh using a NO-OP client first
    // This is crucial: it prevents the primary cookies from being cleared if target refresh fails.
    const verifyClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get() { return undefined },
          set() {},
          remove() {},
        },
      }
    );

    const { data: refreshData, error: refreshError } = await verifyClient.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (refreshError || !refreshData.session) {
      console.error("Account Switch: Refresh failed for target user:", target_user_id, refreshError?.message);
      
      // Automatic cleanup: If token is "Not Found", it's definitely stale/used.
      // We remove it from the vault so the user can re-auth cleanly.
      if (refreshError?.message?.toLowerCase().includes("not found") || refreshError?.message?.toLowerCase().includes("expired")) {
        await adminSupabase
          .from("user_sessions_vault")
          .delete()
          .eq("owner_user_id", currentUser.id)
          .eq("target_user_id", target_user_id);
      }

      return NextResponse.json({ 
        error: "Target session expired or invalid. Please link the account again." 
      }, { status: 401 });
    }

    // 5. Apply the NEW session to the primary client to update cookies
    await supabase.auth.setSession({
      access_token: refreshData.session.access_token,
      refresh_token: refreshData.session.refresh_token
    });

    // 6. Update the vault with new tokens bidirectionally
    const encryptedOldToken = encrypt(currentSession.refresh_token);
    const newEncryptedToken = encrypt(refreshData.session.refresh_token);
    
    // Cross-link: User B now "owns" a link to User A
    await adminSupabase
      .from("user_sessions_vault")
      .upsert({
        owner_user_id: target_user_id,
        target_user_id: currentUser.id,
        encrypted_refresh_token: encryptedOldToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_user_id,target_user_id' });

    // Update existing link: User A "owns" a link to User B using the NEW token
    await adminSupabase
      .from("user_sessions_vault")
      .update({
        encrypted_refresh_token: newEncryptedToken,
        updated_at: new Date().toISOString(),
      })
      .eq("owner_user_id", currentUser.id)
      .eq("target_user_id", target_user_id);

    // Audit Log
    await adminSupabase.rpc("log_action", { 
      p_action: "account_switch_success", 
      p_metadata: { from: currentUser.id, to: target_user_id },
      p_user_id: currentUser.id
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Switch Account Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

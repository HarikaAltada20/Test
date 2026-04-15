import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { decrypt, encrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const currentUser = currentSession?.user;

    if (!currentUser || !currentSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if current user is a creator - only creators can switch accounts
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

    // Check if target user is also a creator - only creators can be switched to
    const { data: targetUserData, error: targetUserError } = await adminSupabase
      .from("users")
      .select("id, user_type, email")
      .eq("id", target_user_id)
      .single();

    if (targetUserError) {
      console.error("Target user lookup error:", targetUserError);
      return NextResponse.json({ 
        error: "Target account not found" 
      }, { status: 404 });
    }

    if (targetUserData?.user_type !== "creator") {
      console.log("Blocking switch to non-creator account:", targetUserData?.email, "Type:", targetUserData?.user_type);
      return NextResponse.json({ 
        error: "Only creator accounts can be switched to" 
      }, { status: 403 });
    }

    // 1. Retrieve encrypted refresh token from vault
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

    // 2. Decrypt the refresh token
    const refreshToken = decrypt(vaultEntry.encrypted_refresh_token);

    // 3. Perform a session refresh using the target account's refresh token
    // This updates the local cookies to point to the new account
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (refreshError || !refreshData.session) {
      // If the refresh token is expired or revoked, remove the link (using admin to cleanup)
      await adminSupabase
        .from("user_sessions_vault")
        .delete()
        .eq("owner_user_id", currentUser.id)
        .eq("target_user_id", target_user_id);

      return NextResponse.json({ 
        error: "Session expired. Please log in again to this account." 
      }, { status: 401 });
    }

    // 4. Update the vault with new tokens bidirectionally
    const encryptedOldToken = encrypt(currentSession.refresh_token);
    const newEncryptedToken = encrypt(refreshData.session.refresh_token);
    
    await adminSupabase
      .from("user_sessions_vault")
      .upsert({
        owner_user_id: target_user_id,
        target_user_id: currentUser.id,
        encrypted_refresh_token: encryptedOldToken,
        updated_at: new Date().toISOString(),
      });

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

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";
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

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 1. Authenticate the NEW account
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json({ 
        error: authError?.message || "Invalid credentials" 
      }, { status: 401 });
    }

    const targetUserId = authData.user.id;
    const targetRefreshToken = authData.session.refresh_token;

    if (targetUserId === currentUser.id) {
      return NextResponse.json({ error: "This account is already active" }, { status: 400 });
    }

    // 2. Encrypt tokens for both ways to allow bidirectional switching
    const encryptedCurrentToken = encrypt(currentSession.refresh_token);
    const encryptedTargetToken = encrypt(targetRefreshToken);

    // 3. Store targeted account in current user's vault
    // Note: onConflict is essential to avoid duplicate key errors
    const { error: vaultError1 } = await adminSupabase
      .from("user_sessions_vault")
      .upsert({
        owner_user_id: currentUser.id,
        target_user_id: targetUserId,
        encrypted_refresh_token: encryptedTargetToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_user_id,target_user_id' });

    // 4. Store current account in targeted user's vault (cross-link)
    const { error: vaultError2 } = await adminSupabase
      .from("user_sessions_vault")
      .upsert({
        owner_user_id: targetUserId,
        target_user_id: currentUser.id,
        encrypted_refresh_token: encryptedCurrentToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_user_id,target_user_id' });

    if (vaultError1 || vaultError2) {
      console.error("Vault Error:", vaultError1 || vaultError2);
      return NextResponse.json({ error: "Failed to store session link" }, { status: 500 });
    }

    // Audit Log
    await adminSupabase.rpc("log_action", { 
      p_action: "account_link_added", 
      p_metadata: { linked_user_id: targetUserId },
      p_user_id: currentUser.id
    });

    return NextResponse.json({ 
      success: true, 
      user: {
        id: targetUserId,
        email: authData.user.email
      }
    });

  } catch (err: any) {
    console.error("Add Account Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

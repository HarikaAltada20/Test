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

    // Check if current user is a creator - only creators can add accounts
    const { data: currentUserData, error: currentUserError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", currentUser.id)
      .single();

    if (currentUserError || currentUserData?.user_type !== "creator") {
      return NextResponse.json({ 
        error: "Only creator accounts can add linked accounts" 
      }, { status: 403 });
    }

    // Check if user has reached the account limit (5 accounts max)
    const { data: existingAccounts, error: countError } = await supabase
      .from("user_sessions_vault")
      .select("target_user_id")
      .eq("owner_user_id", currentUser.id);

    if (countError) {
      console.error("Error checking account count:", countError);
      return NextResponse.json({ error: "Failed to check account limit" }, { status: 500 });
    }

    if (existingAccounts && existingAccounts.length >= 5) {
      return NextResponse.json({ 
        error: "Maximum account limit reached (5 accounts). Remove an existing account to add a new one." 
      }, { status: 400 });
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // 1. First, check if email belongs to a creator account before authenticating
    const { data: emailCheckData, error: emailCheckError } = await adminSupabase
      .from("users")
      .select("id, user_type")
      .eq("email", email)
      .single();

    if (emailCheckError) {
      console.error("Email lookup error:", emailCheckError);
      return NextResponse.json({ 
        error: "Account not found or invalid credentials" 
      }, { status: 401 });
    }

    if (emailCheckData?.user_type !== "creator") {
      console.log("Blocking non-creator account:", email, "Type:", emailCheckData?.user_type);
      return NextResponse.json({ 
        error: "Only creator accounts can be linked for switching" 
      }, { status: 403 });
    }

    // 2. Authenticate the NEW account (now we know it's a creator)
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

    // 3. Double-check user type as a safety measure
    const { data: targetUserData, error: targetUserError } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", targetUserId)
      .single();

    if (targetUserError || targetUserData?.user_type !== "creator") {
      console.error("Target user validation failed:", targetUserError, targetUserData);
      return NextResponse.json({ 
        error: "Only creator accounts can be linked for switching" 
      }, { status: 403 });
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

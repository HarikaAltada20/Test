import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { encrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

    // 2. Authenticate the NEW account using an isolated/no-op cookie client.
    // This prevents mutating the currently logged-in user's session cookies.
    const isolatedAuthClient = createServerClient(
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
    const { data: authData, error: authError } =
      await isolatedAuthClient.auth.signInWithPassword({
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

    // Read existing reciprocal links so we can rollback safely on partial failure.
    const [{ data: existingForward }, { data: existingReverse }] =
      await Promise.all([
        adminSupabase
          .from("user_sessions_vault")
          .select("owner_user_id, target_user_id, encrypted_refresh_token, updated_at")
          .eq("owner_user_id", currentUser.id)
          .eq("target_user_id", targetUserId)
          .maybeSingle(),
        adminSupabase
          .from("user_sessions_vault")
          .select("owner_user_id, target_user_id, encrypted_refresh_token, updated_at")
          .eq("owner_user_id", targetUserId)
          .eq("target_user_id", currentUser.id)
          .maybeSingle(),
      ]);

    const rollbackVaultPair = async () => {
      const restoreOne = async (
        ownerUserId: string,
        targetUserIdToRestore: string,
        previous:
          | {
              owner_user_id: string;
              target_user_id: string;
              encrypted_refresh_token: string;
              updated_at: string | null;
            }
          | null,
      ) => {
        if (previous) {
          await adminSupabase.from("user_sessions_vault").upsert(
            {
              owner_user_id: previous.owner_user_id,
              target_user_id: previous.target_user_id,
              encrypted_refresh_token: previous.encrypted_refresh_token,
              updated_at: previous.updated_at ?? new Date().toISOString(),
            },
            { onConflict: "owner_user_id,target_user_id" },
          );
          return;
        }
        await adminSupabase
          .from("user_sessions_vault")
          .delete()
          .eq("owner_user_id", ownerUserId)
          .eq("target_user_id", targetUserIdToRestore);
      };

      await restoreOne(currentUser.id, targetUserId, existingForward ?? null);
      await restoreOne(targetUserId, currentUser.id, existingReverse ?? null);
    };

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
    if (vaultError1) {
      console.error("Vault forward link error:", vaultError1);
      await rollbackVaultPair().catch((rollbackErr) =>
        console.error("Rollback failed after forward link error:", rollbackErr),
      );
      return NextResponse.json(
        { error: "Failed to store session link" },
        { status: 500 },
      );
    }

    // 4. Store current account in targeted user's vault (cross-link)
    const { error: vaultError2 } = await adminSupabase
      .from("user_sessions_vault")
      .upsert({
        owner_user_id: targetUserId,
        target_user_id: currentUser.id,
        encrypted_refresh_token: encryptedCurrentToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'owner_user_id,target_user_id' });

    if (vaultError2) {
      console.error("Vault reverse link error:", vaultError2);
      await rollbackVaultPair().catch((rollbackErr) =>
        console.error("Rollback failed after reverse link error:", rollbackErr),
      );
      return NextResponse.json(
        { error: "Failed to store session link" },
        { status: 500 },
      );
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

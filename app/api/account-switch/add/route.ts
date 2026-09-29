import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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

    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

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
    if (!isUuid(targetUserId)) {
      return NextResponse.json({ error: "Invalid target account" }, { status: 400 });
    }

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

    const { encrypt } = await import("@/lib/encryption");
    const { data: linkResult, error: linkErr } = await adminSupabase.rpc(
      "account_switch_link_shared_pool",
      {
        p_owner_user_id: currentUser.id,
        p_target_user_id: targetUserId,
        p_owner_encrypted_refresh: encrypt(currentSession.refresh_token),
        p_target_encrypted_refresh: encrypt(targetRefreshToken),
        p_target_email_hint: authData.user.email ?? null,
      },
    );

    if (linkErr) {
      console.error("[account-switch/add] link rpc:", linkErr);
      return NextResponse.json({ error: "Failed to store session link" }, { status: 500 });
    }
    const rpcOk = !!(linkResult as { ok?: boolean } | null)?.ok;
    if (!rpcOk) {
      const rpcError =
        (linkResult as { error?: string } | null)?.error ||
        "Failed to store session link";
      const status =
        rpcError.includes("Maximum account limit") ||
        rpcError.includes("maximum limit")
          ? 400
          : 500;
      return NextResponse.json({ error: rpcError }, { status });
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

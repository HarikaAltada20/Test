import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- VAULT SYNC ---
    // Every time we list accounts, we take the opportunity to update any 
    // vault entries pointing TO the current user with the latest refresh token.
    // This prevents "Refresh Token Not Found" errors caused by background rotations.
    if (session?.refresh_token) {
      const { encrypt } = await import("@/lib/encryption");
      const { createAdminClient } = await import("@/utils/supabase/admin");
      const adminClient = createAdminClient();
      const encryptedToken = encrypt(session.refresh_token);

      await adminClient
        .from("user_sessions_vault")
        .update({
          encrypted_refresh_token: encryptedToken,
          updated_at: new Date().toISOString()
        })
        .eq("target_user_id", user.id);
    }
    // ------------------

    // Fetch saved accounts from vault
    // Note: We use the explicit ID join first, then a fallback if relationship cache is stale
    const { data: vaultEntries, error } = await supabase
      .from("user_sessions_vault")
      .select(`
        target_user_id,
        linked_target_email,
        created_at,
        target_user:users!user_sessions_vault_target_user_id_fkey (
          full_name,
          username,
          profile_picture_url,
          user_type
        )
      `)
      .eq("owner_user_id", user.id);

    if (error) {
      console.error("Fetch Vault Error:", error);
      
      // Fallback: Fetch IDs first, then fetch user details separately
      const { data: simpleEntries } = await supabase
        .from("user_sessions_vault")
        .select("target_user_id, linked_target_email, created_at")
        .eq("owner_user_id", user.id);
      
      if (simpleEntries && simpleEntries.length > 0) {
        const ids = simpleEntries.map(e => e.target_user_id);
        const { data: userDetails } = await supabase
          .from("users")
          .select("id, username, full_name, profile_picture_url, user_type")
          .in("id", ids);
        
        const linkedAccounts = simpleEntries.map((entry) => {
          const detail = userDetails?.find((u) => u.id === entry.target_user_id);
          const e = entry as {
            linked_target_email?: string | null;
            created_at?: string;
          };
          return {
            id: entry.target_user_id,
            username: detail?.username || detail?.full_name || "User",
            avatar_url: detail?.profile_picture_url,
            user_type: detail?.user_type,
            relink_email_hint: e.linked_target_email ?? null,
            connected_at: e.created_at ?? null,
          };
        });
        return NextResponse.json({ accounts: linkedAccounts });
      }
      
      return NextResponse.json({ accounts: [] });
    }

    const linkedAccounts = vaultEntries.map((entry) => {
      const u = entry.target_user as {
        username?: string;
        full_name?: string;
        profile_picture_url?: string;
        user_type?: string;
      };
      const row = entry as {
        linked_target_email?: string | null;
        created_at?: string;
      };
      return {
        id: entry.target_user_id,
        username: u?.username || u?.full_name || "User",
        avatar_url: u?.profile_picture_url,
        user_type: u?.user_type,
        relink_email_hint: row.linked_target_email ?? null,
        connected_at: row.created_at ?? null,
      };
    });

    return NextResponse.json({ accounts: linkedAccounts });

  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

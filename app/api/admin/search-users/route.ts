import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseUserSearchParams } from "@/lib/admin-user-search";

export const dynamic = "force-dynamic";

const RESULT_LIMIT = 20;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fallbackSearch(
  supabase: ReturnType<typeof createAdminClient>,
  parsed: Extract<ReturnType<typeof parseUserSearchParams>, { ok: true }>
) {
  let query = supabase
    .from("users")
    .select("id, email, full_name, username, user_type, coins, profile_picture_url");
  if (parsed.type !== "all") query = query.eq("user_type", parsed.type);

  const pattern = `%${parsed.term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  if (parsed.scope === "id" || (parsed.scope === "all" && UUID_RE.test(parsed.term))) {
    if (!UUID_RE.test(parsed.term)) {
      // ID prefixes need the database function.
      return NextResponse.json({ success: true, users: [], hasMore: false });
    }
    query = query.eq("id", parsed.term);
  } else if (parsed.scope === "username") {
    query = query.ilike("username", pattern);
  } else if (parsed.scope === "name") {
    query = query.ilike("full_name", pattern);
  } else if (parsed.scope === "email") {
    query = query.ilike("email", pattern);
  } else {
    // Commas and parentheses would break PostgREST's or() syntax.
    const orPattern = pattern.replace(/[,()]/g, "");
    query = query.or(
      `email.ilike.${orPattern},full_name.ilike.${orPattern},username.ilike.${orPattern}`
    );
  }

  const { data, error } = await query.limit(RESULT_LIMIT + 1);
  if (error) {
    console.error("Error searching users (fallback):", error);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
  const rows = data ?? [];
  return NextResponse.json(
    { success: true, users: rows.slice(0, RESULT_LIMIT), hasMore: rows.length > RESULT_LIMIT },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(req: NextRequest) {
  try {
    // Verify admin access
    const { isAdmin, error: adminError } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json(
        { error: adminError || "Admin access required" },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const parsed = parseUserSearchParams({
      q: searchParams.get("q"),
      scope: searchParams.get("scope"),
      type: searchParams.get("type"),
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Matching and ranking (exact, then starts with, then contains) happen in
    // public.admin_search_users, which only service_role can execute.
    // Ask for one extra row so the UI can say there are more results.
    const { data, error } = await supabase.rpc("admin_search_users", {
      p_scope: parsed.scope,
      p_query: parsed.term,
      p_user_type: parsed.type,
      p_limit: RESULT_LIMIT + 1,
    });

    // Until db/migrations/20261015_admin_search_users.sql is applied the RPC
    // does not exist (PGRST202); fall back to a plain scoped ILIKE query.
    if (error?.code === "PGRST202") {
      return fallbackSearch(supabase, parsed);
    }

    if (error) {
      console.error("Error searching users:", error);
      return NextResponse.json(
        { error: "Failed to search users" },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown[];
    return NextResponse.json(
      {
        success: true,
        users: rows.slice(0, RESULT_LIMIT),
        hasMore: rows.length > RESULT_LIMIT,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in user search:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

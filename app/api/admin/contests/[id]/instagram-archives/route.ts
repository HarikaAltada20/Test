import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/utils/admin-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { INSTAGRAM_ARCHIVES_BATCH_SIZE } from "@/lib/instagram-analytics-export";
import {
  buildInstagramProfileSnapshot,
  type InstagramProfileSnapshot,
} from "@/lib/platform-social-archive";

export const dynamic = "force-dynamic";

function parseInstagramAccount(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * POST: Batch-load instagram_archive + live profile snapshots for export.
 * Body: { creatorIds: string[] }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: contestId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const creatorIds: string[] = Array.isArray(body.creatorIds)
    ? body.creatorIds
        .map((id: unknown) => String(id ?? "").trim())
        .filter((id: string): id is string => id.length > 0)
    : [];

  if (creatorIds.length === 0) {
    return NextResponse.json({ archives: {}, profileSummaries: {} });
  }

  const uniqueIds = [...new Set(creatorIds)].slice(0, INSTAGRAM_ARCHIVES_BATCH_SIZE);
  const admin = createAdminClient();

  const { data: members, error: memberErr } = await admin
    .from("submissions")
    .select("creator_id")
    .eq("contest_id", contestId)
    .in("creator_id", uniqueIds);

  if (memberErr) {
    console.error("[instagram-archives] membership check:", memberErr);
    return NextResponse.json(
      { error: "Failed to verify creators" },
      { status: 500 },
    );
  }

  const allowed = new Set(
    (members ?? []).map((r) => String(r.creator_id)).filter(Boolean),
  );
  const idsToLoad = uniqueIds.filter((id) => allowed.has(id));
  if (idsToLoad.length === 0) {
    return NextResponse.json({ archives: {}, profileSummaries: {} });
  }

  const { data: profiles, error: profErr } = await admin
    .from("creator_profiles")
    .select("id, instagram_archive, instagram_account")
    .in("id", idsToLoad);

  if (profErr) {
    console.error("[instagram-archives] load:", profErr);
    return NextResponse.json(
      { error: "Failed to load Instagram archives" },
      { status: 500 },
    );
  }

  const archives: Record<string, unknown> = {};
  const profileSummaries: Record<string, InstagramProfileSnapshot | null> = {};

  for (const row of profiles ?? []) {
    if (!row.id) continue;
    const id = String(row.id);
    archives[id] = row.instagram_archive ?? null;
    const account = parseInstagramAccount(row.instagram_account);
    profileSummaries[id] = buildInstagramProfileSnapshot(account);
  }

  return NextResponse.json({ archives, profileSummaries });
}

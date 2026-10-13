import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import { createAdminClient } from "@/utils/supabase/admin";
import { resolveContestPoolBudgetCents } from "@/lib/video-platform-campaigns";
import InviteLandingClient, { type InvitePreview } from "./client";

/** "youtube,instagram" → ["youtube", "instagram"]. */
function parsePlatformList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

/**
 * Prize pool for the invite card. The preview function only returns a
 * contest id for live links (or members), and budget details stay on the
 * server: only the final number is passed to the page.
 */
async function loadPrizeCents(contestId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("contests")
    .select("contest_type, contest_based_details, platform")
    .eq("id", contestId)
    .maybeSingle();
  if (error || !data) return 0;
  return resolveContestPoolBudgetCents(
    data.contest_type,
    data.contest_based_details as Record<string, unknown> | null,
    data.platform,
  );
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Campaign invite",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: previewRows }, user] = await Promise.all([
    supabase.rpc("get_contest_invite_preview", { p_token: token }),
    getSessionUser(supabase),
  ]);

  const row = Array.isArray(previewRows) ? previewRows[0] : previewRows;
  const prizeCents = row?.contest_id ? await loadPrizeCents(row.contest_id) : 0;
  const preview: InvitePreview = {
    contestId: row?.contest_id ?? null,
    title: row?.title ?? null,
    brandName: row?.brand_name ?? null,
    thumbnailUrl: row?.thumbnail_url ?? null,
    isPublished: row?.is_published === true,
    linkStatus: row?.link_status ?? "not_found",
    alreadyMember: row?.already_member === true,
    prizeCents: prizeCents > 0 ? prizeCents : null,
    platforms: parsePlatformList(row?.platform),
    startDate: row?.start_date ?? null,
    endDate: row?.end_date ?? null,
  };

  let viewerType: "signed_out" | "creator" | "other" = "signed_out";
  if (user) {
    const { data: userRow } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();
    viewerType = userRow?.user_type === "creator" ? "creator" : "other";
  }

  return <InviteLandingClient token={token} preview={preview} viewerType={viewerType} />;
}

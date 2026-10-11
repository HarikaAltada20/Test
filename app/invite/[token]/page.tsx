import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { getSessionUser } from "@/utils/supabase/auth-server";
import InviteLandingClient, { type InvitePreview } from "./client";

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
  const preview: InvitePreview = {
    contestId: row?.contest_id ?? null,
    title: row?.title ?? null,
    brandName: row?.brand_name ?? null,
    thumbnailUrl: row?.thumbnail_url ?? null,
    isPublished: row?.is_published === true,
    linkStatus: row?.link_status ?? "not_found",
    alreadyMember: row?.already_member === true,
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

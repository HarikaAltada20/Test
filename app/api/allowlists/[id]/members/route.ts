import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  addAllowlistMembers,
  assertCanManageAllowlist,
  campaignAccessErrorResponse,
  fetchAllRows,
  getAccessActor,
  getServiceClient,
  loadUserDisplay,
  resolveUsernamesToUserIds,
} from "@/lib/campaign-access-server";
import type { AllowlistMember } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

/** Keeps `in.(...)` filters well under URL length limits. */
const DELETE_CHUNK = 200;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/allowlists/:id/members */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    const allowlist = await assertCanManageAllowlist(admin, actor, id);

    const rows = await fetchAllRows<{ user_id: string; added_at: string }>(() =>
      admin
        .from("brand_allowlist_members")
        .select("user_id, added_at")
        .eq("allowlist_id", id)
        .order("added_at", { ascending: false })
        .order("user_id"),
    );

    const users = await loadUserDisplay(
      admin,
      rows.map((r) => r.user_id),
    );
    const members: AllowlistMember[] = rows.map((r) => {
      const u = users.get(r.user_id);
      return {
        user_id: r.user_id,
        username: u?.username ?? null,
        full_name: u?.full_name ?? null,
        profile_picture_url: u?.profile_picture_url ?? null,
        added_at: r.added_at,
      };
    });

    return NextResponse.json({ allowlist, members });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** POST /api/allowlists/:id/members — { usernames } */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageAllowlist(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    if (!body?.usernames) throw new CampaignAccessError("usernames is required", 400);

    const resolution = await resolveUsernamesToUserIds(admin, body.usernames);
    const added = await addAllowlistMembers(
      admin,
      id,
      resolution.found.map((f) => f.user_id),
      actor.userId,
    );

    return NextResponse.json({
      added,
      alreadyOnList: resolution.found.length - added,
      notFound: resolution.notFound,
      invalid: resolution.invalid,
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** DELETE /api/allowlists/:id/members — { userIds } */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageAllowlist(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body?.userIds)
      ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
      : [];
    if (userIds.length === 0) throw new CampaignAccessError("userIds is required", 400);

    for (let i = 0; i < userIds.length; i += DELETE_CHUNK) {
      const { error } = await admin
        .from("brand_allowlist_members")
        .delete()
        .eq("allowlist_id", id)
        .in("user_id", userIds.slice(i, i + DELETE_CHUNK));
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

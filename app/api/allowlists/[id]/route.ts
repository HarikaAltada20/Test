import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageAllowlist,
  campaignAccessErrorResponse,
  createAllowlistWithMembers,
  getAccessActor,
  getServiceClient,
  renameAllowlist,
} from "@/lib/campaign-access-server";
import { MAX_ALLOWLIST_NAME_LENGTH, normalizeAllowlistName } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/allowlists/:id — { name } */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageAllowlist(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const name = normalizeAllowlistName(body?.name);
    if (!name) throw new CampaignAccessError("List name is required (max 100 characters)", 400);

    const allowlist = await renameAllowlist(admin, id, name);
    return NextResponse.json({ allowlist });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** DELETE /api/allowlists/:id — campaign access already copied from this list is kept. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageAllowlist(admin, actor, id);

    const { error } = await admin.from("brand_allowlists").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** POST /api/allowlists/:id?action=duplicate — { name? } */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    if (searchParams.get("action") !== "duplicate") {
      throw new CampaignAccessError("Unsupported action", 400);
    }

    const actor = await getAccessActor();
    const admin = getServiceClient();
    const source = await assertCanManageAllowlist(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const name =
      normalizeAllowlistName(body?.name) ??
      `${source.name} (copy)`.slice(0, MAX_ALLOWLIST_NAME_LENGTH);

    const { data: members, error } = await admin
      .from("brand_allowlist_members")
      .select("user_id")
      .eq("allowlist_id", id);
    if (error) throw error;

    const allowlist = await createAllowlistWithMembers(admin, {
      ownerId: source.advertiser_id,
      name,
      createdBy: actor.userId,
      userIds: (members || []).map((m) => m.user_id),
    });
    return NextResponse.json({ allowlist });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

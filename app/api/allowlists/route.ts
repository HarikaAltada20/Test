import { NextResponse } from "next/server";
import {
  ALLOWLIST_COLUMNS,
  CampaignAccessError,
  campaignAccessErrorResponse,
  createAllowlistWithMembers,
  getAccessActor,
  getServiceClient,
  loadAllowlistSummaries,
  resolveAllowlistOwner,
  resolveUsernamesToUserIds,
  type AllowlistRow,
} from "@/lib/campaign-access-server";
import { normalizeAllowlistName } from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

/** GET /api/allowlists?advertiserId= — saved lists for the brand. */
export async function GET(request: Request) {
  try {
    const actor = await getAccessActor();
    const { searchParams } = new URL(request.url);
    const ownerId = resolveAllowlistOwner(actor, searchParams.get("advertiserId"));

    const admin = getServiceClient();
    const { data, error } = await admin
      .from("brand_allowlists")
      .select(ALLOWLIST_COLUMNS)
      .eq("advertiser_id", ownerId)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const lists = (data || []) as AllowlistRow[];
    const summaries = await loadAllowlistSummaries(
      admin,
      lists.map((l) => l.id),
    );
    return NextResponse.json({
      allowlists: lists.map((l) => ({ ...l, ...summaries.get(l.id) })),
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** POST /api/allowlists — { name, usernames?, advertiserId? } */
export async function POST(request: Request) {
  try {
    const actor = await getAccessActor();
    const body = await request.json().catch(() => ({}));
    const ownerId = resolveAllowlistOwner(actor, body?.advertiserId);
    const name = normalizeAllowlistName(body?.name);
    if (!name) throw new CampaignAccessError("List name is required (max 100 characters)", 400);

    const admin = getServiceClient();
    const resolution = body?.usernames
      ? await resolveUsernamesToUserIds(admin, body.usernames)
      : { found: [], notFound: [], invalid: [] };

    const created = await createAllowlistWithMembers(admin, {
      ownerId,
      name,
      createdBy: actor.userId,
      userIds: resolution.found.map((f) => f.user_id),
    });

    return NextResponse.json({
      allowlist: created,
      added: resolution.found.length,
      notFound: resolution.notFound,
      invalid: resolution.invalid,
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}
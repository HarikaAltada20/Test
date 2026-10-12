import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageAllowlist,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  WRITE_BATCH_SIZE,
  createAllowlistWithMembers,
  fetchAllRows,
  getAccessActor,
  getServiceClient,
  loadAllowlistMemberIds,
  loadCampaignAccessUserIds,
  loadUserDisplay,
  resolveUsernamesToUserIds,
} from "@/lib/campaign-access-server";
import {
  normalizeAllowlistName,
  type ContestAccessMember,
  type ContestAccessSource,
} from "@/lib/campaign-access";
import { invalidateOpportunitiesListCache } from "@/lib/campaign-list-cache";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const INSERT_CHUNK = WRITE_BATCH_SIZE;
/** Keeps `in.(...)` filters well under URL length limits. */
const DELETE_CHUNK = 200;

type AccessListRow = {
  user_id: string;
  source: string;
  source_allowlist_id: string | null;
  source_invite_link_id: string | null;
  added_at: string;
};

async function addToAccessList(
  admin: ReturnType<typeof getServiceClient>,
  contestId: string,
  userIds: string[],
  source: ContestAccessSource,
  addedBy: string,
  sourceAllowlistId: string | null = null,
): Promise<number> {
  const unique = Array.from(new Set(userIds));
  let added = 0;
  for (let i = 0; i < unique.length; i += INSERT_CHUNK) {
    const rows = unique.slice(i, i + INSERT_CHUNK).map((user_id) => ({
      contest_id: contestId,
      user_id,
      source,
      source_allowlist_id: sourceAllowlistId,
      added_by: addedBy,
    }));
    const { data, error } = await admin
      .from("contest_access_list")
      .upsert(rows, { onConflict: "contest_id,user_id", ignoreDuplicates: true })
      .select("user_id");
    if (error) throw error;
    added += data?.length ?? 0;
  }
  return added;
}

/** GET /api/contests/:id/access-list — roster with usernames and sources. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    const contest = await assertCanManageCampaignAccess(admin, actor, id);

    const rows = await fetchAllRows<AccessListRow>(() =>
      admin
        .from("contest_access_list")
        .select("user_id, source, source_allowlist_id, source_invite_link_id, added_at")
        .eq("contest_id", id)
        .order("added_at", { ascending: false })
        .order("user_id"),
    );

    const users = await loadUserDisplay(admin, rows.map((r) => r.user_id));
    const listIds = Array.from(
      new Set(rows.map((r) => r.source_allowlist_id).filter(Boolean)),
    ) as string[];
    const listNames = new Map<string, string>();
    if (listIds.length > 0) {
      const { data: lists } = await admin
        .from("brand_allowlists")
        .select("id, name")
        .in("id", listIds);
      for (const l of lists || []) listNames.set(l.id, l.name);
    }
    const linkIds = Array.from(
      new Set(rows.map((r) => r.source_invite_link_id).filter(Boolean)),
    ) as string[];
    const linkLabels = new Map<string, string | null>();
    if (linkIds.length > 0) {
      const { data: links } = await admin
        .from("contest_invite_links")
        .select("id, label")
        .in("id", linkIds);
      for (const l of links || []) linkLabels.set(l.id, l.label);
    }

    const members: ContestAccessMember[] = rows.map((r) => {
      const u = users.get(r.user_id);
      return {
        user_id: r.user_id,
        username: u?.username ?? null,
        full_name: u?.full_name ?? null,
        profile_picture_url: u?.profile_picture_url ?? null,
        added_at: r.added_at,
        source: r.source as ContestAccessSource,
        source_allowlist_id: r.source_allowlist_id,
        source_allowlist_name: r.source_allowlist_id
          ? listNames.get(r.source_allowlist_id) ?? null
          : null,
        source_invite_link_id: r.source_invite_link_id,
        source_invite_link_label: r.source_invite_link_id
          ? linkLabels.get(r.source_invite_link_id) ?? null
          : null,
      };
    });

    return NextResponse.json({ contest, members });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/**
 * POST /api/contests/:id/access-list
 *   { usernames }                — add creators by username
 *   { allowlistId }              — import (copy) a saved list
 *   { saveAsList: name }         — save the current roster as a new saved list
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    const contest = await assertCanManageCampaignAccess(admin, actor, id);
    const body = await request.json().catch(() => ({}));

    if (body?.saveAsList !== undefined) {
      const name = normalizeAllowlistName(body.saveAsList);
      if (!name) throw new CampaignAccessError("List name is required (max 100 characters)", 400);
      if (!contest.advertiser_id) throw new CampaignAccessError("Campaign has no brand", 400);

      const allowlist = await createAllowlistWithMembers(admin, {
        ownerId: contest.advertiser_id,
        name,
        createdBy: actor.userId,
        userIds: await loadCampaignAccessUserIds(admin, id),
      });
      return NextResponse.json({ allowlist });
    }

    if (body?.allowlistId) {
      const list = await assertCanManageAllowlist(admin, actor, String(body.allowlistId));
      if (list.advertiser_id !== contest.advertiser_id) {
        throw new CampaignAccessError("This list belongs to a different brand", 403);
      }
      const ids = await loadAllowlistMemberIds(admin, list.id);
      const added = await addToAccessList(admin, id, ids, "saved_list", actor.userId, list.id);
      await invalidateOpportunitiesListCache();
      return NextResponse.json({ added, alreadyOnList: ids.length - added });
    }

    if (body?.usernames) {
      const resolution = await resolveUsernamesToUserIds(admin, body.usernames);
      const ids = resolution.found.map((f) => f.user_id);
      const added = await addToAccessList(admin, id, ids, "manual", actor.userId);
      await invalidateOpportunitiesListCache();
      return NextResponse.json({
        added,
        alreadyOnList: ids.length - added,
        notFound: resolution.notFound,
        invalid: resolution.invalid,
      });
    }

    throw new CampaignAccessError("Provide usernames, allowlistId or saveAsList", 400);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** PATCH /api/contests/:id/access-list — { access_list_skips_requirements } */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    if (typeof body?.access_list_skips_requirements !== "boolean") {
      throw new CampaignAccessError("access_list_skips_requirements must be a boolean", 400);
    }
    const { error } = await admin
      .from("contests")
      .update({ access_list_skips_requirements: body.access_list_skips_requirements })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** DELETE /api/contests/:id/access-list — { userIds }. Existing submissions stay valid. */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const body = await request.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body?.userIds)
      ? body.userIds.filter((v: unknown): v is string => typeof v === "string")
      : [];
    if (userIds.length === 0) throw new CampaignAccessError("userIds is required", 400);

    for (let i = 0; i < userIds.length; i += DELETE_CHUNK) {
      const { error } = await admin
        .from("contest_access_list")
        .delete()
        .eq("contest_id", id)
        .in("user_id", userIds.slice(i, i + DELETE_CHUNK));
      if (error) throw error;
    }

    await invalidateOpportunitiesListCache();
    return NextResponse.json({ success: true });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

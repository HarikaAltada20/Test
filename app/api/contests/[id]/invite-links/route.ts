import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
} from "@/lib/campaign-access-server";
import {
  MAX_INVITE_LABEL_LENGTH,
  MAX_INVITE_USES,
  isInviteExpiryPreset,
  resolveInviteExpiry,
  type InviteLink,
} from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const INVITE_LINK_COLUMNS =
  "id, contest_id, token, label, expires_at, max_uses, use_count, revoked_at, created_at";

/** GET /api/contests/:id/invite-links — all links for the campaign, newest first. */
export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const { data, error } = await admin
      .from("contest_invite_links")
      .select(INVITE_LINK_COLUMNS)
      .eq("contest_id", id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ links: (data || []) as InviteLink[] });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/**
 * POST /api/contests/:id/invite-links
 * Body: { label?, expiry: "24h"|"7d"|"30d"|"custom"|"never", customExpiresDate?, timezoneOffsetMinutes?, maxUses? }
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const actor = await getAccessActor();
    const admin = getServiceClient();
    const contest = await assertCanManageCampaignAccess(admin, actor, id);

    if (contest.access_mode === "public") {
      throw new CampaignAccessError(
        "Invite links are only available for private campaigns",
        400,
      );
    }

    const body = await request.json().catch(() => ({}));

    const rawLabel = typeof body.label === "string" ? body.label.trim() : "";
    if (rawLabel.length > MAX_INVITE_LABEL_LENGTH) {
      throw new CampaignAccessError(
        `Label must be ${MAX_INVITE_LABEL_LENGTH} characters or fewer`,
        400,
      );
    }

    if (!isInviteExpiryPreset(body.expiry)) {
      throw new CampaignAccessError("Choose when the link expires", 400);
    }
    const expiry = resolveInviteExpiry(
      body.expiry,
      body.expiry === "custom"
        ? { date: body.customExpiresDate, tzOffsetMinutes: body.timezoneOffsetMinutes }
        : null,
    );
    if ("error" in expiry) throw new CampaignAccessError(expiry.error, 400);

    let maxUses: number | null = null;
    if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses !== "") {
      const n = Number(body.maxUses);
      if (!Number.isInteger(n) || n < 1 || n > MAX_INVITE_USES) {
        throw new CampaignAccessError(
          `Limit must be a whole number between 1 and ${MAX_INVITE_USES.toLocaleString()}`,
          400,
        );
      }
      maxUses = n;
    }

    const { data, error } = await admin
      .from("contest_invite_links")
      .insert({
        contest_id: id,
        token: randomBytes(24).toString("base64url"),
        label: rawLabel || null,
        expires_at: expiry.expiresAt,
        max_uses: maxUses,
        created_by: actor.userId,
      })
      .select(INVITE_LINK_COLUMNS)
      .single();
    if (error) throw error;

    return NextResponse.json({ link: data as InviteLink }, { status: 201 });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-email/api-auth";
import {
  attachLeadsToCampaign,
  manualLeadToAttachMember,
  resolveManualLeadForAttach,
  type BundleMemberForAttach,
} from "@/lib/admin-email/lead-bundles";

type RouteContext = { params: Promise<{ id: string }> };

type LeadInput = {
  email: string;
  fullName?: string | null;
  username?: string | null;
  userType?: string | null;
  userId?: string | null;
};

async function resolveLeadsForAttach(
  leads: LeadInput[],
): Promise<BundleMemberForAttach[]> {
  const members: BundleMemberForAttach[] = [];
  const seen = new Set<string>();

  for (const lead of leads) {
    if (!lead.email?.trim()) continue;

    const member = lead.userId
      ? manualLeadToAttachMember(lead)
      : await resolveManualLeadForAttach(lead);

    const key = member.userId ?? member.email;
    if (seen.has(key)) continue;
    seen.add(key);
    members.push(member);
  }

  return members;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  const { id: campaignId } = await context.params;
  let body: { lead?: LeadInput; leads?: LeadInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leadInputs =
    body.leads && body.leads.length > 0
      ? body.leads
      : body.lead
        ? [body.lead]
        : [];

  if (leadInputs.length === 0) {
    return NextResponse.json({ error: "Provide at least one lead" }, { status: 400 });
  }

  try {
    const members = await resolveLeadsForAttach(leadInputs);
    if (members.length === 0) {
      return NextResponse.json({ error: "No valid leads to attach" }, { status: 400 });
    }

    const result = await attachLeadsToCampaign(campaignId, members);

    return NextResponse.json({
      campaignId,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attach failed";
    const status = message === "Campaign not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

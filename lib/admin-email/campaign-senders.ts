import type { SupabaseClient } from "@supabase/supabase-js";

export type CampaignSender = {
  id: string;
  email: string;
};

type CampaignSenderRow = {
  project_id: string;
  from_email: string | null;
  from_sender_id: string | null;
  from_sender_ids?: string[] | null;
};

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function normalizeCampaignSenderIds(
  fromSenderIds: string[] | null | undefined,
  fromSenderId: string | null | undefined,
): string[] {
  const ids = (fromSenderIds ?? []).filter(Boolean);
  if (ids.length > 0) return [...new Set(ids)];
  if (fromSenderId) return [fromSenderId];
  return [];
}

export async function resolveCampaignSenders(
  db: SupabaseClient,
  campaign: CampaignSenderRow,
): Promise<CampaignSender[]> {
  const selectedIds = normalizeCampaignSenderIds(
    campaign.from_sender_ids,
    campaign.from_sender_id,
  );

  if (selectedIds.length > 0) {
    const { data } = await db
      .from("admin_email_project_senders")
      .select("id, email")
      .eq("project_id", campaign.project_id)
      .in("id", selectedIds);

    const byId = new Map((data ?? []).map((row) => [row.id, row]));
    return selectedIds
      .map((id) => byId.get(id))
      .filter((row): row is CampaignSender => !!row?.email);
  }

  const { data: defaultSender } = await db
    .from("admin_email_project_senders")
    .select("id, email")
    .eq("project_id", campaign.project_id)
    .eq("is_default", true)
    .maybeSingle();

  if (defaultSender?.email) {
    return [{ id: defaultSender.id, email: defaultSender.email }];
  }

  const { data: verifiedSenders } = await db
    .from("admin_email_project_senders")
    .select("id, email")
    .eq("project_id", campaign.project_id)
    .eq("ses_verified", true)
    .order("created_at", { ascending: true });

  if (verifiedSenders?.length) {
    return verifiedSenders.filter((row) => row.email);
  }

  const { data: allSenders } = await db
    .from("admin_email_project_senders")
    .select("id, email")
    .eq("project_id", campaign.project_id)
    .order("created_at", { ascending: true });

  return (allSenders ?? []).filter((row) => row.email);
}

export function pickSenderForRecipient(
  userId: string,
  senders: CampaignSender[],
): CampaignSender {
  if (senders.length === 0) {
    throw new Error("No senders configured for campaign");
  }
  if (senders.length === 1) {
    return senders[0];
  }
  return senders[hashUserId(userId) % senders.length];
}

export async function campaignHasSenders(
  db: SupabaseClient,
  campaign: CampaignSenderRow,
): Promise<boolean> {
  const senders = await resolveCampaignSenders(db, campaign);
  return senders.length > 0;
}

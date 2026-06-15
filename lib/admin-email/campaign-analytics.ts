import { createAdminClient } from "@/utils/supabase/admin";
import {
  getStep1SendVariants,
  pickVariantForRecipient,
} from "@/lib/admin-email/sequence-store";
import type { StoredSequence, StoredVariant } from "@/lib/admin-email/sequence-types";

const SENT_STATUSES = new Set([
  "sent",
  "delivered",
  "opened",
  "clicked",
]);

type Counts = {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
};

export type VariantAnalyticsRow = {
  variantId: string;
  label: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
};

export type StepAnalyticsRow = {
  stepNumber: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  variants: VariantAnalyticsRow[];
};

function emptyCounts(): Counts {
  return { sent: 0, opened: 0, clicked: 0, bounced: 0, replied: 0 };
}

function toRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function isOpened(
  status: string,
  openCount: number,
): boolean {
  return openCount > 0 || status === "opened" || status === "clicked";
}

function isClicked(status: string, clickCount: number): boolean {
  return clickCount > 0 || status === "clicked";
}

function variantLabel(variant: StoredVariant): string {
  const letter = variant.variant_letter?.trim();
  if (letter) return `Variant ${letter}`;
  return variant.variant_name?.trim() || "Variant";
}

export async function getCampaignStepAnalytics(
  campaignId: string,
): Promise<StepAnalyticsRow[]> {
  const db = createAdminClient();

  const { data: campaign } = await db
    .from("admin_email_campaigns")
    .select("sequence_data")
    .eq("id", campaignId)
    .single();

  const sequence = (campaign?.sequence_data as StoredSequence | null) ?? null;
  const step = sequence?.steps?.[0];
  const stepNumber = step?.step_number ?? 1;
  const stepVariants = [...(step?.variants ?? [])].sort((a, b) =>
    a.variant_letter.localeCompare(b.variant_letter),
  );
  const sendVariants = getStep1SendVariants(sequence);

  const { data: recipients } = await db
    .from("admin_email_campaign_recipients")
    .select("user_id, email_delivery_status")
    .eq("campaign_id", campaignId);

  const { data: trackingRows } = await db
    .from("admin_email_tracking")
    .select("user_id, open_count, click_count")
    .eq("campaign_id", campaignId);

  const trackingByUser = new Map(
    (trackingRows ?? []).map((row) => [
      row.user_id,
      {
        openCount: row.open_count ?? 0,
        clickCount: row.click_count ?? 0,
      },
    ]),
  );

  const stepCounts = emptyCounts();
  const variantCounts = new Map<string, Counts>();
  for (const variant of stepVariants) {
    variantCounts.set(variant.id, emptyCounts());
  }

  for (const recipient of recipients ?? []) {
    const status = recipient.email_delivery_status;
    const tracking = trackingByUser.get(recipient.user_id);
    const openCount = tracking?.openCount ?? 0;
    const clickCount = tracking?.clickCount ?? 0;

    if (status === "bounced") {
      stepCounts.bounced += 1;
      continue;
    }

    if (!SENT_STATUSES.has(status)) continue;

    stepCounts.sent += 1;
    if (isOpened(status, openCount)) stepCounts.opened += 1;
    if (isClicked(status, clickCount)) stepCounts.clicked += 1;

    if (stepVariants.length === 0) continue;

    const pool = sendVariants.length > 0 ? sendVariants : stepVariants;
    const assigned = pickVariantForRecipient(recipient.user_id, pool);
    const counts = variantCounts.get(assigned.id);
    if (!counts) continue;

    counts.sent += 1;
    if (isOpened(status, openCount)) counts.opened += 1;
    if (isClicked(status, clickCount)) counts.clicked += 1;
  }

  const variants: VariantAnalyticsRow[] = stepVariants.map((variant) => {
    const counts = variantCounts.get(variant.id) ?? emptyCounts();
    return {
      variantId: variant.id,
      label: variantLabel(variant),
      sent: counts.sent,
      opened: counts.opened,
      clicked: counts.clicked,
      replied: counts.replied,
      openRate: toRate(counts.opened, counts.sent),
      clickRate: toRate(counts.clicked, counts.sent),
      replyRate: toRate(counts.replied, counts.sent),
    };
  });

  return [
    {
      stepNumber,
      sent: stepCounts.sent,
      opened: stepCounts.opened,
      clicked: stepCounts.clicked,
      bounced: stepCounts.bounced,
      replied: stepCounts.replied,
      openRate: toRate(stepCounts.opened, stepCounts.sent),
      clickRate: toRate(stepCounts.clicked, stepCounts.sent),
      replyRate: toRate(stepCounts.replied, stepCounts.sent),
      variants,
    },
  ];
}

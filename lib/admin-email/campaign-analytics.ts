import { createAdminClient } from "@/utils/supabase/admin";
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

function isOpened(status: string, openCount: number): boolean {
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
  const steps = [...(sequence?.steps ?? [])].sort(
    (a, b) => a.step_number - b.step_number,
  );

  if (steps.length === 0) {
    return [];
  }

  const { data: stepSends } = await db
    .from("admin_email_sequence_step_sends")
    .select(
      "step_number, variant_id, tracking_id, email_delivery_status",
    )
    .eq("campaign_id", campaignId);

  const trackingIds = (stepSends ?? [])
    .map((row) => row.tracking_id)
    .filter(Boolean);

  const trackingById = new Map<
    string,
    { openCount: number; clickCount: number }
  >();

  if (trackingIds.length > 0) {
    const { data: trackingRows } = await db
      .from("admin_email_tracking")
      .select("tracking_id, open_count, click_count")
      .in("tracking_id", trackingIds);

    for (const row of trackingRows ?? []) {
      trackingById.set(row.tracking_id, {
        openCount: row.open_count ?? 0,
        clickCount: row.click_count ?? 0,
      });
    }
  }

  const { data: recipients } = await db
    .from("admin_email_campaign_recipients")
    .select("email_delivery_status")
    .eq("campaign_id", campaignId);

  const bouncedCount = (recipients ?? []).filter(
    (r) => r.email_delivery_status === "bounced",
  ).length;

  return steps.map((step) => {
    const stepVariants = [...(step.variants ?? [])].sort((a, b) =>
      a.variant_letter.localeCompare(b.variant_letter),
    );
    const stepCounts = emptyCounts();
    const variantCounts = new Map<string, Counts>();
    for (const variant of stepVariants) {
      variantCounts.set(variant.id, emptyCounts());
    }

    const sendsForStep = (stepSends ?? []).filter(
      (send) => send.step_number === step.step_number,
    );

    for (const send of sendsForStep) {
      const status = send.email_delivery_status;
      if (!SENT_STATUSES.has(status)) continue;

      const tracking = send.tracking_id
        ? trackingById.get(send.tracking_id)
        : undefined;
      const openCount = tracking?.openCount ?? 0;
      const clickCount = tracking?.clickCount ?? 0;

      stepCounts.sent += 1;
      if (isOpened(status, openCount)) stepCounts.opened += 1;
      if (isClicked(status, clickCount)) stepCounts.clicked += 1;

      if (!send.variant_id) continue;
      const counts = variantCounts.get(send.variant_id);
      if (!counts) continue;

      counts.sent += 1;
      if (isOpened(status, openCount)) counts.opened += 1;
      if (isClicked(status, clickCount)) counts.clicked += 1;
    }

    if (step.step_number === 1) {
      stepCounts.bounced = bouncedCount;
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

    return {
      stepNumber: step.step_number,
      sent: stepCounts.sent,
      opened: stepCounts.opened,
      clicked: stepCounts.clicked,
      bounced: stepCounts.bounced,
      replied: stepCounts.replied,
      openRate: toRate(stepCounts.opened, stepCounts.sent),
      clickRate: toRate(stepCounts.clicked, stepCounts.sent),
      replyRate: toRate(stepCounts.replied, stepCounts.sent),
      variants,
    };
  });
}

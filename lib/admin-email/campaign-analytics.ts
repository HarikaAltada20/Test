import { createAdminClient } from "@/utils/supabase/admin";
import { getActiveVariantsForStep } from "@/lib/admin-email/sequence-store";
import type {
  StoredSequence,
  StoredStep,
  StoredVariant,
} from "@/lib/admin-email/sequence-types";

const SENT_STATUSES = new Set([
  "sent",
  "delivered",
  "opened",
  "clicked",
]);

const NON_DELIVERED_RECIPIENT_STATUSES = new Set([
  "pending",
  "skipped",
  "failed",
  "bounced",
]);

type Counts = {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
};

type TrackingRow = {
  tracking_id: string;
  user_id: string;
  step_number: number;
  open_count: number | null;
  click_count: number | null;
};

type StepSendRow = {
  step_number: number;
  variant_id: string | null;
  tracking_id: string;
  user_id: string;
  ses_message_id: string | null;
  email_delivery_status: string;
};

type RecipientRow = {
  user_id: string;
  email_delivery_status: string;
  current_step_number: number | null;
  skipped_reason?: string | null;
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

function variantLabel(variant: StoredVariant): string {
  const letter = variant.variant_letter?.trim();
  if (letter) return `Variant ${letter}`;
  return variant.variant_name?.trim() || "Variant";
}

function trackingKey(userId: string, stepNumber: number): string {
  return `${userId}:${stepNumber}`;
}

function getTrackingMetrics(
  trackingByUserStep: Map<string, TrackingRow>,
  userId: string,
  stepNumber: number,
): { openCount: number; clickCount: number } {
  const row = trackingByUserStep.get(trackingKey(userId, stepNumber));
  return {
    openCount: row?.open_count ?? 0,
    clickCount: row?.click_count ?? 0,
  };
}

function pickVariantByRecipientIndex(
  userId: string,
  orderedRecipientIds: string[],
  activeVariants: StoredVariant[],
): StoredVariant | null {
  if (activeVariants.length === 0) return null;
  if (activeVariants.length === 1) return activeVariants[0];

  const index = orderedRecipientIds.indexOf(userId);
  if (index < 0) return activeVariants[0];
  return activeVariants[index % activeVariants.length];
}

function resolveVariantIdForUser(
  userId: string,
  step: StoredStep,
  stepVariants: StoredVariant[],
  sendsForStep: StepSendRow[],
  orderedRecipientIds: string[],
): string | null {
  const send = sendsForStep.find((row) => row.user_id === userId);
  if (send?.variant_id) return send.variant_id;

  const activeVariants = getActiveVariantsForStep(step);
  const picked = pickVariantByRecipientIndex(
    userId,
    orderedRecipientIds,
    activeVariants.length > 0 ? activeVariants : stepVariants,
  );
  return picked?.id ?? null;
}

function wasStepDelivered(
  userId: string,
  stepNumber: number,
  sendsForStep: StepSendRow[],
  trackingByUserStep: Map<string, TrackingRow>,
  recipientByUser: Map<string, RecipientRow>,
): boolean {
  const send = sendsForStep.find((row) => row.user_id === userId);
  if (send?.ses_message_id) return true;
  if (send && SENT_STATUSES.has(send.email_delivery_status)) return true;

  const tracking = trackingByUserStep.get(trackingKey(userId, stepNumber));
  const openCount = tracking?.open_count ?? 0;
  const clickCount = tracking?.click_count ?? 0;
  if (openCount > 0 || clickCount > 0) return true;

  const recipient = recipientByUser.get(userId);
  if (!recipient) return false;
  if (NON_DELIVERED_RECIPIENT_STATUSES.has(recipient.email_delivery_status)) {
    return false;
  }

  const currentStep = recipient.current_step_number ?? 1;
  if (currentStep > stepNumber) return true;

  return Boolean(tracking);
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

  const [{ data: stepSends }, { data: allTracking }, { data: recipients }, { data: inboundReplies }] =
    await Promise.all([
      db
        .from("admin_email_sequence_step_sends")
        .select(
          "step_number, variant_id, tracking_id, user_id, ses_message_id, email_delivery_status",
        )
        .eq("campaign_id", campaignId),
      db
        .from("admin_email_tracking")
        .select("tracking_id, user_id, step_number, open_count, click_count")
        .eq("campaign_id", campaignId),
      db
        .from("admin_email_campaign_recipients")
        .select("user_id, email_delivery_status, current_step_number, skipped_reason")
        .eq("campaign_id", campaignId),
      db
        .from("admin_email_unibox_messages")
        .select("user_id")
        .eq("campaign_id", campaignId)
        .eq("direction", "inbound")
        .not("from_email", "ilike", "mailer-daemon@%")
        .not("from_email", "ilike", "postmaster@%"),
    ]);

  const trackingByUserStep = new Map<string, TrackingRow>();
  const trackingUsersByStep = new Map<number, Set<string>>();

  for (const row of (allTracking ?? []) as TrackingRow[]) {
    const stepNumber = row.step_number ?? 1;
    trackingByUserStep.set(trackingKey(row.user_id, stepNumber), row);
    if (!trackingUsersByStep.has(stepNumber)) {
      trackingUsersByStep.set(stepNumber, new Set());
    }
    trackingUsersByStep.get(stepNumber)!.add(row.user_id);
  }

  const recipientByUser = new Map<string, RecipientRow>();
  for (const row of (recipients ?? []) as RecipientRow[]) {
    recipientByUser.set(row.user_id, row);
  }

  const orderedRecipientIds = [...recipientByUser.keys()].sort();

  const bouncedCount = (recipients ?? []).filter(
    (r) => r.email_delivery_status === "bounced",
  ).length;

  const stepSendRows = (stepSends ?? []) as StepSendRow[];

  const repliedUserIds = new Set<string>();
  for (const row of inboundReplies ?? []) {
    if (row.user_id) repliedUserIds.add(row.user_id);
  }
  for (const row of (recipients ?? []) as RecipientRow[]) {
    if (row.skipped_reason === "replied") {
      repliedUserIds.add(row.user_id);
    }
  }

  const replyStepByUser = new Map<string, number>();
  for (const userId of repliedUserIds) {
    const sends = stepSendRows.filter((send) => send.user_id === userId);
    replyStepByUser.set(
      userId,
      sends.length > 0
        ? Math.max(...sends.map((send) => send.step_number))
        : 1,
    );
  }

  return steps.map((step) => {
    const stepVariants = [...(step.variants ?? [])].sort((a, b) =>
      a.variant_letter.localeCompare(b.variant_letter),
    );
    const stepCounts = emptyCounts();
    const variantCounts = new Map<string, Counts>();
    const variantMeta = new Map<string, StoredVariant>();
    for (const variant of stepVariants) {
      variantCounts.set(variant.id, emptyCounts());
      variantMeta.set(variant.id, variant);
    }

    const sendsForStep = stepSendRows.filter(
      (send) => send.step_number === step.step_number,
    );

    for (const send of sendsForStep) {
      if (!send.variant_id || variantCounts.has(send.variant_id)) continue;
      variantCounts.set(send.variant_id, emptyCounts());
    }

    const candidateUserIds = new Set<string>();
    for (const send of sendsForStep) {
      candidateUserIds.add(send.user_id);
    }
    for (const userId of trackingUsersByStep.get(step.step_number) ?? []) {
      candidateUserIds.add(userId);
    }

    const deliveredUserIds = new Set(
      [...candidateUserIds].filter((userId) =>
        wasStepDelivered(
          userId,
          step.step_number,
          sendsForStep,
          trackingByUserStep,
          recipientByUser,
        ),
      ),
    );

    for (const userId of deliveredUserIds) {
      const { openCount, clickCount } = getTrackingMetrics(
        trackingByUserStep,
        userId,
        step.step_number,
      );

      stepCounts.sent += 1;
      if (openCount > 0 || clickCount > 0) stepCounts.opened += 1;
      if (clickCount > 0) stepCounts.clicked += 1;
      if (replyStepByUser.get(userId) === step.step_number) {
        stepCounts.replied += 1;
      }

      const variantId = resolveVariantIdForUser(
        userId,
        step,
        stepVariants,
        sendsForStep,
        orderedRecipientIds,
      );
      if (!variantId) continue;

      const counts = variantCounts.get(variantId);
      if (!counts) continue;

      counts.sent += 1;
      if (openCount > 0 || clickCount > 0) counts.opened += 1;
      if (clickCount > 0) counts.clicked += 1;
      if (replyStepByUser.get(userId) === step.step_number) {
        counts.replied += 1;
      }
    }

    if (step.step_number === 1) {
      stepCounts.bounced = bouncedCount;
    }

    const variants: VariantAnalyticsRow[] = [...variantCounts.keys()]
      .filter((variantId) => {
        const counts = variantCounts.get(variantId);
        return variantMeta.has(variantId) || (counts?.sent ?? 0) > 0;
      })
      .map((variantId) => {
        const counts = variantCounts.get(variantId) ?? emptyCounts();
        const variant = variantMeta.get(variantId);
        return {
          variantId,
          label: variant ? variantLabel(variant) : "Variant",
          sent: counts.sent,
          opened: counts.opened,
          clicked: counts.clicked,
          replied: counts.replied,
          openRate: toRate(counts.opened, counts.sent),
          clickRate: toRate(counts.clicked, counts.sent),
          replyRate: toRate(counts.replied, counts.sent),
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

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

import { randomUUID, createHash } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import type {
  SequenceStep,
  SequenceVariant,
  StoredSequence,
  StoredStep,
  StoredVariant,
} from "@/lib/admin-email/sequence-types";

function toClientVariant(v: StoredVariant): SequenceVariant {
  return {
    id: v.id,
    name: v.variant_name,
    subject: v.subject,
    body: v.body,
    is_active: v.is_active,
    variant_letter: v.variant_letter,
  };
}

function toClientStep(s: StoredStep): SequenceStep {
  return {
    id: s.id,
    stepNumber: s.step_number,
    subject: s.subject,
    body: s.body,
    delayDays: s.delay_days,
    variants: (s.variants ?? []).map(toClientVariant),
    isExpanded: true,
  };
}

function sortVariants(variants: StoredVariant[]): StoredVariant[] {
  return [...variants].sort((a, b) =>
    a.variant_letter.localeCompare(b.variant_letter),
  );
}

/** Active step-1 variants included in A/B send (empty when none active). */
export function getStep1SendVariants(
  sequenceData: StoredSequence | null | undefined,
): StoredVariant[] {
  if (!sequenceData?.steps?.length) return [];
  const variants = sequenceData.steps[0].variants ?? [];
  const active = variants.filter((v) => v.is_active);
  return active.length > 0 ? sortVariants(active) : [];
}

/** Deterministic variant pick so the same user always gets the same variant. */
export function pickVariantForRecipient<T extends { id: string }>(
  userId: string,
  variants: T[],
): T {
  if (variants.length === 1) return variants[0];
  const hash = createHash("sha256").update(userId).digest();
  const index = hash.readUInt32BE(0) % variants.length;
  return variants[index];
}

/** Subject/body for one recipient (A/B variant when multiple are active). */
export function resolveRecipientEmailContent(
  sequenceData: StoredSequence | null | undefined,
  userId: string,
  fallback: { subject: string; body: string },
): { subject: string; body: string; variantId?: string; variantLetter?: string } {
  const step = sequenceData?.steps?.[0];
  const sendVariants = getStep1SendVariants(sequenceData);

  if (sendVariants.length > 0) {
    const variant = pickVariantForRecipient(userId, sendVariants);
    return {
      subject:
        variant.subject?.trim() || step?.subject?.trim() || fallback.subject,
      body: variant.body?.trim() || step?.body?.trim() || fallback.body,
      variantId: variant.id,
      variantLetter: variant.variant_letter,
    };
  }

  if (step?.subject?.trim() || step?.body?.trim()) {
    return {
      subject: step.subject?.trim() || fallback.subject,
      body: step.body?.trim() || fallback.body,
    };
  }

  const primary = getPrimaryEmailContent(sequenceData);
  return {
    subject: primary?.subject?.trim() || fallback.subject,
    body: primary?.body?.trim() || fallback.body,
  };
}

function primaryContent(steps: StoredStep[]): {
  subject: string;
  body: string;
} {
  const first = steps[0];
  if (!first) return { subject: "", body: "" };
  const active =
    first.variants?.find((v) => v.is_active) ?? first.variants?.[0];
  if (active?.subject || active?.body) {
    return { subject: active.subject, body: active.body };
  }
  return { subject: first.subject, body: first.body };
}

/** Subject/body from step 1 (active variant preferred) for outbound send. */
export function getPrimaryEmailContent(
  sequenceData: StoredSequence | null | undefined,
): { subject: string; body: string } | null {
  if (!sequenceData?.steps?.length) return null;
  const content = primaryContent(sequenceData.steps);
  if (!content.subject && !content.body) return null;
  return content;
}

async function persistSequence(
  campaignId: string,
  sequence: StoredSequence | null,
) {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {
    sequence_data: sequence,
  };
  if (sequence?.steps?.length) {
    const { subject, body } = primaryContent(sequence.steps);
    if (subject) patch.email_subject = subject;
    if (body) patch.message_template = body;
  }
  await db.from("admin_email_campaigns").update(patch).eq("id", campaignId);
}

export async function loadCampaignSequence(campaignId: string) {
  const db = createAdminClient();
  const { data: campaign, error } = await db
    .from("admin_email_campaigns")
    .select(
      "id, project_id, name, email_subject, message_template, sequence_data, status",
    )
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return null;

  let stored = campaign.sequence_data as StoredSequence | null;

  if (!stored?.steps?.length) {
    const subject = campaign.email_subject ?? "";
    const body = campaign.message_template ?? "";
    if (subject || body) {
      stored = {
        id: randomUUID(),
        name: `${campaign.name} - Email Sequence`,
        steps: [
          {
            id: randomUUID(),
            step_number: 1,
            subject,
            body,
            delay_days: 2,
            variants: [],
          },
        ],
      };
    }
  }

  if (!stored) {
    return {
      campaignId: campaign.id,
      projectId: campaign.project_id,
      status: campaign.status,
      sequence: null,
      steps: [] as SequenceStep[],
    };
  }

  return {
    campaignId: campaign.id,
    projectId: campaign.project_id,
    status: campaign.status,
    sequence: {
      id: stored.id,
      campaignId: campaign.id,
      projectId: campaign.project_id,
      name: stored.name,
      description: stored.description,
      steps: stored.steps.map(toClientStep),
    },
    steps: stored.steps.map(toClientStep),
  };
}

export async function createCampaignSequence(
  campaignId: string,
  input: {
    name: string;
    description?: string;
    steps: Array<{
      step_number: number;
      subject: string;
      body: string;
      delay_days: number;
      variants?: Array<{
        variant_name: string;
        subject: string;
        body: string;
        variant_letter: string;
      }>;
    }>;
  },
) {
  const stored: StoredSequence = {
    id: randomUUID(),
    name: input.name,
    description: input.description,
    steps: input.steps.map((s) => ({
      id: randomUUID(),
      step_number: s.step_number,
      subject: s.subject,
      body: s.body,
      delay_days: s.delay_days,
      variants: (s.variants ?? []).map((v) => ({
        id: randomUUID(),
        variant_name: v.variant_name,
        subject: v.subject,
        body: v.body,
        is_active: true,
        variant_letter: v.variant_letter,
      })),
    })),
  };
  await persistSequence(campaignId, stored);
  return { sequenceId: stored.id, steps: stored.steps.map(toClientStep) };
}

async function getStored(campaignId: string): Promise<StoredSequence | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("admin_email_campaigns")
    .select("sequence_data")
    .eq("id", campaignId)
    .single();
  return (data?.sequence_data as StoredSequence) ?? null;
}

export async function addSequenceStep(
  campaignId: string,
  input: {
    step_number: number;
    subject: string;
    body: string;
    delay_days: number;
    variants?: StoredVariant[];
  },
) {
  let stored = await getStored(campaignId);
  if (!stored) {
    stored = {
      id: randomUUID(),
      name: "Email Sequence",
      steps: [],
    };
  }
  const stepId = randomUUID();
  stored.steps.push({
    id: stepId,
    step_number: input.step_number,
    subject: input.subject,
    body: input.body,
    delay_days: input.delay_days,
    variants: input.variants ?? [],
  });
  await persistSequence(campaignId, stored);
  return { step_id: stepId, step: toClientStep(stored.steps.at(-1)!) };
}

export async function updateSequenceStep(
  campaignId: string,
  stepId: string,
  patch: Partial<{
    step_number: number;
    subject: string;
    body: string;
    delay_days: number;
  }>,
) {
  const stored = await getStored(campaignId);
  if (!stored) throw new Error("Sequence not found");
  const step = stored.steps.find((s) => s.id === stepId);
  if (!step) throw new Error("Step not found");
  Object.assign(step, {
    step_number: patch.step_number ?? step.step_number,
    subject: patch.subject ?? step.subject,
    body: patch.body ?? step.body,
    delay_days: patch.delay_days ?? step.delay_days,
  });
  await persistSequence(campaignId, stored);
  return toClientStep(step);
}

export async function deleteSequenceStep(campaignId: string, stepId: string) {
  const stored = await getStored(campaignId);
  if (!stored) throw new Error("Sequence not found");
  stored.steps = stored.steps.filter((s) => s.id !== stepId);
  stored.steps.forEach((s, i) => {
    s.step_number = i + 1;
  });
  await persistSequence(campaignId, stored.steps.length ? stored : null);
}

export async function addSequenceVariant(
  campaignId: string,
  stepId: string,
  input: {
    variant_name: string;
    subject: string;
    body: string;
    variant_letter: string;
  },
) {
  const stored = await getStored(campaignId);
  if (!stored) throw new Error("Sequence not found");
  const step = stored.steps.find((s) => s.id === stepId);
  if (!step) throw new Error("Step not found");
  const variantId = randomUUID();
  step.variants.push({
    id: variantId,
    variant_name: input.variant_name,
    subject: input.subject,
    body: input.body,
    is_active: true,
    variant_letter: input.variant_letter,
  });
  await persistSequence(campaignId, stored);
  return { variant_id: variantId };
}

export async function updateSequenceVariant(
  campaignId: string,
  variantId: string,
  patch: Partial<{
    variant_name: string;
    subject: string;
    body: string;
    is_active: boolean;
  }>,
) {
  const stored = await getStored(campaignId);
  if (!stored) throw new Error("Sequence not found");
  for (const step of stored.steps) {
    const variant = step.variants.find((v) => v.id === variantId);
    if (variant) {
      Object.assign(variant, {
        variant_name: patch.variant_name ?? variant.variant_name,
        subject: patch.subject ?? variant.subject,
        body: patch.body ?? variant.body,
        is_active: patch.is_active ?? variant.is_active,
      });
      await persistSequence(campaignId, stored);
      return toClientVariant(variant);
    }
  }
  throw new Error("Variant not found");
}

export async function deleteSequenceVariant(
  campaignId: string,
  variantId: string,
) {
  const stored = await getStored(campaignId);
  if (!stored) throw new Error("Sequence not found");
  for (const step of stored.steps) {
    step.variants = step.variants.filter((v) => v.id !== variantId);
  }
  await persistSequence(campaignId, stored);
}

export async function replaceSequenceSteps(
  campaignId: string,
  steps: SequenceStep[],
) {
  const stored = await getStored(campaignId);
  const base: StoredSequence = stored ?? {
    id: randomUUID(),
    name: "Email Sequence",
    steps: [],
  };
  base.steps = steps.map((s) => ({
    id: s.id.startsWith("step-") ? randomUUID() : s.id,
    step_number: s.stepNumber,
    subject: s.subject,
    body: s.body,
    delay_days: s.delayDays,
    variants: s.variants.map((v) => ({
      id: v.id.startsWith("temp-variant-") ? randomUUID() : v.id,
      variant_name: v.name,
      subject: v.subject,
      body: v.body,
      is_active: v.is_active,
      variant_letter: v.variant_letter,
    })),
  }));
  await persistSequence(campaignId, base);
}

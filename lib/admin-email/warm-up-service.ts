/**
 * Warm-up service: sending, health scoring, stage progression,
 * daily counter reset, recipients/templates CRUD, daily metrics.
 */

import { randomUUID } from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";
import { sendSesEmail } from "@/lib/email/ses-client";
import {
  getEmailTrackingBaseUrl,
  injectTrackingPixel,
} from "@/lib/email/admin-bulk-email";
import type { WarmUpAccountRow, WarmUpStage } from "./warm-up";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarmUpRecipientRow = {
  id: string;
  project_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  is_active: boolean;
  emails_received: number;
  created_at: string;
  updated_at: string;
};

export type WarmUpTemplateRow = {
  id: string;
  project_id: string;
  name: string;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WarmUpSendRow = {
  id: string;
  account_id: string;
  project_id: string;
  recipient_email: string;
  recipient_first_name: string | null;
  template_id: string | null;
  subject: string;
  body: string;
  message_id: string | null;
  sent_at: string;
  is_delivered: boolean;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  is_bounced: boolean;
  is_complained: boolean;
};

export type WarmUpWeeklySummary = {
  emailsReceived: number;
  emailsSent: number;
  replyRate: number;
  openRate: number;
};

export type WarmUpDailyChartPoint = {
  label: string;
  date: string;
  count: number;
};

export type WarmUpMetricsRow = {
  id: string;
  account_id: string;
  project_id: string;
  date: string;
  sends_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  health_score: number;
  stage: WarmUpStage;
  stage_progression_triggered: boolean;
};

// ---------------------------------------------------------------------------
// Stage configuration
// ---------------------------------------------------------------------------

const STAGE_CONFIG: Record<
  WarmUpStage,
  {
    dailyLimit: number;
    minDeliveryRate: number;
    minOpenRate: number;
    maxBounceRate: number;
    minSendsForProgression: number;
    nextStage: WarmUpStage | null;
  }
> = {
  foundation: {
    dailyLimit: 10,
    minDeliveryRate: 95,
    minOpenRate: 15,
    maxBounceRate: 5,
    minSendsForProgression: 50,
    nextStage: "growth",
  },
  growth: {
    dailyLimit: 25,
    minDeliveryRate: 97,
    minOpenRate: 20,
    maxBounceRate: 3,
    minSendsForProgression: 150,
    nextStage: "expansion",
  },
  expansion: {
    dailyLimit: 45,
    minDeliveryRate: 98,
    minOpenRate: 25,
    maxBounceRate: 2,
    minSendsForProgression: 300,
    nextStage: "ready",
  },
  ready: {
    dailyLimit: 100,
    minDeliveryRate: 98,
    minOpenRate: 25,
    maxBounceRate: 2,
    minSendsForProgression: 999999,
    nextStage: null,
  },
};

// ---------------------------------------------------------------------------
// Spintext + personalization
// ---------------------------------------------------------------------------

function resolveSpintext(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (match, options: string) => {
    if (!options.includes("|")) return match;
    const parts = options.split("|");
    return parts[Math.floor(Math.random() * parts.length)] ?? match;
  });
}

const INDUSTRY_VALUES = [
  "SaaS",
  "e-commerce",
  "fintech",
  "healthtech",
  "edtech",
  "B2B software",
  "marketplace",
  "creator economy",
  "content marketing",
];
const TOPIC_VALUES = [
  "growth strategies",
  "customer acquisition",
  "retention tactics",
  "content distribution",
  "community building",
  "product-led growth",
  "email marketing",
];

function personalizeTemplate(
  subject: string,
  body: string,
  vars: {
    first_name: string;
    from_name: string;
    company: string;
  },
): { subject: string; body: string } {
  const industry =
    INDUSTRY_VALUES[Math.floor(Math.random() * INDUSTRY_VALUES.length)] ??
    "your industry";
  const topic =
    TOPIC_VALUES[Math.floor(Math.random() * TOPIC_VALUES.length)] ??
    "growth";

  const replacements: Record<string, string> = {
    "{first_name}": vars.first_name,
    "{from_name}": vars.from_name,
    "{company}": vars.company,
    "{industry}": industry,
    "{specific_topic}": topic,
    "{industry_topic}": `${industry} ${topic}`,
    "{resource_description}": `a quick guide on ${topic}`,
  };

  let s = subject;
  let b = body;
  for (const [key, val] of Object.entries(replacements)) {
    s = s.split(key).join(val);
    b = b.split(key).join(val);
  }

  s = resolveSpintext(s);
  b = resolveSpintext(b);
  return { subject: s, body: b };
}

// ---------------------------------------------------------------------------
// Default templates (seeded on first account creation)
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATES: { name: string; subject: string; body: string }[] = [
  {
    name: "Quick intro",
    subject: "{Hi|Hello|Hey} {first_name} — quick intro from {from_name}",
    body: `{Hi|Hello} {first_name},

I wanted to reach out because I've been following what {company} is doing in the {industry} space — really impressive work.

I'm {from_name} and I focus on {specific_topic}. {I'd love to connect|Would love to chat} when you have a moment.

{Best|Cheers|Thanks},
{from_name}`,
  },
  {
    name: "Resource share",
    subject: "A quick resource on {specific_topic} for {company}",
    body: `{Hey|Hi} {first_name},

I put together {resource_description} that I thought might be useful for {company}.

{Happy to share it|Let me know if you'd like it} — no strings attached, just something I thought could help.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Industry insight",
    subject: "Noticed something interesting about {industry}",
    body: `{Hi|Hello} {first_name},

I've been doing some research on {industry_topic} and came across a few patterns that stood out to me — especially relevant for companies like {company}.

{Would it be useful if I shared some notes|Happy to share what I found} — takes 5 minutes to read and might spark some ideas.

{Let me know|Talk soon},
{from_name}`,
  },
  {
    name: "Follow-up nudge",
    subject: "Following up — {from_name}",
    body: `{Hey|Hi} {first_name},

Just following up on my note from earlier this week. I know {specific_topic} can be a lot to think about, so I'll keep this short.

{Happy to hop on a quick call|Would love 15 minutes} if that works for you.

{Best|Thanks},
{from_name}`,
  },
  {
    name: "Value proposition",
    subject: "How {company} could improve {specific_topic}",
    body: `{Hi|Hello} {first_name},

I help {industry} companies with {specific_topic} — and I've noticed {company} is at an interesting stage.

{I have a few ideas|I'd love to share some thoughts} that could be directly applicable. {Would you be open to a quick chat|Can I send you a short overview}?

{Best regards|Thanks},
{from_name}`,
  },
  {
    name: "Mutual connection",
    subject: "Connecting on {industry_topic}",
    body: `{Hey|Hi} {first_name},

I came across {company} while researching players in {industry} and was impressed by your approach to {specific_topic}.

I work with similar companies on {industry_topic} and thought it might be worth connecting.

{Would love to learn more|Always happy to swap notes},
{from_name}`,
  },
  {
    name: "Case study offer",
    subject: "How a company like {company} doubled their {specific_topic}",
    body: `{Hi|Hello} {first_name},

I recently worked with a {industry} company similar to {company} on improving their {specific_topic} — the results were pretty remarkable.

{Happy to share the full story|Would love to walk you through it} if it'd be useful context.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Short check-in",
    subject: "{from_name} — checking in",
    body: `{Hey|Hi} {first_name},

Quick note — I've been thinking about {company} and your work in {industry}.

{Just wanted to stay on your radar|Thought I'd check in} and see if there's anything I could help with around {specific_topic}.

{Take care|Talk soon},
{from_name}`,
  },
  {
    name: "Thought leadership",
    subject: "A perspective on {industry_topic}",
    body: `{Hi|Hello} {first_name},

I've been writing about {industry_topic} lately and thought {company} might find it relevant.

{Happy to share|Would love to send over} a short summary if you're interested — no pitch, just ideas.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Peer intro",
    subject: "{Hi|Hey} {first_name} — fellow {industry} builder",
    body: `{Hey|Hi} {first_name},

I'm {from_name} and I work with teams in {industry} on {specific_topic}. Noticed {company} and wanted to say hello.

{Always open to swapping notes|Happy to connect} with others in the space.

{Best|Thanks},
{from_name}`,
  },
  {
    name: "Quick question",
    subject: "Quick question for {company}",
    body: `{Hi|Hello} {first_name},

I'm researching how {industry} companies approach {specific_topic} and {company} came up as a great example.

{Would you mind sharing|Any chance you could point me to} how your team thinks about this? Totally fine if you're swamped.

{Thanks|Appreciate it},
{from_name}`,
  },
  {
    name: "Content share",
    subject: "Something useful on {specific_topic}",
    body: `{Hey|Hi} {first_name},

Came across an article on {industry_topic} that reminded me of what {company} is building.

{Thought you might enjoy it|Worth a skim if you have 5 minutes} — happy to forward the link.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Congratulatory note",
    subject: "Congrats on the momentum at {company}",
    body: `{Hi|Hello} {first_name},

I've been following {company}'s progress in {industry} — really impressive trajectory on {specific_topic}.

{Would love to learn more|Happy to cheer you on} as you keep scaling.

{Best wishes|All the best},
{from_name}`,
  },
  {
    name: "Soft ask",
    subject: "{from_name} — quick favor?",
    body: `{Hey|Hi} {first_name},

I'm putting together a short list of {industry} leaders working on {specific_topic} and thought of {company}.

{Would you be open to a 10-minute chat|Any interest in a brief call}? No pressure at all.

{Thanks|Talk soon},
{from_name}`,
  },
  {
    name: "Newsletter invite",
    subject: "Monthly notes on {industry_topic}",
    body: `{Hi|Hello} {first_name},

I send a low-volume newsletter on {industry_topic} — practical stuff, no fluff.

{Thought it might resonate|Figured it could be useful} for someone at {company}. Want me to add you?

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Event invite",
    subject: "Virtual roundtable on {specific_topic}",
    body: `{Hey|Hi} {first_name},

We're hosting a small virtual session on {industry_topic} next week — founders and operators from {industry}.

{Would love to have {company} represented|Thought you might enjoy it}. Interested?

{Best|Thanks},
{from_name}`,
  },
  {
    name: "Tool recommendation",
    subject: "Tool that helped with {specific_topic}",
    body: `{Hi|Hello} {first_name},

We've been testing a few approaches to {specific_topic} and one stack change made a real difference for teams like {company}.

{Happy to share details|Can send a one-pager} if useful — no vendor tie-in.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Benchmark offer",
    subject: "Benchmark data for {industry}",
    body: `{Hey|Hi} {first_name},

We compiled anonymized benchmarks on {specific_topic} across {industry} companies — {company}'s segment included.

{Want a copy|Happy to share the highlights} if that'd help your planning.

{Best|Thanks},
{from_name}`,
  },
  {
    name: "Introduction offer",
    subject: "Intro to someone in {industry}?",
    body: `{Hi|Hello} {first_name},

I know a few folks in {industry} focused on {specific_topic} and thought an intro might be valuable for {company}.

{Let me know if interested|Happy to make a warm intro} — no strings attached.

{Best|Cheers},
{from_name}`,
  },
  {
    name: "Feedback request",
    subject: "Your take on {industry_topic}?",
    body: `{Hey|Hi} {first_name},

I'm refining a framework around {industry_topic} and would value a practitioner perspective from someone at {company}.

{5 minutes of feedback|A quick async reply} would mean a lot.

{Thanks|Appreciate you},
{from_name}`,
  },
  {
    name: "Seasonal check-in",
    subject: "Q{Hi|Hello} from {from_name}",
    body: `{Hi|Hello} {first_name},

Hope things are going well at {company}. As teams plan for the next quarter, {specific_topic} keeps coming up in {industry}.

{Happy to share what we're seeing|Open to compare notes} if helpful.

{Best|Take care},
{from_name}`,
  },
  {
    name: "Podcast pitch",
    subject: "Podcast guest idea — {company}",
    body: `{Hey|Hi} {first_name},

We host a short podcast on {industry_topic} and {company}'s story stood out.

{Would you or a teammate be open to a 20-min chat|Any interest in being a guest}? Totally flexible on timing.

{Best|Thanks},
{from_name}`,
  },
];

// ---------------------------------------------------------------------------
// Health score calculation
// ---------------------------------------------------------------------------

const HEALTH_SCORE_WINDOW_DAYS = 30;
const DEFAULT_HEALTH_SCORE = 0;

type SendMetricsInput = Pick<
  WarmUpSendRow,
  | "is_delivered"
  | "opened_at"
  | "clicked_at"
  | "replied_at"
  | "is_bounced"
  | "is_complained"
>;

function buildWarmUpSendHtml(body: string, sendId: string): string {
  const html = body.replace(/\n/g, "<br>");
  const pixelUrl = `${getEmailTrackingBaseUrl()}/track/warm-up-open/${sendId}`;
  return injectTrackingPixel(`<div>${html}</div>`, pixelUrl);
}

function sesMessageIdFromResult(result: {
  messageId?: string;
  sesMessageId?: string;
}): string | null {
  return result.sesMessageId ?? result.messageId ?? null;
}

function isSendOpened(send: Pick<WarmUpSendRow, "opened_at" | "clicked_at" | "replied_at">) {
  return Boolean(send.opened_at || send.clicked_at || send.replied_at);
}

function healthScoreWindowSince(): string {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - HEALTH_SCORE_WINDOW_DAYS);
  return since.toISOString();
}

function utcTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Health score uses sends before today unless closing out the day at 23:59. */
function healthScoreWindowEndExclusive(closeOutDay: boolean): string | null {
  if (closeOutDay) return null;
  return `${utcTodayDate()}T00:00:00.000Z`;
}

async function queryHealthScoreSends(
  accountId: string,
  closeOutDay: boolean,
): Promise<SendMetricsInput[]> {
  const db = createAdminClient();
  const endExclusive = healthScoreWindowEndExclusive(closeOutDay);

  let query = db
    .from("admin_email_warm_up_sends")
    .select(
      "is_delivered,opened_at,clicked_at,replied_at,is_bounced,is_complained",
    )
    .eq("account_id", accountId)
    .gte("sent_at", healthScoreWindowSince());

  if (endExclusive) {
    query = query.lt("sent_at", endExclusive);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SendMetricsInput[];
}

function aggregateSendMetrics(sends: SendMetricsInput[]) {
  return {
    sendsCount: sends.length,
    deliveredCount: sends.filter((s) => s.is_delivered).length,
    openedCount: sends.filter((s) => isSendOpened(s)).length,
    bouncedCount: sends.filter((s) => s.is_bounced).length,
    complainedCount: sends.filter((s) => s.is_complained).length,
  };
}

/** Live health for dashboard display (30-day window, excludes today unless closeOutDay). */
export async function computeDisplayHealthScoresByAccountId(
  accountIds: string[],
  options?: { closeOutDay?: boolean },
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (accountIds.length === 0) return scores;

  const closeOutDay = options?.closeOutDay ?? false;
  const since = healthScoreWindowSince();
  const endExclusive = healthScoreWindowEndExclusive(closeOutDay);
  const db = createAdminClient();

  let query = db
    .from("admin_email_warm_up_sends")
    .select(
      "account_id, is_delivered, opened_at, clicked_at, replied_at, is_bounced, is_complained",
    )
    .in("account_id", accountIds)
    .gte("sent_at", since);

  if (endExclusive) {
    query = query.lt("sent_at", endExclusive);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const sendsByAccount = new Map<string, SendMetricsInput[]>();
  for (const row of data ?? []) {
    const { account_id, ...send } = row as SendMetricsInput & {
      account_id: string;
    };
    const list = sendsByAccount.get(account_id) ?? [];
    list.push(send);
    sendsByAccount.set(account_id, list);
  }

  for (const accountId of accountIds) {
    const sends = sendsByAccount.get(accountId) ?? [];
    scores.set(accountId, calculateHealthScore(aggregateSendMetrics(sends)));
  }

  return scores;
}

export function calculateHealthScore(metrics: {
  sendsCount: number;
  deliveredCount: number;
  openedCount: number;
  bouncedCount: number;
  complainedCount: number;
}): number {
  const { sendsCount, deliveredCount, openedCount, bouncedCount, complainedCount } =
    metrics;

  if (sendsCount === 0) return DEFAULT_HEALTH_SCORE;

  const deliveryRate = (deliveredCount / sendsCount) * 100;
  const openRate = (openedCount / Math.max(deliveredCount, 1)) * 100;
  const bounceRate = (bouncedCount / sendsCount) * 100;
  const complaintRate = (complainedCount / sendsCount) * 100;
  const reputation = Math.max(0, 100 - bounceRate - complaintRate * 100);

  const score = deliveryRate * 0.4 + openRate * 0.35 + reputation * 0.25;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/** Used only by calculateDailyMetrics (23:59 cron) and manual admin recalc — not on send/events. */
export async function recalculateAccountHealthScore(
  accountId: string,
  account?: WarmUpAccountRow,
  options?: { closeOutDay?: boolean },
): Promise<number> {
  const db = createAdminClient();
  const closeOutDay = options?.closeOutDay ?? false;

  let accountRow = account;
  if (!accountRow) {
    const { data, error } = await db
      .from("admin_email_warm_up_accounts")
      .select("*")
      .eq("id", accountId)
      .single();
    if (error || !data) throw new Error("Warm-up account not found");
    accountRow = data as WarmUpAccountRow;
  }

  const sends = await queryHealthScoreSends(accountId, closeOutDay);
  const metrics = aggregateSendMetrics(sends);
  const healthScore = calculateHealthScore(metrics);

  const now = new Date().toISOString();
  await db
    .from("admin_email_warm_up_accounts")
    .update({
      current_health_score: healthScore,
      best_health_score: Math.max(accountRow.best_health_score, healthScore),
      updated_at: now,
    })
    .eq("id", accountId);

  return healthScore;
}

// ---------------------------------------------------------------------------
// Daily send target (70–120% of stage cap, ramp first 7 days)
// ---------------------------------------------------------------------------

function getDailySendTarget(
  account: WarmUpAccountRow,
  stageDailyLimit: number,
): number {
  const startDate = account.start_date ? new Date(account.start_date) : new Date();
  const dayNumber = Math.max(
    1,
    Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1,
  );

  // Ramp from ~50% to 100% over the first 7 days
  const rampFactor = dayNumber <= 7 ? 0.5 + (dayNumber - 1) * (0.5 / 6) : 1.0;

  // Deterministic variation: 70–120% of limit
  const seed = parseInt(account.id.replace(/-/g, "").slice(0, 8), 16) || 1;
  const variation = 0.7 + ((seed + dayNumber) % 50) / 100;

  return Math.max(1, Math.round(stageDailyLimit * rampFactor * variation));
}

// ---------------------------------------------------------------------------
// Recipients CRUD
// ---------------------------------------------------------------------------

export async function listWarmUpRecipients(projectId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_recipients")
    .select("*")
    .eq("project_id", projectId)
    .order("emails_received", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpRecipientRow[];
}

export async function addWarmUpRecipient(input: {
  projectId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_recipients")
    .insert({
      project_id: input.projectId,
      email: input.email.trim().toLowerCase(),
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      company: input.company?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WarmUpRecipientRow;
}

export async function bulkAddWarmUpRecipients(
  projectId: string,
  recipients: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }[],
) {
  const db = createAdminClient();
  const rows = recipients.map((r) => ({
    project_id: projectId,
    email: r.email.trim().toLowerCase(),
    first_name: r.firstName?.trim() || null,
    last_name: r.lastName?.trim() || null,
    company: r.company?.trim() || null,
  }));

  const { data, error } = await db
    .from("admin_email_warm_up_recipients")
    .upsert(rows, { onConflict: "project_id,email", ignoreDuplicates: true })
    .select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpRecipientRow[];
}

export async function updateWarmUpRecipient(
  id: string,
  updates: Partial<Pick<WarmUpRecipientRow, "first_name" | "last_name" | "company" | "is_active">>,
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_recipients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WarmUpRecipientRow;
}

export async function deleteWarmUpRecipient(id: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_warm_up_recipients")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Templates CRUD + default seeding
// ---------------------------------------------------------------------------

export async function listWarmUpTemplates(projectId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_templates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpTemplateRow[];
}

export async function seedDefaultTemplates(projectId: string) {
  const db = createAdminClient();

  const { count } = await db
    .from("admin_email_warm_up_templates")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_TEMPLATES.map((t) => ({
    project_id: projectId,
    name: t.name,
    subject: t.subject,
    body: t.body,
    is_active: true,
  }));

  await db.from("admin_email_warm_up_templates").insert(rows);
}

export async function createWarmUpTemplate(input: {
  projectId: string;
  name: string;
  subject: string;
  body: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_templates")
    .insert({
      project_id: input.projectId,
      name: input.name.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      is_active: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WarmUpTemplateRow;
}

export async function updateWarmUpTemplate(
  id: string,
  updates: Partial<Pick<WarmUpTemplateRow, "name" | "subject" | "body" | "is_active">>,
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WarmUpTemplateRow;
}

export async function deleteWarmUpTemplate(id: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("admin_email_warm_up_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Send warm-up emails for one account
// ---------------------------------------------------------------------------

export type SendWarmUpResult = {
  accountId: string;
  attempted: number;
  sent: number;
  errors: string[];
};

export async function sendWarmUpEmails(
  accountId: string,
  opts?: { manual?: boolean; count?: number },
): Promise<SendWarmUpResult> {
  const db = createAdminClient();

  const { data: accountData, error: accountError } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accountError || !accountData) {
    throw new Error("Warm-up account not found");
  }

  const account = accountData as WarmUpAccountRow;

  if (!opts?.manual && account.warm_up_status !== "active") {
    return { accountId, attempted: 0, sent: 0, errors: ["Account not active"] };
  }

  const { data: projectRow } = await db
    .from("admin_email_projects")
    .select("daily_limit")
    .eq("id", account.project_id)
    .single();
  const projectDailyCap = projectRow?.daily_limit ?? 300;

  const stageConfig = STAGE_CONFIG[account.current_stage];
  const stageRemaining = stageConfig.dailyLimit - account.emails_sent_today;
  const projectRemaining = projectDailyCap - account.emails_sent_today;
  const remaining = Math.min(stageRemaining, projectRemaining);
  if (remaining <= 0) {
    return {
      accountId,
      attempted: 0,
      sent: 0,
      errors: ["Daily limit reached"],
    };
  }

  const targetCount =
    opts?.count ??
    Math.min(
      remaining,
      getDailySendTarget(account, stageConfig.dailyLimit),
      projectDailyCap,
    );

  // Ensure default templates exist
  await seedDefaultTemplates(account.project_id);

  const [{ data: templates }, { data: recipients }] = await Promise.all([
    db
      .from("admin_email_warm_up_templates")
      .select("*")
      .eq("project_id", account.project_id)
      .eq("is_active", true),
    db
      .from("admin_email_warm_up_recipients")
      .select("*")
      .eq("project_id", account.project_id)
      .eq("is_active", true)
      .order("emails_received", { ascending: true })
      .limit(targetCount * 2 + 10),
  ]);

  if (!templates?.length) {
    return { accountId, attempted: 0, sent: 0, errors: ["No active templates"] };
  }
  if (!recipients?.length) {
    return { accountId, attempted: 0, sent: 0, errors: ["No active recipients"] };
  }

  const senderName =
    [account.first_name, account.last_name].filter(Boolean).join(" ") ||
    account.email.split("@")[0] ||
    "The Team";

  const errors: string[] = [];
  let sent = 0;
  const recipientList = recipients as WarmUpRecipientRow[];

  for (let i = 0; i < targetCount; i++) {
    const template = templates[i % templates.length] as WarmUpTemplateRow;
    const recipient = recipientList[i % recipientList.length];
    if (!recipient) break;

    const recipientName =
      recipient.first_name || recipient.email.split("@")[0] || "there";
    const company = recipient.company || "your company";

    const { subject, body } = personalizeTemplate(
      template.subject,
      template.body,
      { first_name: recipientName, from_name: senderName, company },
    );

    const sendId = randomUUID();
    const html = buildWarmUpSendHtml(body, sendId);

    const result = await sendSesEmail({
      from: account.email,
      fromName: senderName,
      to: recipient.email,
      subject,
      html,
      text: body,
    });

    if (result.error) {
      errors.push(`${recipient.email}: ${result.error}`);
    } else {
      sent++;

      await Promise.all([
        db.from("admin_email_warm_up_sends").insert({
          id: sendId,
          account_id: accountId,
          project_id: account.project_id,
          recipient_email: recipient.email,
          recipient_first_name: recipient.first_name,
          template_id: template.id,
          subject,
          body,
          message_id: sesMessageIdFromResult(result),
          is_delivered: true,
        }),
        db
          .from("admin_email_warm_up_recipients")
          .update({
            emails_received: (recipient.emails_received ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipient.id),
      ]);
    }

    // Delay between sends (manual: 2–4 s, automated: 120–360 s)
    if (i < targetCount - 1) {
      const delaySec = opts?.manual
        ? 2 + Math.floor(Math.random() * 3)
        : 120 + Math.floor(Math.random() * 240);
      await new Promise((r) => setTimeout(r, delaySec * 1000));
    }
  }

  // Update account counters
  const now = new Date().toISOString();
  await db
    .from("admin_email_warm_up_accounts")
    .update({
      emails_sent_today: account.emails_sent_today + sent,
      total_emails_sent: account.total_emails_sent + sent,
      last_send_date: now,
      updated_at: now,
    })
    .eq("id", accountId);

  return { accountId, attempted: targetCount, sent, errors };
}

// ---------------------------------------------------------------------------
// Daily counter reset (midnight UTC)
// ---------------------------------------------------------------------------

export async function resetDailyCounters() {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      emails_sent_today: 0,
      campaign_sent_today: 0,
      updated_at: now,
    })
    .neq("warm_up_status", "failed");
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Calculate daily metrics + health score + stage progression
// ---------------------------------------------------------------------------

export async function calculateDailyMetrics(
  projectId?: string,
  options?: { closeOutDay?: boolean },
) {
  const db = createAdminClient();
  const today = utcTodayDate();
  const closeOutDay = options?.closeOutDay ?? false;

  let query = db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .in("warm_up_status", ["active", "paused", "completed"]);
  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: accounts } = await query;
  if (!accounts?.length) return { processed: 0 };

  let processed = 0;

  for (const accountData of accounts) {
    const account = accountData as WarmUpAccountRow;
    try {
      const sendFields =
        "is_delivered,opened_at,clicked_at,replied_at,is_bounced,is_complained" as const;

      const [{ data: todaySends }, healthScoreSends] = await Promise.all([
        db
          .from("admin_email_warm_up_sends")
          .select(sendFields)
          .eq("account_id", account.id)
          .gte("sent_at", `${today}T00:00:00.000Z`),
        queryHealthScoreSends(account.id, closeOutDay),
      ]);

      const todayMetrics = aggregateSendMetrics(
        (todaySends ?? []) as SendMetricsInput[],
      );
      const windowMetrics = aggregateSendMetrics(healthScoreSends);
      const {
        sendsCount,
        deliveredCount,
        openedCount,
        bouncedCount,
        complainedCount,
      } = todayMetrics;
      const clickedCount = (todaySends ?? []).filter((s) => s.clicked_at).length;

      const healthScore = calculateHealthScore(windowMetrics);

      let stageProgressionTriggered = false;

      // Update health score on account
      const updates: Partial<WarmUpAccountRow> & { updated_at: string } = {
        current_health_score: healthScore,
        best_health_score: Math.max(account.best_health_score, healthScore),
        updated_at: new Date().toISOString(),
      };

      // Check stage progression
      const stageConfig = STAGE_CONFIG[account.current_stage];
      if (
        stageConfig.nextStage &&
        account.total_emails_sent >= stageConfig.minSendsForProgression &&
        healthScore >= stageConfig.minDeliveryRate * 0.4 &&
        windowMetrics.sendsCount > 0
      ) {
        const deliveryRate =
          (windowMetrics.deliveredCount / windowMetrics.sendsCount) * 100;
        const openRate =
          (windowMetrics.openedCount /
            Math.max(windowMetrics.deliveredCount, 1)) *
          100;
        const bounceRate =
          (windowMetrics.bouncedCount / windowMetrics.sendsCount) * 100;

        if (
          deliveryRate >= stageConfig.minDeliveryRate &&
          openRate >= stageConfig.minOpenRate &&
          bounceRate <= stageConfig.maxBounceRate
        ) {
          const nextStage = stageConfig.nextStage;
          updates.current_stage = nextStage;
          updates.daily_limit = STAGE_CONFIG[nextStage].dailyLimit;
          stageProgressionTriggered = true;
          if (nextStage === "ready") {
            updates.warm_up_status = "completed";
          }
        }
      }

      // Upsert daily metric row
      await db.from("admin_email_warm_up_metrics").upsert(
        {
          account_id: account.id,
          project_id: account.project_id,
          date: today,
          sends_count: sendsCount,
          delivered_count: deliveredCount,
          opened_count: openedCount,
          clicked_count: clickedCount,
          bounced_count: bouncedCount,
          complained_count: complainedCount,
          health_score: healthScore,
          stage: updates.current_stage ?? account.current_stage,
          stage_progression_triggered: stageProgressionTriggered,
        },
        { onConflict: "account_id,date" },
      );

      await db
        .from("admin_email_warm_up_accounts")
        .update(updates)
        .eq("id", account.id);

      processed++;
    } catch {
      // Continue processing other accounts
    }
  }

  return { processed };
}

// ---------------------------------------------------------------------------
// Scheduled daily send: all active accounts
// ---------------------------------------------------------------------------

export async function runDailyWarmUpSends(projectId?: string): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const db = createAdminClient();

  const { data: enabledProjects } = await db
    .from("admin_email_projects")
    .select("id")
    .eq("warm_up_enabled", true);
  const enabledIds = new Set((enabledProjects ?? []).map((p) => p.id));
  if (enabledIds.size === 0) return { processed: 0, sent: 0, errors: 0 };

  let query = db
    .from("admin_email_warm_up_accounts")
    .select("id, project_id")
    .eq("warm_up_status", "active");
  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: accounts } = await query;
  const eligible = (accounts ?? []).filter((a) => enabledIds.has(a.project_id));
  if (!eligible.length) return { processed: 0, sent: 0, errors: 0 };

  let totalSent = 0;
  let totalErrors = 0;

  for (const { id } of eligible) {
    try {
      const result = await sendWarmUpEmails(id);
      totalSent += result.sent;
      totalErrors += result.errors.length;
    } catch {
      totalErrors++;
    }
  }

  return { processed: eligible.length, sent: totalSent, errors: totalErrors };
}

// ---------------------------------------------------------------------------
// Rich manual send: specific recipients, template, optional overrides
// ---------------------------------------------------------------------------

export async function sendManualWarmUpEmailRich(
  accountId: string,
  opts: {
    templateId?: string;
    recipientEmails: string[];
    customSubject?: string;
    customBody?: string;
    fromEmail?: string;
  },
): Promise<{
  sent: number;
  attempted: number;
  emails_sent: number;
  remaining_today: number;
  errors: string[];
}> {
  const db = createAdminClient();

  const { data: accountData, error: accountError } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (accountError || !accountData) throw new Error("Warm-up account not found");
  const account = accountData as WarmUpAccountRow;

  const stageConfig = STAGE_CONFIG[account.current_stage];
  const remaining = stageConfig.dailyLimit - account.emails_sent_today;
  if (remaining <= 0) throw new Error("Daily limit reached");

  const sendFrom = opts.fromEmail?.trim() || account.email;
  const senderName =
    [account.first_name, account.last_name].filter(Boolean).join(" ") ||
    sendFrom.split("@")[0] ||
    "The Team";

  // Resolve template
  let templateRow: WarmUpTemplateRow | null = null;
  if (opts.templateId) {
    const { data } = await db
      .from("admin_email_warm_up_templates")
      .select("*")
      .eq("id", opts.templateId)
      .single();
    templateRow = (data as WarmUpTemplateRow) ?? null;
  }

  // Ensure defaults exist if no specific template
  if (!templateRow) {
    await seedDefaultTemplates(account.project_id);
    const { data: templates } = await db
      .from("admin_email_warm_up_templates")
      .select("*")
      .eq("project_id", account.project_id)
      .eq("is_active", true)
      .limit(1);
    templateRow = (templates?.[0] as WarmUpTemplateRow) ?? null;
  }
  if (!templateRow) throw new Error("No active templates found");

  const toSend = opts.recipientEmails.slice(0, remaining);
  const errors: string[] = [];
  let sent = 0;

  for (let i = 0; i < toSend.length; i++) {
    const recipientEmail = toSend[i];
    if (!recipientEmail) continue;
    const firstName = recipientEmail.split("@")[0] ?? "there";

    // Resolve recipient first name from DB if available
    const { data: recipientRow } = await db
      .from("admin_email_warm_up_recipients")
      .select("first_name, last_name, company, id, emails_received")
      .eq("project_id", account.project_id)
      .eq("email", recipientEmail.toLowerCase())
      .maybeSingle();

    const recipientFirstName = recipientRow?.first_name ?? firstName;
    const company = recipientRow?.company ?? "your company";

    const rawSubject = opts.customSubject?.trim() || templateRow.subject;
    const rawBody = opts.customBody?.trim() || templateRow.body;

    const { subject, body } = personalizeTemplate(rawSubject, rawBody, {
      first_name: recipientFirstName,
      from_name: senderName,
      company,
    });

    const sendId = randomUUID();
    const html = buildWarmUpSendHtml(body, sendId);

    const result = await sendSesEmail({
      from: sendFrom,
      fromName: senderName,
      to: recipientEmail,
      subject,
      html,
      text: body,
    });

    if (result.error) {
      errors.push(`${recipientEmail}: ${result.error}`);
    } else {
      sent++;

      await db.from("admin_email_warm_up_sends").insert({
        id: sendId,
        account_id: accountId,
        project_id: account.project_id,
        recipient_email: recipientEmail,
        recipient_first_name: recipientFirstName,
        template_id: templateRow.id,
        subject,
        body,
        message_id: sesMessageIdFromResult(result),
        is_delivered: true,
      });

      if (recipientRow) {
        await db
          .from("admin_email_warm_up_recipients")
          .update({
            emails_received: (recipientRow.emails_received ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", recipientRow.id);
      }
    }

    // Short delay between sends (2–4 s for manual)
    if (i < toSend.length - 1) {
      await new Promise((r) =>
        setTimeout(r, (2 + Math.floor(Math.random() * 3)) * 1000),
      );
    }
  }

  const now = new Date().toISOString();
  await db
    .from("admin_email_warm_up_accounts")
    .update({
      emails_sent_today: account.emails_sent_today + sent,
      total_emails_sent: account.total_emails_sent + sent,
      last_send_date: now,
      updated_at: now,
    })
    .eq("id", accountId);

  return {
    attempted: toSend.length,
    sent,
    emails_sent: sent,
    remaining_today: remaining - sent,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Get send history for one account
// ---------------------------------------------------------------------------

export async function getWarmUpSends(accountId: string, limit = 50) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("admin_email_warm_up_sends")
    .select("*")
    .eq("account_id", accountId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpSendRow[];
}

// ---------------------------------------------------------------------------
// Get daily stats chart data for one account
// ---------------------------------------------------------------------------

export async function getWarmUpDailyStats(accountId: string, days = 30) {
  const db = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await db
    .from("admin_email_warm_up_metrics")
    .select("*")
    .eq("account_id", accountId)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarmUpMetricsRow[];
}

export async function getWarmUpMetricsHistory(accountId: string, days = 30) {
  return getWarmUpDailyStats(accountId, days);
}

export async function getWarmUpAccountStatus(accountId: string) {
  const db = createAdminClient();
  const { data: account } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (!account) throw new Error("Warm-up account not found");

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: todayMetric }, { data: recentSends }] = await Promise.all([
    db
      .from("admin_email_warm_up_metrics")
      .select("*")
      .eq("account_id", accountId)
      .eq("date", today)
      .maybeSingle(),
    db
      .from("admin_email_warm_up_sends")
      .select("id, sent_at, is_delivered, opened_at, is_bounced")
      .eq("account_id", accountId)
      .order("sent_at", { ascending: false })
      .limit(5),
  ]);

  const row = account as WarmUpAccountRow;
  return {
    account: row,
    todayMetrics: todayMetric as WarmUpMetricsRow | null,
    recentSends: recentSends ?? [],
    remainingToday: Math.max(0, row.daily_limit - row.emails_sent_today),
    campaignRemainingToday: Math.max(
      0,
      row.campaign_daily_limit - row.campaign_sent_today,
    ),
  };
}

function lastSevenDayKeys(): { date: string; label: string }[] {
  const days: { date: string; label: string }[] = [];
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: labels[d.getDay()] ?? "",
    });
  }
  return days;
}

async function getWeeklyWarmUpSummary(
  accountId: string,
): Promise<WarmUpWeeklySummary> {
  const db = createAdminClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const [{ data: sends }, receivedResult] = await Promise.all([
    db
      .from("admin_email_warm_up_sends")
      .select("is_delivered, opened_at, clicked_at, replied_at")
      .eq("account_id", accountId)
      .gte("sent_at", sinceIso),
    db
      .from("admin_email_warm_up_received")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .gte("received_at", sinceIso),
  ]);

  const rows = sends ?? [];
  const emailsSent = rows.length;
  const delivered = rows.filter((s) => s.is_delivered).length;
  const opened = rows.filter((s) => isSendOpened(s)).length;
  const replied = rows.filter((s) => s.replied_at).length;
  const emailsReceived = receivedResult.error
    ? 0
    : (receivedResult.count ?? 0);

  return {
    emailsReceived,
    emailsSent,
    replyRate:
      emailsSent > 0 ? Math.round((replied / emailsSent) * 1000) / 10 : 0,
    openRate:
      delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
  };
}

async function getWeeklySendChart(
  accountId: string,
): Promise<WarmUpDailyChartPoint[]> {
  const db = createAdminClient();
  const dayKeys = lastSevenDayKeys();
  const since = `${dayKeys[0]?.date ?? ""}T00:00:00.000Z`;

  const { data: sends } = await db
    .from("admin_email_warm_up_sends")
    .select("sent_at")
    .eq("account_id", accountId)
    .gte("sent_at", since);

  const counts = new Map<string, number>();
  for (const key of dayKeys) counts.set(key.date, 0);

  for (const send of sends ?? []) {
    const date = send.sent_at.slice(0, 10);
    if (counts.has(date)) {
      counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  }

  return dayKeys.map(({ date, label }) => ({
    date,
    label,
    count: counts.get(date) ?? 0,
  }));
}

export async function getWarmUpSidebarDetails(accountId: string) {
  const [status, metrics, sends, weeklySummary, weeklyChart] =
    await Promise.all([
      getWarmUpAccountStatus(accountId),
      getWarmUpDailyStats(accountId, 14),
      getWarmUpSends(accountId, 20),
      getWeeklyWarmUpSummary(accountId),
      getWeeklySendChart(accountId),
    ]);

  const account = status.account;

  return {
    ...status,
    metricsChart: metrics,
    sendLog: sends,
    weeklySummary,
    weeklyChart,
    warmUpProgress: {
      current: account.emails_sent_today,
      total: account.daily_limit,
    },
  };
}

export async function getHealthScoresList(projectId?: string) {
  const db = createAdminClient();
  let query = db
    .from("admin_email_warm_up_accounts")
    .select("id, email, current_health_score, best_health_score, warm_up_status, current_stage")
    .order("current_health_score", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const STAGE_ORDER: WarmUpStage[] = [
  "foundation",
  "growth",
  "expansion",
  "ready",
];

export async function recoverFromJunk(accountId: string) {
  const db = createAdminClient();
  const { data: account } = await db
    .from("admin_email_warm_up_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (!account) throw new Error("Warm-up account not found");

  const row = account as WarmUpAccountRow;
  const stageIdx = STAGE_ORDER.indexOf(row.current_stage);
  const prevStage = stageIdx > 0 ? STAGE_ORDER[stageIdx - 1] : row.current_stage;
  const reducedLimit = Math.max(
    5,
    Math.floor(STAGE_CONFIG[prevStage].dailyLimit * 0.5),
  );

  const { data, error } = await db
    .from("admin_email_warm_up_accounts")
    .update({
      warm_up_status: "paused",
      current_stage: prevStage,
      daily_limit: reducedLimit,
      emails_sent_today: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as WarmUpAccountRow;
}

export async function sendTestWarmUpEmail(
  accountId: string,
  recipientEmail: string,
) {
  const result = await sendManualWarmUpEmailRich(accountId, {
    recipientEmails: [recipientEmail],
  });
  return result;
}

export async function checkWarmUpHealth(projectId?: string) {
  const db = createAdminClient();
  let query = db
    .from("admin_email_warm_up_accounts")
    .select("id, email, current_health_score, total_emails_sent, emails_sent_today, daily_limit, warm_up_status")
    .in("warm_up_status", ["active", "paused"]);
  if (projectId) query = query.eq("project_id", projectId);

  const { data: accounts } = await query;
  if (!accounts?.length) return { checked: 0, lowHealth: 0, resetCounters: 0 };

  let lowHealth = 0;
  let resetCounters = 0;
  const now = new Date().toISOString();

  for (const account of accounts) {
    if (account.total_emails_sent > 0 && account.current_health_score < 30) {
      lowHealth++;
      console.warn(
        `[warm-up health] Low health score for ${account.email}: ${account.current_health_score}`,
      );
    }

    if (account.emails_sent_today > account.daily_limit) {
      await db
        .from("admin_email_warm_up_accounts")
        .update({
          emails_sent_today: account.daily_limit,
          updated_at: now,
        })
        .eq("id", account.id);
      resetCounters++;
    }
  }

  return { checked: accounts.length, lowHealth, resetCounters };
}

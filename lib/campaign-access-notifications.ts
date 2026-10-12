import { createAdminClient } from "@/utils/supabase/admin";
import type { CampaignAccessNotificationType } from "@/lib/campaign-access";

const INSERT_BATCH = 500;
const UNIQUE_VIOLATION = "23505";

type ContestInfo = {
  id: string;
  title: string | null;
  advertiser_id: string | null;
  moderation_status: string | null;
  brand_name: string;
};

async function loadContest(contestId: string): Promise<ContestInfo | null> {
  const db = createAdminClient();
  const { data: contest } = await db
    .from("contests")
    .select("id, title, advertiser_id, moderation_status")
    .eq("id", contestId)
    .maybeSingle();
  if (!contest) return null;

  let brandName = "A brand";
  if (contest.advertiser_id) {
    const { data: profile } = await db
      .from("advertiser_profiles")
      .select("company_name")
      .eq("id", contest.advertiser_id)
      .maybeSingle();
    if (profile?.company_name?.trim()) brandName = profile.company_name.trim();
  }
  return { ...contest, brand_name: brandName } as ContestInfo;
}

async function insertNotifications(
  userIds: string[],
  contestId: string,
  type: CampaignAccessNotificationType,
  title: string,
  message: string,
  { ignoreDuplicate = false }: { ignoreDuplicate?: boolean } = {},
): Promise<void> {
  const db = createAdminClient();
  const unique = Array.from(new Set(userIds));
  for (let i = 0; i < unique.length; i += INSERT_BATCH) {
    const rows = unique.slice(i, i + INSERT_BATCH).map((user_id) => ({
      user_id,
      contest_id: contestId,
      notification_type: type,
      title,
      message_resolved: message,
    }));
    const { error } = await db.from("user_notifications").insert(rows);
    if (error && !(ignoreDuplicate && error.code === UNIQUE_VIOLATION)) throw error;
  }
}

/** Runs a notification job without ever failing the request that triggered it. */
async function safely(label: string, job: () => Promise<void>): Promise<void> {
  try {
    await job();
  } catch (err) {
    console.error(`[campaign-access-notifications] ${label} failed:`, err);
  }
}

/** Tells the owning brand about a new application (one unread notification per campaign). */
export async function notifyApplicationReceived(contestId: string): Promise<void> {
  await safely("application received", async () => {
    const contest = await loadContest(contestId);
    if (!contest?.advertiser_id) return;

    const { count } = await createAdminClient()
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", contest.advertiser_id)
      .eq("contest_id", contestId)
      .eq("notification_type", "campaign_application_received")
      .eq("is_read", false);
    if ((count ?? 0) > 0) return;

    await insertNotifications(
      [contest.advertiser_id],
      contestId,
      "campaign_application_received",
      "New application",
      `Creators are applying to ${contest.title || "your campaign"}. Review them in the Applications tab.`,
      // A concurrent application may have just created the unread notification.
      { ignoreDuplicate: true },
    );
  });
}

/** Tells creators their application was approved or rejected. */
export async function notifyApplicationReviewed(
  contestId: string,
  userIds: string[],
  outcome: "approved" | "rejected",
  reason: string | null,
): Promise<void> {
  if (userIds.length === 0) return;
  await safely(`application ${outcome}`, async () => {
    const contest = await loadContest(contestId);
    if (!contest) return;
    const title = contest.title || "a campaign";
    if (outcome === "approved") {
      await insertNotifications(
        userIds,
        contestId,
        "campaign_application_approved",
        `You're in: ${title}`,
        `${contest.brand_name} approved your application. You can now see the full campaign and submit.`,
      );
      return;
    }
    await insertNotifications(
      userIds,
      contestId,
      "campaign_application_rejected",
      "Application not selected",
      `Your application for ${title} wasn't selected this time.${reason ? `\n\nReason: ${reason}` : ""}`,
    );
  });
}

/**
 * Tells creators a brand added them to a campaign (manual add or saved list).
 * Only for published campaigns; invite-link joins and existing submitters are skipped by callers.
 */
export async function notifyAccessGranted(contestId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await safely("access granted", async () => {
    const contest = await loadContest(contestId);
    if (!contest || contest.moderation_status !== "published") return;
    await insertNotifications(
      userIds,
      contestId,
      "campaign_access_granted",
      `You're invited: ${contest.title || "a campaign"}`,
      `${contest.brand_name} gave you access to ${contest.title || "their campaign"}.`,
    );
  });
}

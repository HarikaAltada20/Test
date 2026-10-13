import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  type AccessActor,
} from "@/lib/campaign-access-server";
import {
  isApplicationStatus,
  type ApplicationAnswer,
  type ApplicationStatus,
} from "@/lib/campaign-access";
import {
  APPLICANT_FIELDS,
  APPLICANT_PROFILE_COLUMNS,
  applyApplicantVisibility,
  buildApplicantProfile,
  parseApplicantVisibility,
  type ApplicantField,
  type ApplicantProfile,
} from "@/lib/campaign-applicant-profile";

/** A recent approved submission, shown as an example of the creator's work. */
export type CreatorWorkItem = {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  url: string;
  platform: string | null;
  views: number | null;
  created_at: string;
  campaign_title: string | null;
};

export type CampaignCreatorProfile = {
  campaign: { id: string; title: string | null };
  user: {
    id: string;
    username: string | null;
    full_name: string | null;
    profile_picture_url: string | null;
    bio: string | null;
  };
  /** Brand-safe summary; hidden details already removed for brands. */
  profile: ApplicantProfile | null;
  /** Details the admin hid from the brand on this campaign. */
  hiddenFields: ApplicantField[];
  viewerIsAdmin: boolean;
  application: {
    status: ApplicationStatus;
    answers: ApplicationAnswer[];
    rejection_reason: string | null;
    created_at: string;
  } | null;
  onAccessList: boolean;
  /** Null when "Submissions and views" is hidden from the brand. */
  recentWork: CreatorWorkItem[] | null;
};

const RECENT_WORK_LIMIT = 6;
/** Recent approved submissions scanned to find ones the brand may see. */
const RECENT_WORK_SCAN = 60;

/**
 * A creator's full profile in the context of one campaign. Only the
 * campaign's brand or an admin may open it, and only for creators who applied
 * to the campaign or are on its access list. The admin's "what the brand
 * sees" switches for the campaign apply. Throws CampaignAccessError(404)
 * otherwise, so the page can't be used to look up arbitrary creators.
 */
export async function loadCampaignCreatorProfile(
  admin: SupabaseClient,
  actor: AccessActor,
  contestId: string,
  userId: string,
): Promise<CampaignCreatorProfile> {
  const contest = await assertCanManageCampaignAccess(admin, actor, contestId);

  const [applicationRes, accessRes, contestRes, visibilityRes] = await Promise.all([
    admin
      .from("contest_applications")
      .select("status, answers, rejection_reason, created_at")
      .eq("contest_id", contestId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("contest_access_list")
      .select("user_id")
      .eq("contest_id", contestId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("contests").select("title").eq("id", contestId).maybeSingle(),
    admin.from("contests").select("applicant_visibility").eq("id", contestId).maybeSingle(),
  ]);
  if (applicationRes.error) throw applicationRes.error;
  if (accessRes.error) throw accessRes.error;
  if (!applicationRes.data && !accessRes.data) {
    throw new CampaignAccessError("Creator not found", 404);
  }

  const [userRes, profileRes] = await Promise.all([
    admin
      .from("users")
      .select("id, username, full_name, profile_picture_url")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("creator_profiles")
      .select(`${APPLICANT_PROFILE_COLUMNS}, bio`)
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (userRes.error) throw userRes.error;
  if (!userRes.data) throw new CampaignAccessError("Creator not found", 404);
  if (profileRes.error) console.error("[creator-profile] profile:", profileRes.error.message);

  // Missing column (migration not run) means everything is visible.
  const visibility = parseApplicantVisibility(
    visibilityRes.error ? null : visibilityRes.data?.applicant_visibility,
  );
  const hiddenFields = APPLICANT_FIELDS.filter((f) => !visibility[f]);
  const profileRow = (profileRes.data ?? null) as Record<string, unknown> | null;
  const fullProfile = buildApplicantProfile(profileRow);
  const profile = actor.isAdmin
    ? fullProfile && hiddenFields.length
      ? { ...fullProfile, hiddenFields }
      : fullProfile
    : applyApplicantVisibility(fullProfile, visibility);

  const showBasics = actor.isAdmin || visibility.basics;
  const showActivity = actor.isAdmin || visibility.activity;
  const bio =
    showBasics && typeof profileRow?.bio === "string" && profileRow.bio.trim()
      ? profileRow.bio.trim()
      : null;

  const app = applicationRes.data as {
    status: string;
    answers: unknown;
    rejection_reason: string | null;
    created_at: string;
  } | null;

  return {
    campaign: { id: contestId, title: (contestRes.data?.title as string | null) ?? null },
    user: {
      id: userRes.data.id,
      username: userRes.data.username ?? null,
      full_name: userRes.data.full_name ?? null,
      profile_picture_url: userRes.data.profile_picture_url ?? null,
      bio,
    },
    profile,
    hiddenFields,
    viewerIsAdmin: actor.isAdmin,
    application:
      app && isApplicationStatus(app.status)
        ? {
            status: app.status,
            answers: Array.isArray(app.answers) ? (app.answers as ApplicationAnswer[]) : [],
            rejection_reason: app.rejection_reason,
            created_at: app.created_at,
          }
        : null,
    onAccessList: !!accessRes.data,
    recentWork: showActivity
      ? await loadRecentWork(admin, userId, contest.advertiser_id)
      : null,
  };
}

/**
 * Recent approved submissions the brand may already see: from published
 * Public campaigns, or from the brand's own campaigns. Other brands' private
 * campaigns are never shown.
 */
async function loadRecentWork(
  admin: SupabaseClient,
  userId: string,
  brandId: string | null,
): Promise<CreatorWorkItem[]> {
  const { data: subs, error } = await admin
    .from("submissions")
    .select("id, contest_id, content_link, views, video_title, video_thumbnail_url, platform, created_at")
    .eq("creator_id", userId)
    .in("status", ["verified", "paid"])
    .order("created_at", { ascending: false })
    .limit(RECENT_WORK_SCAN);
  if (error) {
    console.error("[creator-profile] submissions:", error.message);
    return [];
  }
  const rows = (subs ?? []) as {
    id: string;
    contest_id: string;
    content_link: string;
    views: number | null;
    video_title: string | null;
    video_thumbnail_url: string | null;
    platform: string | null;
    created_at: string;
  }[];
  if (rows.length === 0) return [];

  const contestIds = Array.from(new Set(rows.map((r) => r.contest_id)));
  const { data: contests, error: contestsError } = await admin
    .from("contests")
    .select("id, title, access_mode, advertiser_id, moderation_status")
    .in("id", contestIds);
  if (contestsError) {
    console.error("[creator-profile] contests:", contestsError.message);
    return [];
  }
  const allowed = new Map<string, string | null>();
  for (const c of (contests ?? []) as {
    id: string;
    title: string | null;
    access_mode: string | null;
    advertiser_id: string | null;
    moderation_status: string | null;
  }[]) {
    const publicCampaign = (c.access_mode ?? "public") === "public" && c.moderation_status === "published";
    const ownCampaign = !!brandId && c.advertiser_id === brandId;
    if (publicCampaign || ownCampaign) allowed.set(c.id, c.title);
  }

  return rows
    .filter((r) => allowed.has(r.contest_id) && /^https?:\/\//i.test(r.content_link))
    .slice(0, RECENT_WORK_LIMIT)
    .map((r) => ({
      id: r.id,
      title: r.video_title,
      thumbnail_url: r.video_thumbnail_url,
      url: r.content_link,
      platform: r.platform,
      views: Number.isFinite(Number(r.views)) ? Number(r.views) : null,
      created_at: r.created_at,
      campaign_title: allowed.get(r.contest_id) ?? null,
    }));
}

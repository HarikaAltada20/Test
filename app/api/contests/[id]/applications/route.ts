import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
  getSignedInClient,
  loadApplicantVisibilityRaw,
  loadUserDisplay,
} from "@/lib/campaign-access-server";
import {
  APPLICATION_REQUIREMENT_FILTERS,
  APPLICATION_SORTS,
  APPLICATION_STATUSES,
  isApplicationStatus,
  isOneOfValues,
  isRequirementState,
  isUuid,
  type ApplicationAnswer,
  type ApplicationStatus,
  type CampaignRequirementsMode,
  type ContestApplication,
} from "@/lib/campaign-access";
import { hasAnyContestCreatorRequirement } from "@/lib/creator-requirements";
import { applicationResultResponse } from "@/lib/campaign-applications-server";
import { invalidateOpportunitiesListCacheForUser } from "@/lib/campaign-list-cache";
import { notifyApplicationReceived } from "@/lib/campaign-access-notifications";
import {
  APPLICANT_FIELDS,
  APPLICANT_PROFILE_COLUMNS,
  applyApplicantVisibility,
  buildApplicantProfile,
  parseApplicantVisibility,
} from "@/lib/campaign-applicant-profile";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_SEARCH_LENGTH = 100;

type ApplicationRow = {
  id: string;
  contest_id: string;
  user_id: string;
  status: ApplicationStatus;
  answers: ApplicationAnswer[] | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  on_access_list: boolean;
  requirement_state?: string | null;
};

/** Requirement columns plus the applications switch, read once per request. */
const CONTEST_REVIEW_COLUMNS =
  "applications_open, access_list_skips_requirements, contest_format, trust_score, trust_number, min_avg_quality_score, min_best_quality_score, min_quality_score, min_platform_earnings, min_platform_views";

/** Shape returned by the contest_applications_page RPC. */
type ApplicationsPage = {
  total?: number;
  counts?: Partial<Record<ApplicationStatus, number>>;
  rows?: ApplicationRow[];
};

/** Accepts [{ question_id, answer }] or { [questionId]: answer }. */
function normalizeAnswers(raw: unknown): { question_id: string; answer: string }[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
      .map((a) => ({ question_id: String(a.question_id ?? ""), answer: String(a.answer ?? "") }))
      .filter((a) => a.question_id);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([question_id, answer]) => ({
      question_id,
      answer: String(answer ?? ""),
    }));
  }
  return [];
}

/** POST /api/contests/:id/applications — the signed-in creator applies. Body: { answers } */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase, userId } = await getSignedInClient();
    const body = await request.json().catch(() => ({}));

    const { data, error } = await supabase.rpc("submit_contest_application", {
      p_contest_id: id,
      p_answers: normalizeAnswers(body?.answers),
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as
      | { application_id: string | null; result: string; detail: string | null }
      | undefined;
    if (row?.result === "submitted") {
      await invalidateOpportunitiesListCacheForUser(userId);
      await notifyApplicationReceived(id);
    }
    return applicationResultResponse(row?.result, {
      applicationId: row?.application_id ?? null,
      questionId: row?.detail ?? null,
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/** DELETE /api/contests/:id/applications — the signed-in creator withdraws a pending application. */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const { supabase, userId } = await getSignedInClient();
    const { data, error } = await supabase.rpc("withdraw_contest_application", {
      p_contest_id: id,
    });
    if (error) throw error;
    if (data === "withdrawn") await invalidateOpportunitiesListCacheForUser(userId);
    return applicationResultResponse(data);
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

/**
 * Brand-safe creator summaries (connected accounts, scores, basics) for the
 * applicants on this page. Missing profiles or a failed read just leave them out.
 */
async function loadApplicantProfiles(
  admin: ReturnType<typeof getServiceClient>,
  userIds: string[],
) {
  const map = new Map<string, ReturnType<typeof buildApplicantProfile>>();
  if (userIds.length === 0) return map;
  const { data, error } = await admin
    .from("creator_profiles")
    .select(APPLICANT_PROFILE_COLUMNS)
    .in("id", userIds);
  if (error) {
    console.error("[applications] creator profiles:", error.message);
    return map;
  }
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    map.set(String(row.id), buildApplicantProfile(row));
  }
  return map;
}

/**
 * GET /api/contests/:id/applications?status=pending|approved|rejected|withdrawn|all&search=&page=&limit=
 *   &sort=newest|oldest|followers&requirements=all|meets|below
 * Brand or admin only. Returns one page plus per-status counts, whether
 * applications are open and whether the campaign's requirements apply.
 */
export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    if (!isUuid(id)) throw new CampaignAccessError("Campaign not found", 404);
    const actor = await getAccessActor();
    const admin = getServiceClient();
    await assertCanManageCampaignAccess(admin, actor, id);

    const sp = new URL(request.url).searchParams;
    const statusParam = sp.get("status") || "pending";
    if (statusParam !== "all" && !isApplicationStatus(statusParam)) {
      throw new CampaignAccessError("Unknown status", 400);
    }
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(sp.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
    );
    const search = (sp.get("search") || "").trim().slice(0, MAX_SEARCH_LENGTH);
    const sortParam = sp.get("sort") || "newest";
    if (!isOneOfValues(APPLICATION_SORTS, sortParam)) {
      throw new CampaignAccessError("Unknown sort", 400);
    }
    const requirementsParam = sp.get("requirements") || "all";
    if (!isOneOfValues(APPLICATION_REQUIREMENT_FILTERS, requirementsParam)) {
      throw new CampaignAccessError("Unknown requirements filter", 400);
    }

    // Sort and requirements are only sent when used, so the default list
    // still works before the 20261020 migration adds them.
    const { data, error } = await admin.rpc("contest_applications_page", {
      p_contest_id: id,
      p_status: statusParam,
      p_search: search || null,
      p_offset: (page - 1) * limit,
      p_limit: limit,
      ...(sortParam !== "newest" ? { p_sort: sortParam } : {}),
      ...(requirementsParam !== "all" ? { p_requirements: requirementsParam } : {}),
    });
    if (error) throw error;
    const result = (data ?? {}) as ApplicationsPage;

    const counts = Object.fromEntries(
      APPLICATION_STATUSES.map((s) => [s, Number(result.counts?.[s] ?? 0)]),
    ) as Record<ApplicationStatus, number>;
    const rows = Array.isArray(result.rows) ? result.rows : [];
    const userIds = rows.map((r) => r.user_id);
    const [users, profiles, visibilityRaw, contestRow] = await Promise.all([
      loadUserDisplay(admin, userIds),
      loadApplicantProfiles(admin, userIds),
      // Throws on any error except a missing column, so hidden details stay hidden.
      loadApplicantVisibilityRaw(admin, id),
      admin.from("contests").select(CONTEST_REVIEW_COLUMNS).eq("id", id).maybeSingle(),
    ]);
    if (contestRow.error) throw contestRow.error;
    const contest = (contestRow.data ?? {}) as Record<string, unknown>;
    const requirementsMode: CampaignRequirementsMode = contest.access_list_skips_requirements
      ? "skipped"
      : hasAnyContestCreatorRequirement(contest)
        ? "apply"
        : "none";
    // Missing column (migration not run yet) means everything is visible.
    const visibility = parseApplicantVisibility(
      visibilityRaw,
    );
    const hiddenFields = APPLICANT_FIELDS.filter((f) => !visibility[f]);
    // Brands get the filtered summary; admins see everything, marked with what's hidden.
    const creatorFor = (userId: string) => {
      const profile = profiles.get(userId) ?? null;
      if (!actor.isAdmin) return applyApplicantVisibility(profile, visibility);
      return profile && hiddenFields.length ? { ...profile, hiddenFields } : profile;
    };

    const applications: ContestApplication[] = rows.map((r) => {
      const u = users.get(r.user_id);
      return {
        ...r,
        answers: Array.isArray(r.answers) ? r.answers : [],
        username: u?.username ?? null,
        full_name: u?.full_name ?? null,
        profile_picture_url: u?.profile_picture_url ?? null,
        on_access_list: !!r.on_access_list,
        creator: creatorFor(r.user_id),
        requirement_state: isRequirementState(r.requirement_state) ? r.requirement_state : null,
      };
    });

    return NextResponse.json({
      applications,
      total: Number(result.total ?? 0),
      page,
      limit,
      counts,
      applicationsOpen: contest.applications_open !== false,
      requirementsMode,
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

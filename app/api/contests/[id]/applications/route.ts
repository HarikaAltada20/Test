import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  assertCanManageCampaignAccess,
  campaignAccessErrorResponse,
  getAccessActor,
  getServiceClient,
  getSignedInClient,
  loadUserDisplay,
} from "@/lib/campaign-access-server";
import {
  APPLICATION_STATUSES,
  isApplicationStatus,
  type ApplicationAnswer,
  type ApplicationStatus,
  type ContestApplication,
} from "@/lib/campaign-access";
import { applicationResultResponse } from "@/lib/campaign-applications-server";
import { invalidateOpportunitiesListCacheForUser } from "@/lib/campaign-list-cache";
import { notifyApplicationReceived } from "@/lib/campaign-access-notifications";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const SEARCH_USER_CAP = 500;

type ApplicationRow = {
  id: string;
  contest_id: string;
  user_id: string;
  status: ApplicationStatus;
  answers: ApplicationAnswer[] | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
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
 * GET /api/contests/:id/applications?status=pending|approved|rejected|withdrawn|all&search=&page=&limit=
 * Brand or admin only. Returns one page plus per-status counts.
 */
export async function GET(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
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
    const search = (sp.get("search") || "").trim().replace(/[%_,()*\\]/g, "");

    let searchUserIds: string[] | null = null;
    if (search) {
      const { data: users, error } = await admin
        .from("users")
        .select("id")
        .ilike("username", `%${search}%`)
        .limit(SEARCH_USER_CAP);
      if (error) throw error;
      searchUserIds = (users || []).map((u) => u.id);
    }

    const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    await Promise.all(
      APPLICATION_STATUSES.map(async (s) => {
        const { count, error } = await admin
          .from("contest_applications")
          .select("id", { count: "exact", head: true })
          .eq("contest_id", id)
          .eq("status", s);
        if (error) throw error;
        counts[s] = count ?? 0;
      }),
    );

    if (searchUserIds && searchUserIds.length === 0) {
      return NextResponse.json({ applications: [], total: 0, page, limit, counts });
    }

    let query = admin
      .from("contest_applications")
      .select(
        "id, contest_id, user_id, status, answers, rejection_reason, reviewed_at, created_at",
        { count: "exact" },
      )
      .eq("contest_id", id)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * limit, page * limit - 1);
    if (statusParam !== "all") query = query.eq("status", statusParam);
    if (searchUserIds) query = query.in("user_id", searchUserIds);

    const { data, error, count } = await query;
    if (error) throw error;
    const rows = (data || []) as ApplicationRow[];

    const userIds = rows.map((r) => r.user_id);
    const users = await loadUserDisplay(admin, userIds);
    const onList = new Set<string>();
    if (userIds.length > 0) {
      const { data: access, error: accessError } = await admin
        .from("contest_access_list")
        .select("user_id")
        .eq("contest_id", id)
        .in("user_id", userIds);
      if (accessError) throw accessError;
      for (const a of access || []) onList.add(a.user_id);
    }

    const applications: ContestApplication[] = rows.map((r) => {
      const u = users.get(r.user_id);
      return {
        ...r,
        answers: Array.isArray(r.answers) ? r.answers : [],
        username: u?.username ?? null,
        full_name: u?.full_name ?? null,
        profile_picture_url: u?.profile_picture_url ?? null,
        on_access_list: onList.has(r.user_id),
      };
    });

    return NextResponse.json({ applications, total: count ?? 0, page, limit, counts });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import {
  CampaignAccessError,
  campaignAccessErrorResponse,
  getServiceClient,
  getSignedInClient,
} from "@/lib/campaign-access-server";
import {
  APPLICATION_STATUSES,
  isApplicationStatus,
  type ApplicationStatus,
  type MyApplicationListItem,
} from "@/lib/campaign-access";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Row = {
  id: string;
  contest_id: string;
  status: ApplicationStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type ContestRow = {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  start_date: string | null;
  end_date: string | null;
  moderation_status: string | null;
  advertiser_id: string | null;
};

/**
 * GET /api/applications/mine?status=all|pending|approved|rejected|withdrawn&page=
 * The signed-in creator's own applications, newest first, with each
 * campaign's title, picture, dates and brand, plus a count per status.
 */
export async function GET(request: Request) {
  try {
    const { userId } = await getSignedInClient();
    const sp = new URL(request.url).searchParams;
    const statusParam = sp.get("status") || "all";
    if (statusParam !== "all" && !isApplicationStatus(statusParam)) {
      throw new CampaignAccessError("Unknown status", 400);
    }
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    // Service client, always filtered to the caller: creators can read their
    // own applications, but not every campaign row they applied to.
    const admin = getServiceClient();

    let listQuery = admin
      .from("contest_applications")
      .select("id, contest_id, status, rejection_reason, created_at, reviewed_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (statusParam !== "all") listQuery = listQuery.eq("status", statusParam);

    // One exact count per status (counted in the database, so no row limit applies).
    const [listRes, ...countRes] = await Promise.all([
      listQuery,
      ...APPLICATION_STATUSES.map((s) =>
        admin
          .from("contest_applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", s),
      ),
    ]);
    if (listRes.error) throw listRes.error;
    const counts = {} as Record<ApplicationStatus, number>;
    APPLICATION_STATUSES.forEach((s, i) => {
      if (countRes[i].error) throw countRes[i].error;
      counts[s] = countRes[i].count ?? 0;
    });

    const rows = (listRes.data ?? []) as Row[];
    const contestIds = Array.from(new Set(rows.map((r) => r.contest_id)));
    const contests = new Map<string, ContestRow>();
    const brands = new Map<string, string>();
    const onAccessList = new Set<string>();
    if (contestIds.length > 0) {
      // Approved applications stay "approved" after a brand removes access,
      // so current membership decides what the creator is told.
      const { data: access, error: accessError } = await admin
        .from("contest_access_list")
        .select("contest_id")
        .eq("user_id", userId)
        .in("contest_id", contestIds);
      if (accessError) throw accessError;
      for (const a of (access ?? []) as { contest_id: string }[]) onAccessList.add(a.contest_id);

      const { data, error } = await admin
        .from("contests")
        .select("id, title, thumbnail_url, start_date, end_date, moderation_status, advertiser_id")
        .in("id", contestIds);
      if (error) throw error;
      for (const c of (data ?? []) as ContestRow[]) contests.set(c.id, c);

      const advertiserIds = Array.from(
        new Set(Array.from(contests.values()).map((c) => c.advertiser_id).filter(Boolean)),
      ) as string[];
      if (advertiserIds.length > 0) {
        const { data: profiles } = await admin
          .from("advertiser_profiles")
          .select("id, company_name")
          .in("id", advertiserIds);
        for (const p of (profiles ?? []) as { id: string; company_name: string | null }[]) {
          if (p.company_name?.trim()) brands.set(p.id, p.company_name.trim());
        }
      }
    }

    const now = Date.now();
    const applications: MyApplicationListItem[] = rows.map((r) => {
      const c = contests.get(r.contest_id);
      const end = c?.end_date ? new Date(c.end_date).getTime() : NaN;
      return {
        id: r.id,
        contest_id: r.contest_id,
        status: r.status,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        on_access_list: onAccessList.has(r.contest_id),
        campaign: {
          title: c?.title ?? null,
          thumbnail_url: c?.thumbnail_url ?? null,
          start_date: c?.start_date ?? null,
          end_date: c?.end_date ?? null,
          brand_name: (c?.advertiser_id && brands.get(c.advertiser_id)) || null,
          has_ended: Number.isFinite(end) && end <= now,
          is_published: c?.moderation_status === "published",
        },
      };
    });

    return NextResponse.json({
      applications,
      total: listRes.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      counts,
    });
  } catch (err) {
    return campaignAccessErrorResponse(err);
  }
}

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import AdminDashboardClient from "./AdminDashboardClient";
import { getPoolBudgetCentsFromDetails } from "@/lib/contest-type";
import {
  getCachedAdminUserGrowth,
  getCachedAdminDashboardGraphData,
  fetchAdminSubmissions,
} from "@/lib/admin-dashboard-graph-cache";
import {
  addDaysToDateKey,
  formatGrowthDayLabel,
  formatGrowthWeekLabel,
  getGrowthDayKey,
  getGrowthMonthKey,
  getGrowthWeekKey,
  getGrowthYearKey,
} from "@/lib/admin-date-range";
import { createAdminClient } from "@/utils/supabase/admin";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  // Verify admin access
  const { isAdmin, error } = await verifyAdminAccess();

  if (!isAdmin) {
    console.log("Non-admin user attempted to access admin dashboard:", error);
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const resolvedSearch = await (searchParams ||
    Promise.resolve({} as Record<string, string | undefined>));
  const contestTypeFilter = (resolvedSearch?.["type"] as string) || "all";

  type CountGrowthPoint = { label: string; all: number };
  type CountGrowthPointWithDate = CountGrowthPoint & { date: string };

  function buildCountGrowth(records: { created_at: string }[]): {
    byDay: CountGrowthPoint[];
    byWeek: CountGrowthPoint[];
    byMonth: CountGrowthPoint[];
    byYear: CountGrowthPoint[];
    byDayFull: CountGrowthPointWithDate[];
  } {
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const byDayMap: Record<string, number> = {};
    const byWeekMap: Record<string, number> = {};
    const byMonthMap: Record<string, number> = {};
    const byYearMap: Record<string, number> = {};

    for (const record of records) {
      const d = new Date(record.created_at);
      if (d < twoYearsAgo) continue;

      const dayKey = getGrowthDayKey(d);
      const weekKey = getGrowthWeekKey(d);
      const monthKey = getGrowthMonthKey(d);
      const yearKey = getGrowthYearKey(d);

      byDayMap[dayKey] = (byDayMap[dayKey] || 0) + 1;
      byWeekMap[weekKey] = (byWeekMap[weekKey] || 0) + 1;
      byMonthMap[monthKey] = (byMonthMap[monthKey] || 0) + 1;
      byYearMap[yearKey] = (byYearMap[yearKey] || 0) + 1;
    }

    const toCountPoint = (
      key: string,
      m: Record<string, number>,
    ): CountGrowthPoint => ({
      label: key,
      all: m[key] || 0,
    });

    const byDay: CountGrowthPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      const key = getGrowthDayKey(d);
      const pt = toCountPoint(key, byDayMap);
      pt.label = formatGrowthDayLabel(key);
      byDay.push(pt);
    }

    const byWeek: CountGrowthPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i * 7);
      const key = getGrowthWeekKey(d);
      const pt = toCountPoint(key, byWeekMap);
      pt.label = formatGrowthWeekLabel(key);
      byWeek.push(pt);
    }

    const byMonth: CountGrowthPoint[] = [];
    const monthShort: string[] = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (let i = 11; i >= 0; i--) {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() - i;
      const year = y + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${monthShort[month]} '${String(year).slice(-2)}`;
      byMonth.push({
        ...toCountPoint(key, byMonthMap),
        label,
      });
    }

    const byYear: CountGrowthPoint[] = [];
    const yearStart = now.getUTCFullYear() - 4;
    for (let y = yearStart; y <= now.getUTCFullYear(); y++) {
      const key = String(y);
      byYear.push({
        label: key,
        all: byYearMap[key] || 0,
      });
    }

    const byDayFull: CountGrowthPointWithDate[] = [];
    let walkKey = getGrowthDayKey(twoYearsAgo);
    const endKey = getGrowthDayKey(now);
    while (walkKey <= endKey) {
      const pt = toCountPoint(walkKey, byDayMap);
      byDayFull.push({
        ...pt,
        date: walkKey,
        label: formatGrowthDayLabel(walkKey),
      });
      if (walkKey === endKey) break;
      walkKey = addDaysToDateKey(walkKey);
    }

    return { byDay, byWeek, byMonth, byYear, byDayFull };
  }

  try {
    const userGrowthPromise = getCachedAdminUserGrowth();
    const graphDataPromise =
      getCachedAdminDashboardGraphData(contestTypeFilter);
    const submissionsPromise = fetchAdminSubmissions();
    const adminSupabase = createAdminClient();

    // Fetch all contests in chunks to avoid 1000-row limit
    let allContests: any[] = [];
    const CHUNK_CONTEST = 1000;
    let contestRangeFrom = 0;
    while (true) {
      const { data: chunk, error: contestError } = await adminSupabase
        .from("contests_with_status")
        .select(
          "id, contest_type, contest_based_details, created_at, moderation_status, status, post_contest_status, payment_details",
        )
        .order("id", { ascending: true })
        .range(contestRangeFrom, contestRangeFrom + CHUNK_CONTEST - 1);
      
      if (contestError) {
        throw new Error(`Failed to fetch contests: ${contestError.message}`);
      }
      if (!chunk || chunk.length === 0) break;
      allContests = allContests.concat(chunk);
      if (chunk.length < CHUNK_CONTEST) break;
      contestRangeFrom += CHUNK_CONTEST;
    }

    // Fetch other platform-wide statistics for admin
    const [
      { count: totalUsersCount },
      { count: totalCreatorsCount },
      { count: totalBrandsCount },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "creator"),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "advertiser"),
    ]);

    // Fetch all submissions (uncached; aggregated graph data is cached separately)
    const allSubmissions = await submissionsPromise;

    // Apply optional contest type filter
    const contests = (allContests || []).filter((c: any) =>
      contestTypeFilter === "all" ? true : c.contest_type === contestTypeFilter,
    );

    // Calculate platform statistics and advanced metrics
    const totalContests = contests.length || 0;
    const totalPublishedContests =
      contests.filter((c: any) => c.moderation_status === "published").length ||
      0;
    const totalDraftContests =
      contests.filter((c: any) => c.moderation_status === "draft").length || 0;
    const totalPendingContests =
      contests.filter((c: any) => c.moderation_status === "pending_approval")
        .length || 0;
    const totalApprovedContests =
      contests.filter((c: any) => c.moderation_status === "approved").length ||
      0;
    const totalRejectedContests =
      contests.filter((c: any) => c.moderation_status === "rejected").length ||
      0;
    const totalActiveContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" && c.status === "active",
      ).length || 0;
    const totalUpcomingContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" && c.status === "upcoming",
      ).length || 0;
    // Completed contests are those ended AND payouts processed
    const totalCompletedContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status === "payouts_processed",
      ).length || 0;
    // Ended contests should EXCLUDE the ones that are completed
    const totalEndedContests =
      contests.filter(
        (c: any) =>
          c.moderation_status === "published" &&
          c.status === "ended" &&
          c.post_contest_status !== "payouts_processed",
      ).length || 0;

    const submissions = allSubmissions || [];
    const contestIdSet = new Set(contests.map((c: any) => c.id));
    const filteredSubmissions =
      contestTypeFilter === "all"
        ? submissions
        : submissions.filter((s: any) => contestIdSet.has(s.contest_id));

    const totalViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) => sum + (sub.views || 0),
        0,
      ) || 0;
    const totalVerifiedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "verified" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const totalPaidViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "paid" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const totalRejectedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "rejected" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const totalPendingViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum + (sub.status === "pending" ? sub.views || 0 : 0),
        0,
      ) || 0;
    const totalExpectedViews =
      filteredSubmissions.reduce(
        (sum: number, sub: any) =>
          sum +
          (sub.status === "pending" ||
          sub.status === "verified" ||
          sub.status === "paid"
            ? sub.views || 0
            : 0),
        0,
      ) || 0;

    const totalSubmissions = filteredSubmissions.length;
    const verifiedSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "verified",
    ).length;
    const pendingSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "pending",
    ).length;
    const rejectedSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "rejected",
    ).length;
    const paidSubmissions = filteredSubmissions.filter(
      (s: any) => s.status === "paid",
    ).length;
    const uniqueCreators = new Set(
      filteredSubmissions
        .map((s: any) => s.creator_id)
        .filter((id: string | null | undefined) => Boolean(id)),
    ).size;
    const totalUsers = totalUsersCount ?? 0;
    const totalCreators = totalCreatorsCount ?? 0;
    const totalBrands = totalBrandsCount ?? 0;

    const [userGrowth, graphData] = await Promise.all([
      userGrowthPromise,
      graphDataPromise,
    ]);
    const { submissionGrowth, viewsGrowth, submissionCreatorsByDay } = graphData;
    const contestGrowth = buildCountGrowth(contests);

    const parsePayment = (pd: any) => {
      if (!pd) return null as any;
      try {
        return typeof pd === "string" ? JSON.parse(pd) : pd;
      } catch {
        return pd;
      }
    };
    const totalMoneyPaidByPublished = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== "published") return sum;
      const pd = parsePayment(c.payment_details);
      if (
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const expectedMoneyPaidAll = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const moneyPaidUnpublished = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (
        c.moderation_status !== "published" &&
        pd?.payment_status === "completed" &&
        typeof pd.total_amount_paid === "number"
      ) {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const projectedMoneySpent = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      if (c.contest_type === "milestone") {
        return sum + getPoolBudgetCentsFromDetails("milestone", details);
      }
      if (c.contest_type === "dual_rewards") {
        return sum + getPoolBudgetCentsFromDetails("dual_rewards", details);
      }
      return sum;
    }, 0);

    // Budgets set on contests that are still in draft and not paid
    const totalMoneyInDraftNotPaid = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== "draft") return sum;
      const details = c?.contest_based_details || {};
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      if (c.contest_type === "milestone") {
        return sum + getPoolBudgetCentsFromDetails("milestone", details);
      }
      if (c.contest_type === "dual_rewards") {
        return sum + getPoolBudgetCentsFromDetails("dual_rewards", details);
      }
      return sum;
    }, 0);

    // Payment breakdown (expected payments only)
    const paymentsBreakdown = contests.reduce(
      (acc: any, c: any) => {
        const pd = parsePayment(c.payment_details);
        if (pd?.payment_status === "completed") {
          const withCommission =
            typeof pd.total_amount_paid === "number" ? pd.total_amount_paid : 0;
          const commission =
            typeof pd.commission_amount === "number" ? pd.commission_amount : 0;
          let withoutCommission = 0;
          if (typeof pd.total_prize_pool === "number") {
            withoutCommission = pd.total_prize_pool;
          } else if (withCommission >= commission) {
            withoutCommission = withCommission - commission;
          }
          acc.withCommission += withCommission;
          acc.withoutCommission += withoutCommission;
          acc.commission += commission;
        }
        return acc;
      },
      { withCommission: 0, withoutCommission: 0, commission: 0 },
    );

    // Projected breakdown (based on contest budgets + available commission info)
    const projectedCommission = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      let base = 0;
      if (
        c.contest_type === "leaderboard" &&
        details?.leaderboard_contest?.total_prize
      ) {
        base = details.leaderboard_contest.total_prize || 0;
      } else if (
        c.contest_type === "cpm" &&
        details?.cpm_contest?.total_budget
      ) {
        base = details.cpm_contest.total_budget || 0;
      } else if (c.contest_type === "milestone") {
        base = getPoolBudgetCentsFromDetails("milestone", details);
      } else if (c.contest_type === "dual_rewards") {
        base = getPoolBudgetCentsFromDetails("dual_rewards", details);
      }
      const pd = parsePayment(c.payment_details);
      if (pd) {
        if (typeof pd.commission_amount === "number") {
          return sum + pd.commission_amount;
        }
        if (typeof pd.commission_percentage === "number" && base > 0) {
          return sum + Math.round(base * (pd.commission_percentage / 100));
        }
      }
      return sum;
    }, 0);
    const projectedWithCommission = projectedMoneySpent + projectedCommission;

    return (
      <AdminDashboardClient
        totalContests={totalContests}
        totalPublishedContests={totalPublishedContests}
        totalDraftContests={totalDraftContests}
        totalPendingContests={totalPendingContests}
        totalApprovedContests={totalApprovedContests}
        totalRejectedContests={totalRejectedContests}
        totalActiveContests={totalActiveContests}
        totalUpcomingContests={totalUpcomingContests}
        totalCompletedContests={totalCompletedContests}
        totalEndedContests={totalEndedContests}
        totalViews={totalViews}
        totalVerifiedViews={totalVerifiedViews}
        totalPaidViews={totalPaidViews}
        totalRejectedViews={totalRejectedViews}
        totalPendingViews={totalPendingViews}
        totalExpectedViews={totalExpectedViews}
        totalSubmissions={totalSubmissions}
        verifiedSubmissions={verifiedSubmissions}
        pendingSubmissions={pendingSubmissions}
        rejectedSubmissions={rejectedSubmissions}
        paidSubmissions={paidSubmissions}
        uniqueCreators={uniqueCreators}
        totalUsers={totalUsers}
        totalCreators={totalCreators}
        totalBrands={totalBrands}
        totalMoneyPaidByPublished={totalMoneyPaidByPublished}
        moneyPaidUnpublished={moneyPaidUnpublished}
        expectedMoneyPaidAll={expectedMoneyPaidAll}
        paymentsBreakdown={paymentsBreakdown}
        projectedMoneySpent={projectedMoneySpent}
        projectedWithCommission={projectedWithCommission}
        totalMoneyInDraftNotPaid={totalMoneyInDraftNotPaid}
        contestTypeFilter={contestTypeFilter}
        userGrowth={userGrowth}
        submissionGrowth={submissionGrowth}
        viewsGrowth={viewsGrowth}
        contestGrowth={contestGrowth}
        submissionCreatorsByDay={submissionCreatorsByDay}
      />
    );
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error);
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Error loading admin dashboard</p>
      </div>
    );
  }
}

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { verifyAdminAccess } from "@/utils/admin-auth";
import AdminDashboardClient from "./AdminDashboardClient";

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

  type GrowthPoint = {
    label: string;
    all: number;
    creators: number;
    brands: number;
    admins: number;
  };
  type GrowthPointWithDate = GrowthPoint & { date: string };

  function getStartOfWeek(d: Date) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff);
  }

  function buildUserGrowth(
    users: { created_at: string; user_type: string }[],
  ): {
    byDay: GrowthPoint[];
    byWeek: GrowthPoint[];
    byMonth: GrowthPoint[];
    byYear: GrowthPoint[];
    byDayFull: GrowthPointWithDate[];
  } {
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const byDayMap: Record<
      string,
      { all: number; creators: number; brands: number; admins: number }
    > = {};
    const byWeekMap: Record<
      string,
      { all: number; creators: number; brands: number; admins: number }
    > = {};
    const byMonthMap: Record<
      string,
      { all: number; creators: number; brands: number; admins: number }
    > = {};
    const byYearMap: Record<
      string,
      { all: number; creators: number; brands: number; admins: number }
    > = {};

    for (const u of users) {
      const d = new Date(u.created_at);
      if (d < twoYearsAgo) continue;
      const isCreator = u.user_type === "creator";
      const isBrand = u.user_type === "advertiser";
      const isAdmin = u.user_type === "admin";

      const dayKey = d.toISOString().slice(0, 10);
      const weekStart = getStartOfWeek(d);
      const weekKey = weekStart.toISOString().slice(0, 10);
      const monthKey = d.toISOString().slice(0, 7);
      const yearKey = String(d.getFullYear());

      if (!byDayMap[dayKey])
        byDayMap[dayKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
      byDayMap[dayKey].all++;
      if (isCreator) byDayMap[dayKey].creators++;
      if (isBrand) byDayMap[dayKey].brands++;
      if (isAdmin) byDayMap[dayKey].admins++;

      if (!byWeekMap[weekKey])
        byWeekMap[weekKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
      byWeekMap[weekKey].all++;
      if (isCreator) byWeekMap[weekKey].creators++;
      if (isBrand) byWeekMap[weekKey].brands++;
      if (isAdmin) byWeekMap[weekKey].admins++;

      if (!byMonthMap[monthKey])
        byMonthMap[monthKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
      byMonthMap[monthKey].all++;
      if (isCreator) byMonthMap[monthKey].creators++;
      if (isBrand) byMonthMap[monthKey].brands++;
      if (isAdmin) byMonthMap[monthKey].admins++;

      if (!byYearMap[yearKey])
        byYearMap[yearKey] = { all: 0, creators: 0, brands: 0, admins: 0 };
      byYearMap[yearKey].all++;
      if (isCreator) byYearMap[yearKey].creators++;
      if (isBrand) byYearMap[yearKey].brands++;
      if (isAdmin) byYearMap[yearKey].admins++;
    }

    const toGrowthPoint = (
      key: string,
      m: Record<string, { all: number; creators: number; brands: number; admins: number }>,
    ): GrowthPoint => {
      const v = m[key] || { all: 0, creators: 0, brands: 0, admins: 0 };
      return { label: key, all: v.all, creators: v.creators, brands: v.brands, admins: v.admins };
    };

    const byDay: GrowthPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const pt = toGrowthPoint(key, byDayMap);
      pt.label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      byDay.push(pt);
    }

    const byWeek: GrowthPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekStart = getStartOfWeek(d);
      const key = weekStart.toISOString().slice(0, 10);
      const pt = toGrowthPoint(key, byWeekMap);
      pt.label = weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      byWeek.push(pt);
    }

    // Use UTC months so keys match aggregation (created_at is bucketed by UTC month).
    // Local-date iteration + toISOString() shifts keys in some timezones (e.g. Aug → "2024-07"), so August showed 0.
    const byMonth: GrowthPoint[] = [];
    const monthShort: string[] = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    for (let i = 11; i >= 0; i--) {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() - i;
      const year = y + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${monthShort[month]} '${String(year).slice(-2)}`;
      byMonth.push({
        ...toGrowthPoint(key, byMonthMap),
        label,
      });
    }

    const byYear: GrowthPoint[] = [];
    const yearStart = now.getFullYear() - 4;
    for (let y = yearStart; y <= now.getFullYear(); y++) {
      const key = String(y);
      const v = byYearMap[key] || { all: 0, creators: 0, brands: 0, admins: 0 };
      byYear.push({
        label: key,
        all: v.all,
        creators: v.creators,
        brands: v.brands,
        admins: v.admins,
      });
    }

    // Full daily series for date range filter (every UTC day from 2 years ago to now)
    const byDayFull: GrowthPointWithDate[] = [];
    const walk = new Date(twoYearsAgo);
    walk.setUTCHours(0, 0, 0, 0);
    const nowEnd = new Date(now);
    nowEnd.setUTCHours(23, 59, 59, 999);
    while (walk <= nowEnd) {
      const key = walk.toISOString().slice(0, 10);
      const pt = toGrowthPoint(key, byDayMap);
      byDayFull.push({
        ...pt,
        date: key,
        label: walk.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      });
      walk.setUTCDate(walk.getUTCDate() + 1);
    }

    return { byDay, byWeek, byMonth, byYear, byDayFull };
  }

  try {
    // Fetch all contests in chunks to avoid 1000-row limit
    let allContests: any[] = [];
    const CHUNK_CONTEST = 1000;
    let contestRangeFrom = 0;
    while (true) {
      const { data: chunk, error: contestError } = await supabase
        .from("contests_with_status")
        .select(
          "id, contest_type, contest_based_details, created_at, moderation_status, status, post_contest_status, payment_details",
        )
        .range(contestRangeFrom, contestRangeFrom + CHUNK_CONTEST - 1);
      
      if (contestError) {
        console.error("Error fetching contests chunk:", contestError);
        break;
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

    // Fetch all submissions in chunks to avoid 1000-row limit
    let allSubmissions: any[] = [];
    const CHUNK_SUB = 1000;
    let subRangeFrom = 0;
    while (true) {
      const { data: chunk, error: subError } = await supabase
        .from("submissions")
        .select("id, views, status, contest_id")
        .range(subRangeFrom, subRangeFrom + CHUNK_SUB - 1);
      
      if (subError) {
        console.error("Error fetching submissions chunk:", subError);
        break;
      }
      if (!chunk || chunk.length === 0) break;
      allSubmissions = allSubmissions.concat(chunk);
      if (chunk.length < CHUNK_SUB) break;
      subRangeFrom += CHUNK_SUB;
    }

    // Supabase returns max 1000 rows per request; fetch users for growth in chunks so graph shows all users (e.g. 1022+)
    const twoYearsAgoIso = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const CHUNK = 1000;
    let usersForGrowth: { created_at: string; user_type: string }[] = [];
    let rangeFrom = 0;
    while (true) {
      const { data: chunk, error } = await supabase
        .from("users")
        .select("created_at, user_type")
        .gte("created_at", twoYearsAgoIso)
        .order("created_at", { ascending: true })
        .range(rangeFrom, rangeFrom + CHUNK - 1);
      if (error) break;
      usersForGrowth = usersForGrowth.concat(chunk || []);
      if (!chunk || chunk.length < CHUNK) break;
      rangeFrom += CHUNK;
    }

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
    const totalUsers = totalUsersCount ?? 0;
    const totalCreators = totalCreatorsCount ?? 0;
    const totalBrands = totalBrandsCount ?? 0;

    const userGrowth = buildUserGrowth(usersForGrowth || []);

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

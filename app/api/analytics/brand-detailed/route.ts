import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contestTypeFilter = searchParams.get("type") || "all";

    // Get user type and verify advertiser access
    const { data: userData } = await supabase
      .from("users")
      .select("user_type")
      .eq("id", user.id)
      .single();

    if (userData?.user_type !== "advertiser") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Admin client to bypass RLS while still scoping strictly to this advertiser
    const supabaseAdmin = createAdminClient();

    // Fetch all contests for this brand
    const { data: allContests } = await supabaseAdmin
      .from("contests_with_status")
      .select(`
        id,
        advertiser_id,
        title,
        platform,
        contest_type,
        created_at,
        start_date,
        end_date,
        moderation_status,
        status,
        post_contest_status,
        payment_details,
        contest_based_details,
        live_submission_count
      `)
      .eq("advertiser_id", user.id)
      .order("created_at", { ascending: false });

    // Fetch all submissions for this brand's contests
    // Use an inner join on contests to ensure RLS permits access for the advertiser
    // (mirrors the pattern used in other analytics queries)
    // Use a flexible any[] type to accommodate join vs non-join fallbacks
    let allSubmissions: any[] = [];
    const { data: joinedSubs, error: joinErr } = await supabaseAdmin
      .from("submissions")
      .select(`
        id,
        views,
        likes,
        comments,
        shares,
        created_at,
        platform,
        creator_id,
        status,
        contest_id,
        contests!inner(advertiser_id)
      `)
      .eq("contests.advertiser_id", user.id);
    allSubmissions = (joinedSubs as any[]) || [];
    // swallow joinErr; the robust fallbacks will handle it

    // Fallback: if join returns no rows but contests exist, try explicit IN filter
    let subsSource: "join" | "fallback" = "join";
    if ((allSubmissions.length === 0) && (allContests?.length || 0) > 0) {
      const contestIds = (allContests || []).map((c: any) => c.id);
      // Chunk the IN query to avoid overly long IN lists
      const CHUNK_SIZE = 200;
      const chunks: string[][] = [];
      for (let i = 0; i < contestIds.length; i += CHUNK_SIZE) {
        chunks.push(contestIds.slice(i, i + CHUNK_SIZE));
      }

      const aggregated: any[] = [];
      for (const ids of chunks) {
        const { data: subsFallback } = await supabaseAdmin
          .from('submissions')
          .select(`
            id,
            views,
            likes,
            comments,
            shares,
            created_at,
            platform,
            creator_id,
            status,
            contest_id
          `)
          .in('contest_id', ids)
          .order('created_at', { ascending: false });
        if (subsFallback && subsFallback.length > 0) {
          aggregated.push(...subsFallback);
        }
      }

      allSubmissions = aggregated;
      subsSource = 'fallback';
    }

    // Last-resort fetch: per-contest queries if IN returned 0 but counts say > 0
    // We'll build per-contest fallback after we have computed `contests` below
    let perContestFetched: Record<string, number> = {};
    const performPerContestFallback = async (contestsInput: any[]) => {
      const contestsWithCounts = (contestsInput || []).filter((c: any) => (c && c.id));
      const perContestFetched: Record<string, number> = {};
      // Cap per-contest fallback to avoid unbounded loops
      const MAX_PER_CONTEST_FALLBACK = 50;
      const limited = contestsWithCounts.slice(0, MAX_PER_CONTEST_FALLBACK);
      for (const c of limited) {
        try {
          const { data: subsByContest, error: perErr } = await supabaseAdmin
            .from('submissions')
            .select('id,status,views,contest_id,created_at,platform,creator_id')
            .eq('contest_id', c.id)
            .order('created_at', { ascending: false });
          if (!perErr && subsByContest && subsByContest.length > 0) {
            allSubmissions.push(...subsByContest as any[]);
            perContestFetched[c.id as string] = subsByContest.length;
          } else if (perErr) {
            // swallow
          }
        } catch {}
      }
      // no logs in production
      return perContestFetched;
    };

    // Apply contest type filter
    const contests = (allContests || []).filter((c: any) =>
      contestTypeFilter === "all" ? true : c.contest_type === contestTypeFilter
    );

    // If still no rows but counts indicate presence, do per-contest fallback now
    if (allSubmissions.length === 0 && (contests?.length || 0) > 0) {
      perContestFetched = await performPerContestFallback(contests as any[]);
    }

    // Attach submissions to contests
    const contestsWithSubmissions = contests.map(contest => ({
      ...contest,
      submissions: allSubmissions?.filter(sub => sub.contest_id === contest.id) || []
    }));

    // Calculate comprehensive metrics
    const totalContests = contests.length;
    const totalDraftContests = contests.filter((c: any) => c.moderation_status === 'draft').length;
    const totalPendingContests = contests.filter((c: any) => c.moderation_status === 'pending_approval').length;
    const totalApprovedContests = contests.filter((c: any) => c.moderation_status === 'approved').length;
    const totalPublishedContests = contests.filter((c: any) => c.moderation_status === 'published').length;
    const totalRejectedContests = contests.filter((c: any) => c.moderation_status === 'rejected').length;
    const totalActiveContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'active').length;
    const totalUpcomingContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'upcoming').length;
    const totalEndedContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended' && c.post_contest_status !== 'payouts_processed').length;
    const totalCompletedContests = contests.filter((c: any) => c.moderation_status === 'published' && c.status === 'ended' && c.post_contest_status === 'payouts_processed').length;

    // Submission metrics
    const totalSubmissions = allSubmissions?.length || 0;
    const verifiedSubmissions = allSubmissions?.filter((s: any) => s.status === 'verified').length || 0;
    const paidSubmissions = allSubmissions?.filter((s: any) => s.status === 'paid').length || 0;
    const pendingSubmissions = allSubmissions?.filter((s: any) => s.status === 'pending').length || 0;
    const rejectedSubmissions = allSubmissions?.filter((s: any) => s.status === 'rejected').length || 0;

    // View metrics
    const totalViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
    const totalVerifiedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'verified' ? (sub.views || 0) : 0), 0) || 0;
    const totalPaidViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'paid' ? (sub.views || 0) : 0), 0) || 0;
    const totalPendingViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'pending' ? (sub.views || 0) : 0), 0) || 0;
    const totalRejectedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.status === 'rejected' ? (sub.views || 0) : 0), 0) || 0;
    const totalExpectedViews = allSubmissions?.reduce((sum: number, sub: any) => sum + ((sub.status === 'pending' || sub.status === 'verified' || sub.status === 'paid') ? (sub.views || 0) : 0), 0) || 0;

    // Engagement metrics
    const totalLikes = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.likes || 0), 0) || 0;
    const totalComments = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.comments || 0), 0) || 0;
    const totalShares = allSubmissions?.reduce((sum: number, sub: any) => sum + (sub.shares || 0), 0) || 0;

    // Financial metrics
    const parsePayment = (pd: any) => {
      if (!pd) return null;
      try { return typeof pd === 'string' ? JSON.parse(pd) : pd; } catch { return pd; }
    };

    const totalMoneyPaid = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const totalProjectedSpent = contests.reduce((sum: number, c: any) => {
      const details = c?.contest_based_details || {};
      if (c.contest_type === 'leaderboard' && details?.leaderboard_contest?.total_prize) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === 'cpm' && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      return sum;
    }, 0);

    const moneyPaidUnpublished = contests.reduce((sum: number, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (c.moderation_status !== 'published' && pd?.payment_status === 'completed' && typeof pd.total_amount_paid === 'number') {
        return sum + pd.total_amount_paid;
      }
      return sum;
    }, 0);

    const moneyInDraftNotPaid = contests.reduce((sum: number, c: any) => {
      if (c.moderation_status !== 'draft') return sum;
      const details = c?.contest_based_details || {};
      if (c.contest_type === 'leaderboard' && details?.leaderboard_contest?.total_prize) {
        return sum + (details.leaderboard_contest.total_prize || 0);
      }
      if (c.contest_type === 'cpm' && details?.cpm_contest?.total_budget) {
        return sum + (details.cpm_contest.total_budget || 0);
      }
      return sum;
    }, 0);

    // Payment breakdown
    const paymentsBreakdown = contests.reduce((acc: any, c: any) => {
      const pd = parsePayment(c.payment_details);
      if (pd?.payment_status === 'completed') {
        const withCommission = typeof pd.total_amount_paid === 'number' ? pd.total_amount_paid : 0;
        const commission = typeof pd.commission_amount === 'number' ? pd.commission_amount : 0;
        let withoutCommission = 0;
        if (typeof pd.total_prize_pool === 'number') {
          withoutCommission = pd.total_prize_pool;
        } else if (withCommission >= commission) {
          withoutCommission = withCommission - commission;
        }
        acc.withCommission += withCommission;
        acc.withoutCommission += withoutCommission;
        acc.commission += commission;
      }
      return acc;
    }, { withCommission: 0, withoutCommission: 0, commission: 0 });

    // Calculate performance metrics
    const avgCostPerView = totalViews > 0 ? totalMoneyPaid / totalViews : 0;
    const avgCostPerSubmission = totalSubmissions > 0 ? totalMoneyPaid / totalSubmissions : 0;
    const avgViewsPerSubmission = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;
    const avgSubmissionsPerContest = totalContests > 0 ? totalSubmissions / totalContests : 0;
    const engagementRate = totalViews > 0 ? ((totalLikes + totalComments + totalShares) / totalViews) * 100 : 0;

    // Platform breakdown
    const platformStats = contestsWithSubmissions.reduce((acc: any, contest) => {
      const platform = contest.platform || "unknown";
      if (!acc[platform]) {
        acc[platform] = {
          contests: 0,
          submissions: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          spent: 0
        };
      }
      
      if (contest.submissions.length > 0) {
        acc[platform].contests++;
        acc[platform].submissions += contest.submissions.length;
        acc[platform].views += contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
        acc[platform].likes += contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.likes || 0), 0) || 0;
        acc[platform].comments += contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.comments || 0), 0) || 0;
        acc[platform].shares += contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.shares || 0), 0) || 0;
        
        const details = contest.contest_based_details;
        let contestSpent = 0;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          contestSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          contestSpent = details.cpm_contest.total_budget;
        }
        acc[platform].spent += contestSpent;
      }
      
      return acc;
    }, {});

    // Contest type breakdown
    const contestTypeStats = contestsWithSubmissions.reduce((acc: any, contest) => {
      const type = contest.contest_type || "unknown";
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          submissions: 0,
          views: 0,
          spent: 0
        };
      }
      
      if (contest.submissions.length > 0) {
        acc[type].count++;
        acc[type].submissions += contest.submissions.length;
        acc[type].views += contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
        
        const details = contest.contest_based_details;
        let contestSpent = 0;
        if (contest.contest_type === "leaderboard" && details?.leaderboard_contest?.total_prize) {
          contestSpent = details.leaderboard_contest.total_prize;
        } else if (contest.contest_type === "cpm" && details?.cpm_contest?.total_budget) {
          contestSpent = details.cpm_contest.total_budget;
        }
        acc[type].spent += contestSpent;
      }
      
      return acc;
    }, {});

    // Find top performing contest
    const topContest = contestsWithSubmissions.reduce((top: any, contest) => {
      const contestViews = contest.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
      const topViews = top?.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0;
      return contestViews > topViews ? contest : top;
    }, contestsWithSubmissions[0] || null);

    // Recent contests (last 5) - include submissions for counts
    const recentContests = contestsWithSubmissions.slice(0, 5);

    const response: any = {
      overview: {
        totalContests,
        totalDraftContests,
        totalPendingContests,
        totalApprovedContests,
        totalPublishedContests,
        totalRejectedContests,
        totalActiveContests,
        totalUpcomingContests,
        totalEndedContests,
        totalCompletedContests,
        totalSubmissions,
        verifiedSubmissions,
        paidSubmissions,
        pendingSubmissions,
        rejectedSubmissions,
        totalViews,
        totalVerifiedViews,
        totalPaidViews,
        totalPendingViews,
        totalRejectedViews,
        totalExpectedViews,
        totalLikes,
        totalComments,
        totalShares,
        totalMoneyPaid,
        totalProjectedSpent,
        moneyPaidUnpublished,
        moneyInDraftNotPaid,
        paymentsBreakdown,
        avgCostPerView: Math.round(avgCostPerView * 100) / 100,
        avgCostPerSubmission: Math.round(avgCostPerSubmission * 100) / 100,
        avgViewsPerSubmission: Math.round(avgViewsPerSubmission * 100) / 100,
        avgSubmissionsPerContest: Math.round(avgSubmissionsPerContest * 100) / 100,
        engagementRate: Math.round(engagementRate * 100) / 100,
        topContest: topContest ? {
          id: topContest.id,
          title: topContest.title,
          views: topContest.submissions?.reduce((sum: number, sub: any) => sum + (sub.views || 0), 0) || 0,
          submissions: topContest.submissions?.length || 0,
          platform: topContest.platform,
          contest_type: topContest.contest_type
        } : null
      },
      platformStats,
      contestTypeStats,
      recentContests: recentContests.map(contest => ({
        id: contest.id,
        title: contest.title,
        platform: contest.platform,
        contest_type: contest.contest_type,
        moderation_status: contest.moderation_status,
        status: contest.status,
        created_at: contest.created_at,
        submission_count: contest.submissions?.length || 0
      }))
    };

    // no debug payload/logging in production

    return NextResponse.json(response);
  } catch (error) {
    console.error("Brand detailed analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';

// 🎯 Types
interface InstagramAccount {
  access_token: string;
  token_expiry: string;
  app_scoped_user_id: string;
  account_type?: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
}

interface Submission {
  id: string;
  creator_id: string;
  video_id: string;
  views: number | null;
  other_stats: any | null;
}

interface Creator {
  id: string;
  instagram_account: InstagramAccount;
}

interface InsightsData {
  data: Array<{
    name: string;
    values: Array<{ value: number }>;
  }>;
}

interface SubmissionUpdate {
  id: string;
  views: number;
  other_stats: any;
  updated_at: string;
}

interface TokenUpdate {
  userId: string;
  newAccountData: InstagramAccount;
}

// 🔧 Constants
const TOKEN_REFRESH_THRESHOLD_DAYS = 10;
const METRICS = 'reach,likes,comments,shares,saved,total_interactions,views';
const DEFAULT_STATS = { reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, total_interactions: 0, views: 0 };

// 🛠️ Utilities
const isTokenExpiring = (tokenExpiry: string): boolean =>
  dayjs(tokenExpiry).isBefore(dayjs().add(TOKEN_REFRESH_THRESHOLD_DAYS, 'day'));

const hasStatsChanged = (oldViews: number | null, newViews: number, oldStats: any, newStats: Record<string, number>): boolean => {
  if (oldViews !== newViews) return true;
  if (!oldStats?.instagram) return Object.keys(newStats).length > 0;
  return Object.keys(newStats).some(key => oldStats.instagram[key] !== newStats[key]);
};

// 🔄 Refresh Instagram token
async function refreshToken(creatorId: string, accessToken: string): Promise<string | null> {
  try {
    const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`;
    const response = await fetch(refreshUrl);
    const data = await response.json();

    if (!response.ok || data.error) {
      console.error(`Token refresh failed for creator ${creatorId}:`, data.error);
      return null;
    }

    return data.access_token;
  } catch (error: any) {
    console.error(`Token refresh exception for creator ${creatorId}:`, error.message);
    return null;
  }
}

// 📊 Fetch insights for a submission
async function fetchInsights(submission: Submission, accessToken: string): Promise<{ views: number; stats: Record<string, number> } | null> {
  try {
    const url = `https://graph.instagram.com/${submission.video_id}/insights?metric=${METRICS}&access_token=${accessToken}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`Insights fetch failed for submission ${submission.id}:`, error);
      return null;
    }

    const data: InsightsData = await response.json();
    if (!data.data?.length) return null;

    const stats = { ...DEFAULT_STATS };
    let primaryViews = 0;

    data.data.forEach(metric => {
      const value = metric.values[0]?.value || 0;
      (stats as any)[metric.name] = value;
      if (metric.name === 'views') primaryViews = value;
    });

    // Fallback to reach if views is 0
    if (primaryViews === 0 && stats.reach > 0) {
      primaryViews = stats.reach;
    }

    return { views: primaryViews, stats };
  } catch (error: any) {
    console.error(`Error fetching insights for submission ${submission.id}:`, error.message);
    return null;
  }
}

// 💰 Update CPM contest budgets
async function updateCpmContestBudgets(supabaseAdmin: any, contestId?: string): Promise<void> {
  try {
    let query = supabaseAdmin
      .from('contests')
      .select('id, contest_based_details')
      .eq('contest_type', 'cpm')
      .not('contest_based_details', 'is', null);

    if (contestId) query = query.eq('id', contestId);

    const { data: contests, error } = await query;
    if (error || !contests?.length) return;

    for (const contest of contests) {
      const cpmConfig = contest.contest_based_details?.cpm_contest;
      if (!cpmConfig?.cpm_rate_usd) continue;

      const { data: submissions } = await supabaseAdmin
        .from('submissions')
        .select('views')
        .eq('contest_id', contest.id)
        .eq('status', 'verified');

      if (!submissions?.length) continue;

      const totalSpent = submissions.reduce((sum: number, sub: any) => {
        let views = sub.views || 0;
        if (cpmConfig.min_views && views < cpmConfig.min_views) views = 0;
        if (cpmConfig.max_views && views > cpmConfig.max_views) views = cpmConfig.max_views;
        return sum + (views * cpmConfig.cpm_rate_usd) / 1000;
      }, 0);

      const now = new Date().toISOString();
      await supabaseAdmin
        .from('contests')
        .update({
          contest_based_details: {
            ...contest.contest_based_details,
            cpm_contest: { ...cpmConfig, budget_spent: Math.round(totalSpent * 100) }
          },
          last_metrics_updated: now,
          updated_at: now
        })
        .eq('id', contest.id);
    }
  } catch (error: any) {
    console.error('CPM budget update failed:', error.message);
  }
}

// 🚀 Main handler - Now optimized, readable, and efficient!
export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const url = new URL(request.url);
    const contestId = url.searchParams.get('contestId');
    
    console.log(`🚀 Starting Instagram insights update${contestId ? ` for contest ${contestId}` : ''}`);

    // 📥 Fetch submissions (only what we need)
    let submissionsQuery = supabaseAdmin
      .from('submissions')
      .select('id, creator_id, video_id, views, other_stats')
      .eq('platform', 'instagram')
      .not('video_id', 'is', null);

    if (contestId) submissionsQuery = submissionsQuery.eq('contest_id', contestId);

    const { data: submissions, error: submissionError } = await submissionsQuery;

    if (submissionError) {
      throw new Error(`Failed to fetch submissions: ${submissionError.message}`);
    }

    if (!submissions?.length) {
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({ 
        message: `No submissions to update${contestId ? ` for contest ${contestId}` : ''}, budget tracking completed` 
      });
    }

    console.log(`📊 Processing ${submissions.length} submissions`);

    // 👥 Group by creator (more efficient than loops)
    const submissionsByCreator = submissions.reduce((acc, sub) => {
      if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
      acc[sub.creator_id].push(sub);
      return acc;
    }, {} as Record<string, Submission[]>);

    const creatorIds = Object.keys(submissionsByCreator);

    // 🔍 Fetch creator profiles (only Instagram account data - no unnecessary fields!)
    const { data: creators, error: profilesError } = await supabaseAdmin
      .from('creator_profiles')
      .select('id, instagram_account')
      .in('id', creatorIds)
      .not('instagram_account', 'is', null);

    if (profilesError) {
      throw new Error(`Failed to fetch creator profiles: ${profilesError.message}`);
    }

    if (!creators?.length) {
      await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);
      return NextResponse.json({ 
        message: 'No connected Instagram accounts found, budget tracking completed' 
      });
    }

    // 🔄 Process insights efficiently
    const updates: SubmissionUpdate[] = [];
    const tokenUpdates: TokenUpdate[] = [];
    
    for (const creator of creators as Creator[]) {
      const account = creator.instagram_account;
      const userSubmissions = submissionsByCreator[creator.id];

      // Skip invalid accounts
      if (!account?.access_token || 
          (account.account_type !== 'BUSINESS' && account.account_type !== 'MEDIA_CREATOR')) {
        continue;
      }

      let accessToken = account.access_token;

      // 🔄 Refresh token if needed
      if (account.token_expiry && isTokenExpiring(account.token_expiry)) {
        const newToken = await refreshToken(creator.id, accessToken);
        if (!newToken) continue;
        
        accessToken = newToken;
        tokenUpdates.push({
          userId: creator.id,
          newAccountData: {
            ...account,
            access_token: newToken,
            token_expiry: dayjs().add(3600, 'second').toISOString()
          }
        });
      }

      // 📊 Process submissions for this creator
      for (const submission of userSubmissions) {
        if (!submission.video_id) continue;

        const result = await fetchInsights(submission, accessToken);
        if (!result) continue;

        const { views, stats } = result;
        
        if (hasStatsChanged(submission.views, views, submission.other_stats, stats)) {
          updates.push({
            id: submission.id,
            views,
            other_stats: { ...submission.other_stats, instagram: stats },
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    // 💾 Batch database updates (much more efficient!)
    const now = new Date().toISOString();
    
    if (tokenUpdates.length > 0) {
      console.log(`🔄 Updating ${tokenUpdates.length} tokens`);
      await Promise.allSettled(
        tokenUpdates.map(update =>
          supabaseAdmin
            .from('creator_profiles')
            .update({ 
              instagram_account: update.newAccountData,
              updated_at: now 
            })
            .eq('id', update.userId)
        )
      );
    }

    if (updates.length > 0) {
      console.log(`📊 Updating ${updates.length} submissions`);
      await Promise.allSettled(
        updates.map(update =>
          supabaseAdmin
            .from('submissions')
            .update({
              views: update.views,
              other_stats: update.other_stats,
              last_insights_update: now,
              updated_at: update.updated_at
            })
            .eq('id', update.id)
        )
      );
    }

    await updateCpmContestBudgets(supabaseAdmin, contestId || undefined);

    console.log(`✅ Instagram insights update completed. Updated ${updates.length} submissions`);
    return NextResponse.json({ 
      message: `Updated ${updates.length} Instagram submissions${contestId ? ` for contest ${contestId}` : ''} and CPM budgets` 
    });

  } catch (error: any) {
    console.error('❌ Instagram insights update failed:', error.message);
    return NextResponse.json({ error: `Cron job failed: ${error.message}` }, { status: 500 });
  }
}

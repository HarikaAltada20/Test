import { NextResponse } from 'next/server';
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { refreshAccessToken, extractYoutubeId } from '@/lib/youtube-api';

// Type definition for the youtube_account JSON object
type YouTubeAccount = {
    access_token: string;
    refresh_token: string;
    expires_at: string; // ISO String timestamp
    // Include other fields if they exist, though not strictly needed here
};

type SubmissionUpdate = {
    id: string;
    views: number;
    newOtherStats: any;
};

type TokenUpdate = {
    userId: string;
    newAccountData: YouTubeAccount;
};

// Helper function to chunk array
const chunkArray = <T>(array: T[], size: number): T[][] => 
    Array.from({ length: Math.ceil(array.length / size) }, (_, i) => 
        array.slice(i * size, i * size + size)
    );

const isTokenExpired = (expiresAt: string): boolean => 
    new Date(expiresAt) <= new Date();

// Function to update budget spent for CPM contests
async function updateCpmContestBudgets(supabaseAdmin: any, contestId?: string): Promise<void> {
    try {
        let contestsQuery = supabaseAdmin
            .from('contests')
            .select('id, contest_based_details')
            .eq('contest_type', 'cpm')
            .not('contest_based_details', 'is', null);

        // If contest-specific, filter by contest ID
        if (contestId) {
            contestsQuery = contestsQuery.eq('id', contestId);
        }

        const { data: contests, error } = await contestsQuery;

        if (error || !contests?.length) {
            console.log('No CPM contests to update');
            return;
        }

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
    } catch (error) {
        console.error('CPM budget update failed:', error);
    }
}

// Refresh YouTube token if needed
async function handleTokenRefresh(
    creator: any, 
    tokenUpdates: TokenUpdate[]
): Promise<string | null> {
    const account = creator.youtube_account as YouTubeAccount;
    if (!account?.refresh_token || !isTokenExpired(account.expires_at)) {
        return account.access_token;
    }

    try {
        const newTokens = await refreshAccessToken(account.refresh_token);
        const newAccountData = {
            ...account,
            access_token: newTokens.access_token,
            expires_at: newTokens.expires_at,
            refresh_token: newTokens.refresh_token || account.refresh_token
        };
        
        tokenUpdates.push({ userId: creator.id, newAccountData });
        return newTokens.access_token;
    } catch (error) {
        console.error(`Token refresh failed for creator ${creator.id}:`, error);
        return null;
    }
}

// Fetch and process YouTube stats
async function fetchYouTubeStats(
    creator: any,
    videoIds: string[],
    accessToken: string,
    submissionsByCreator: any
): Promise<SubmissionUpdate[]> {
    const updates: SubmissionUpdate[] = [];
    const youtube = google.youtube('v3');
    const chunks = chunkArray(videoIds, 50);

    for (const chunk of chunks) {
        try {
            const response = await youtube.videos.list({
                part: ['statistics'],
                id: chunk,
                access_token: accessToken,
            });

            const videoStats = response.data.items || [];
            
            for (const video of videoStats) {
                const stats = video.statistics!;
                const youtubeMetrics = {
                    views: parseInt(stats.viewCount || '0', 10),
                    likes: parseInt(stats.likeCount || '0', 10),
                    comments: parseInt(stats.commentCount || '0', 10),
                };

                const matchingSubmissions = submissionsByCreator[creator.id]
                    .filter((s: any) => s.video_id === video.id);
                
                matchingSubmissions.forEach((sub: any) => {
                    updates.push({
                        id: sub.id,
                        views: youtubeMetrics.views,
                        newOtherStats: { youtube: youtubeMetrics }
                    });
                });
            }
        } catch (error: any) {
            console.error(`YouTube API error for creator ${creator.id}:`, error.message);
            if (error.code === 401 || error.code === 403) break;
        }
    }

    return updates;
}

// Batch update database records
async function batchUpdateDatabase(
    supabaseAdmin: any,
    updates: SubmissionUpdate[],
    tokenUpdates: TokenUpdate[]
): Promise<void> {
    const now = new Date().toISOString();
    
    // Update submissions
    const updatePromises = updates.map(update =>
        supabaseAdmin
            .from('submissions')
            .update({
                views: update.views,
                other_stats: update.newOtherStats,
                last_insights_update: now,
                updated_at: now
            })
            .eq('id', update.id)
    );

    // Update tokens
    const tokenPromises = tokenUpdates.map(tokenUpdate =>
        supabaseAdmin
            .from('creator_profiles')
            .update({ 
                youtube_account: tokenUpdate.newAccountData, 
                updated_at: now 
            })
            .eq('id', tokenUpdate.userId)
    );

    try {
        await Promise.allSettled([...updatePromises, ...tokenPromises]);
    } catch (error) {
        console.error('Batch update failed:', error);
    }
}

export async function GET(request: Request) {
    // Verify CRON secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Check if this is a contest-specific refresh
        const url = new URL(request.url);
        const contestId = url.searchParams.get('contestId');
        const isContestSpecific = !!contestId;

        // Fetch submissions to update
        let submissionsQuery = supabaseAdmin
            .from('submissions')
            .select('id, creator_id, content_link, views, contest_id')
            .in('status', ['verified', 'pending'])
            .not('content_link', 'is', null);

        // If contest-specific, filter by contest_id
        if (isContestSpecific) {
            submissionsQuery = submissionsQuery.eq('contest_id', contestId);
            console.log(`Contest-specific YouTube metrics update for contest: ${contestId}`);
        }

        const { data: submissions, error: submissionError } = await submissionsQuery;

        if (submissionError) throw new Error(`Submission fetch failed: ${submissionError.message}`);
        if (!submissions?.length) {
            await updateCpmContestBudgets(supabaseAdmin, isContestSpecific ? contestId : undefined);
            return NextResponse.json({ 
                message: `No submissions to update${isContestSpecific ? ` for contest ${contestId}` : ''}, budget tracking completed` 
            });
        }

        // Group submissions by creator
        const submissionsByCreator = submissions.reduce((acc, sub) => {
            const videoId = extractYoutubeId(sub.content_link);
            if (videoId) {
                if (!acc[sub.creator_id]) acc[sub.creator_id] = [];
                acc[sub.creator_id].push({ ...sub, video_id: videoId });
            }
            return acc;
        }, {} as Record<string, any[]>);

        const creatorIds = Object.keys(submissionsByCreator);
        if (!creatorIds.length) {
            await updateCpmContestBudgets(supabaseAdmin);
            return NextResponse.json({ message: 'No valid video IDs found' });
        }

        // Fetch creators with YouTube accounts
        const { data: creators, error: creatorsError } = await supabaseAdmin
            .from('creator_profiles')
            .select('id, youtube_account')
            .in('id', creatorIds)
            .not('youtube_account', 'is', null);

        if (creatorsError) throw new Error(`Creator fetch failed: ${creatorsError.message}`);
        if (!creators?.length) {
            await updateCpmContestBudgets(supabaseAdmin);
            return NextResponse.json({ message: 'No connected YouTube accounts found' });
        }

        // Process each creator
        const allUpdates: SubmissionUpdate[] = [];
        const tokenUpdates: TokenUpdate[] = [];

        for (const creator of creators) {
            const accessToken = await handleTokenRefresh(creator, tokenUpdates);
            if (!accessToken) continue;

            const videoIds = submissionsByCreator[creator.id].map(s => s.video_id);
            const updates = await fetchYouTubeStats(creator, videoIds, accessToken, submissionsByCreator);
            allUpdates.push(...updates);
        }

        // Batch update database
        await batchUpdateDatabase(supabaseAdmin, allUpdates, tokenUpdates);
        
        // Update CPM contest budgets
        await updateCpmContestBudgets(supabaseAdmin, isContestSpecific ? contestId : undefined);

        return NextResponse.json({ 
            message: `Updated ${allUpdates.length} submissions${isContestSpecific ? ` for contest ${contestId}` : ''} and CPM contest budgets` 
        });

    } catch (error: any) {
        console.error('CRON job failed:', error);
        return NextResponse.json({ error: `Cron job failed: ${error.message}` }, { status: 500 });
    }
} 
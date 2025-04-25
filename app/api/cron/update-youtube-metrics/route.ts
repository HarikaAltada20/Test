import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { createOAuthClient, refreshAccessToken, extractYoutubeId } from '@/lib/youtube-api';
import { Database } from '@/types/supabase'; // Assuming you have types generated

// Type definition for the youtube_account JSON object
type YouTubeAccount = {
    access_token: string;
    refresh_token: string;
    expires_at: string; // ISO String timestamp
    // Include other fields if they exist, though not strictly needed here
};

// Helper function to chunk array
function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export async function GET(request: Request) {
    // 1. Verify Cron Secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('CRON Job: Invalid or missing CRON_SECRET');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('CRON Job: Starting YouTube metrics update...');

    // 2. Initialize Supabase Admin Client
    const supabaseAdmin = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // 3. Fetch active contests (optional: filter if needed)
        // For now, fetch all non-draft/incomplete submissions
        // In production, you might want to filter by contest status or end_date
        const { data: submissions, error: submissionError } = await supabaseAdmin
            .from('submissions')
            .select('id, creator_id, content_link, views') // Select necessary fields
            .in('status', ['approved', 'pending', 'completed']) // Example: Only update active/pending/completed
            .not('content_link', 'is', null); 

        if (submissionError) {
            console.error('CRON Job: Error fetching submissions:', submissionError);
            throw new Error(`Database error fetching submissions: ${submissionError.message}`);
        }

        if (!submissions || submissions.length === 0) {
            console.log('CRON Job: No relevant submissions found to update.');
            return NextResponse.json({ message: 'No submissions to update' }, { status: 200 });
        }

        console.log(`CRON Job: Found ${submissions.length} submissions to potentially update.`);

        // 4. Group submissions by creator_id
        const submissionsByCreator = submissions.reduce((acc, sub) => {
            if (!acc[sub.creator_id]) {
                acc[sub.creator_id] = [];
            }
            // Add video_id extracted from content_link
            const videoId = sub.content_link ? extractYoutubeId(sub.content_link) : null;
            if (videoId) {
                 acc[sub.creator_id].push({ ...sub, video_id: videoId });
            }
            return acc;
        }, {} as { [key: string]: (typeof submissions[0] & { video_id: string })[] });

        const creatorIds = Object.keys(submissionsByCreator);
        console.log(`CRON Job: Processing updates for ${creatorIds.length} unique creators.`);

        // 5. Fetch creator profiles (users table)
        const { data: creatorsData, error: usersError } = await supabaseAdmin
            .from('creator_profiles')
            .select('id, youtube_account') // Assuming youtube_account JSONB is here
            .in('id', creatorIds)
            .not('youtube_account', 'is', null); // Only fetch users with connected accounts

        if (usersError) {
            console.error('CRON Job: Error fetching creator profiles:', usersError);
            // Decide if this is fatal or just log and skip these users
            throw new Error(`Database error fetching users: ${usersError.message}`);
        }

        if (!creatorsData || creatorsData.length === 0) {
            console.log('CRON Job: No users with connected YouTube accounts found for these submissions.');
            return NextResponse.json({ message: 'No connected YouTube accounts found' }, { status: 200 });
        }
        
        let updatedSubmissionsCount = 0;
        const updates: { id: string; views: number }[] = [];
        const tokenUpdates: { userId: string; newAccountData: YouTubeAccount }[] = [];

        // 6. Process each creator
        for (const creator of creatorsData) {
            let youtubeAccount = creator.youtube_account as YouTubeAccount | null;
            if (!youtubeAccount || !youtubeAccount.refresh_token) {
                console.warn(`CRON Job: Skipping creator ${creator.id} - missing youtube_account or refresh_token.`);
                continue;
            }

            let accessToken = youtubeAccount.access_token;
            const refreshToken = youtubeAccount.refresh_token;
            const expiresAt = youtubeAccount.expires_at;

            // 7. Check and refresh token if needed
            if (new Date(expiresAt) <= new Date()) {
                console.log(`CRON Job: Refreshing token for creator ${creator.id}...`);
                try {
                    const newTokens = await refreshAccessToken(refreshToken);
                    accessToken = newTokens.access_token;
                    // Prepare to update creator's record in DB
                    const newAccountData = { 
                        ...youtubeAccount, // Keep existing fields
                        access_token: newTokens.access_token,
                        expires_at: newTokens.expires_at,
                        // Preserve original refresh token if new one isn't provided
                        refresh_token: newTokens.refresh_token || refreshToken 
                    };
                    tokenUpdates.push({ userId: creator.id, newAccountData: newAccountData as YouTubeAccount });
                    console.log(`CRON Job: Token refreshed successfully for creator ${creator.id}.`);
                } catch (refreshError: any) {
                    console.error(`CRON Job: Failed to refresh token for creator ${creator.id}:`, refreshError.message);
                    // If refresh fails, we can't get stats for this creator, skip them
                    continue; 
                }
            }

            // 8. Get Video IDs for this creator
            const userSubmissions = submissionsByCreator[creator.id];
            const videoIds = userSubmissions.map(sub => sub.video_id).filter(Boolean);

            if (videoIds.length === 0) {
                continue; // No valid video IDs for this creator
            }

            // 9. Fetch YouTube video statistics in batches of 50
            const youtube = google.youtube('v3');
            const videoIdChunks = chunkArray(videoIds, 50); // YouTube API limit
            
            for (const chunk of videoIdChunks) {
                try {
                    console.log(`CRON Job: Fetching stats for ${chunk.length} videos for creator ${creator.id}...`);
                    const response = await youtube.videos.list({
                        part: ['statistics'],
                        id: chunk,
                        access_token: accessToken,
                    });

                    const videoStats = response.data.items || [];
                    
                    for (const video of videoStats) {
                        const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
                        // Find the corresponding submission(s) for this video ID
                        const matchingSubs = userSubmissions.filter(s => s.video_id === video.id);
                        for (const sub of matchingSubs) {
                            // Only add update if view count has changed
                            if (sub.views !== viewCount) {
                                updates.push({ id: sub.id, views: viewCount });
                                updatedSubmissionsCount++;
                            }
                        }
                    }
                } catch (ytError: any) {
                    console.error(`CRON Job: YouTube API error for creator ${creator.id} (videos: ${chunk.join(',')}):`, ytError.message);
                    // Decide how to handle: skip chunk, skip creator? For now, log and continue.
                    if (ytError.code === 401 || ytError.code === 403) {
                         console.error(`CRON Job: Potential invalid/expired token for creator ${creator.id} even after check/refresh. Skipping creator.`);
                         // Break inner loop to stop processing this creator if token is bad
                         break; 
                    }
                }
            }
        }

        // 10. Perform Batch Updates if possible, or individual updates
        if (updates.length > 0) {
            console.log(`CRON Job: Updating view counts for ${updates.length} submissions...`);
            // Supabase doesn't directly support multi-row updates based on different values easily via JS client
            // Option 1: Loop through updates (simpler, less efficient for large numbers)
            let updateErrors = 0;
            for (const update of updates) {
                 const { error: updateError } = await supabaseAdmin
                    .from('submissions')
                    .update({ views: update.views, updated_at: new Date().toISOString() }) // Also update timestamp
                    .eq('id', update.id);
                if (updateError) {
                    console.error(`CRON Job: Failed to update submission ${update.id}:`, updateError.message);
                    updateErrors++;
                }
            }
             console.log(`CRON Job: Database updates attempted. Errors: ${updateErrors}`);
            // Option 2: Create a DB function for bulk updates (more complex setup)
            // const { error: rpcError } = await supabaseAdmin.rpc('bulk_update_submission_views', { updates });
        }

        // 11. Update creator Tokens
         if (tokenUpdates.length > 0) {
            console.log(`CRON Job: Updating ${tokenUpdates.length} creator YouTube tokens...`);
            let tokenUpdateErrors = 0;
            for (const tokenUpdate of tokenUpdates) {
                const { error: tokenUpdateError } = await supabaseAdmin
                    .from('creator_profiles')
                    .update({ youtube_account: tokenUpdate.newAccountData, updated_at: new Date().toISOString() })
                    .eq('id', tokenUpdate.userId);
                 if (tokenUpdateError) {
                    console.error(`CRON Job: Failed to update token for creator ${tokenUpdate.userId}:`, tokenUpdateError.message);
                    tokenUpdateErrors++;
                }
            }
            console.log(`CRON Job: Token updates attempted. Errors: ${tokenUpdateErrors}`);
        }

        console.log(`CRON Job: YouTube metrics update finished. Updated ${updatedSubmissionsCount} submission views.`);
        return NextResponse.json({ message: `OK. Updated ${updatedSubmissionsCount} submission views.` });

    } catch (error: any) {
        console.error('CRON Job: Unhandled error during execution:', error);
        return NextResponse.json({ error: `Cron job failed: ${error.message}` }, { status: 500 });
    }
} 
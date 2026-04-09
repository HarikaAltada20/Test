import { TikTokProvider } from '../provider/TikTokProvider';
import { createClient } from '@supabase/supabase-js';

/**
 * TikTokSyncService orchestrates fetching videos from TikTok APIs and
 * persisting them to the database. It handles token refresh flows seamlessly.
 */
export class TikTokSyncService {
    private supabase: any;
    private provider: TikTokProvider;

    constructor() {
        this.provider = new TikTokProvider();

        // Use the Service Role Key since this runs in a background/cron context
        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }

    /**
     * Syncs one creator's metrics from TikTok to Supabase.
     */
    async syncCreatorMetrics(creatorId: string) {
        try {
            console.log(`[TikTokSync] Starting sync for creator ${creatorId}`);

            // 1. Fetch connection details from creator_profiles
            const { data: profile, error } = await this.supabase
                .from('creator_profiles')
                .select('tiktok_account')
                .eq('id', creatorId)
                .single();

            if (error || !profile?.tiktok_account) {
                throw new Error(`TikTok connection not found for creator ${creatorId}: ${error?.message}`);
            }

            let connection = profile.tiktok_account;
            let { access_token, refresh_token, expires_at } = connection;

            // 2. Check Expiration & Proactive Refresh
            const expirationDate = new Date(expires_at);
            console.log(`[TikTokSync] Token for ${creatorId} expires at: ${expires_at}`);
            
            if (expirationDate <= new Date()) {
                console.log(`[TikTokSync] Token expired for ${creatorId}, refreshing...`);
                try {
                    const newTokens = await this.provider.refreshAccessToken(refresh_token);
                    access_token = newTokens.accessToken;
                    refresh_token = newTokens.refreshToken || refresh_token;
                    expires_at = new Date(Date.now() + (newTokens.expiresIn || 86400) * 1000).toISOString();

                    // Update connection object
                    connection = {
                        ...connection,
                        access_token,
                        refresh_token,
                        expires_at,
                        last_synced_at: new Date().toISOString()
                    };

                    // Persist new tokens to creator_profiles
                    await this.supabase
                        .from('creator_profiles')
                        .update({
                            tiktok_account: connection,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', creatorId);

                } catch (refreshErr) {
                    console.error(`[TikTokSync] Failed to refresh token for ${creatorId}`, refreshErr);
                    // Optionally mark as disconnected or handle failure
                    throw refreshErr;
                }
            }

            // 3. Fetch Recent Videos
            const recentVideos = await this.provider.getRecentVideos(access_token);
            const videoIds = recentVideos.videos.map((v: any) => v.id);

            // 3.1. Handle Marketing/Business Data if connected
            const marketing = connection.marketing;
            if (marketing && marketing.access_token) {
                console.log(`[TikTokSync] Marketing account found for ${creatorId}, fetching advanced data...`);
                try {
                    // Fetch Demographics
                    const demographics = await this.provider.getDemographics(marketing.access_token, marketing.creator_id || connection.platform_user_id);
                    
                    // Store demographics inside the tiktok_account object
                    const updatedConnection = {
                        ...connection,
                        marketing: {
                            ...marketing,
                            demographics,
                            last_synced_at: new Date().toISOString()
                        }
                    };

                    await this.supabase
                        .from('creator_profiles')
                        .update({
                            tiktok_account: updatedConnection,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', creatorId);
                    
                    console.log(`[TikTokSync] Demographics synced and stored in tiktok_account for ${creatorId}`);
                    
                    // Update connection for the rest of the function
                    connection = updatedConnection;
                } catch (dmErr: any) {
                    console.warn(`[TikTokSync] Failed to sync demographics for ${creatorId}. This may be because the business key is invalid or permissions are missing. Error: ${dmErr.message}`);
                }
            } else {
                console.log(`[TikTokSync] No Marketing/Business account connected for ${creatorId}. Skipping advanced demographics.`);
            }

            if (videoIds.length > 0) {
                // 4. Fetch Metrics for these videos
                const metrics = await this.provider.getVideoMetrics(access_token, videoIds);

                console.log(`[TikTokSync] Successfully fetched metrics for ${videoIds.length} videos for ${creatorId}.`);

                // 7. NEW: Update the submissions table as well
                const { data: submissions, error: subError } = await this.supabase
                    .from('submissions')
                    .select('id, content_link, other_stats')
                    .eq('creator_id', creatorId)
                    .eq('platform', 'tiktok');

                if (!subError && submissions) {
                    for (const submission of submissions) {
                        // Find the matching metric by URL or video ID
                        const match = metrics.find((m: any) => 
                            submission.content_link.includes(m.videoId)
                        );

                        if (match) {
                            let detailedReport = null;
                            if (marketing && marketing.access_token) {
                                try {
                                    detailedReport = await this.provider.getDetailedMetrics(marketing.access_token, match.url);
                                    if (detailedReport) {
                                        console.log(`[TikTokSync] Business API Stats Success for ${match.videoId}: Reach=${detailedReport.reach}, Saves=${detailedReport.save_count}`);
                                    } else {
                                        console.warn(`[TikTokSync] Business API returned empty report for ${match.videoId}`);
                                    }
                                } catch (e: any) {
                                    console.error(`[TikTokSync] Business API Fetch Error for video ${match.videoId}. Check if the business key/token is still valid. Error:`, e.message);
                                }
                            }

                            const saves = detailedReport?.save_count || detailedReport?.saves || 0;
                            const reach = detailedReport?.reach || detailedReport?.reach_count || detailedReport?.video_reach_count || 0;
                            const avgWatchTime = detailedReport?.avg_watch_time || detailedReport?.average_time_watched || detailedReport?.avg_play_time || 0;
                            const totalWatchTime = detailedReport?.total_watch_time || detailedReport?.total_time_watched || detailedReport?.total_play_time || 0;

                            const tiktokStats = {
                                views: match.viewCount,
                                likes: match.likeCount,
                                comments: match.commentCount,
                                shares: match.shareCount,
                                saves: saves,
                                reach: reach,
                                total_interactions: (match.likeCount + match.commentCount + match.shareCount + Number(saves)),
                                avg_watch_time_ms: avgWatchTime * 1000,
                                total_watch_time_ms: totalWatchTime * 1000,
                                last_updated: new Date().toISOString()
                            };

                            console.log(`[TikTokSync] Updating Submission ${submission.id}:`, {
                                views: match.viewCount,
                                likes: match.likeCount,
                                shares: match.shareCount,
                                reach: reach,
                                saves: saves,
                                avgWatchTimeMs: avgWatchTime * 1000
                            });

                            const currentOtherStats = typeof submission.other_stats === 'string' 
                                ? JSON.parse(submission.other_stats) 
                                : (submission.other_stats || {});

                            await this.supabase
                                .from('submissions')
                                .update({
                                    views: match.viewCount,
                                    other_stats: { ...currentOtherStats, tiktok: tiktokStats },
                                    last_insights_update: new Date().toISOString(),
                                    insights_status: 'ok'
                                })
                                .eq('id', submission.id);
                        }
                    }
                }

                // 8. NEW: Summary Stats for 'tiktok_achieved' in creator_profiles
                const totalStats = metrics.reduce((acc: any, m: any) => {
                    acc.views += m.viewCount;
                    acc.likes += m.likeCount;
                    acc.comments += m.commentCount;
                    acc.shares += m.shareCount;
                    acc.saves += m.saveCount;
                    return acc;
                }, { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });

                await this.supabase
                    .from('creator_profiles')
                    .update({
                        tiktok_achieved: totalStats,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', creatorId);

            } else {
                console.log(`[TikTokSync] No recent videos found for ${creatorId}.`);
            }

            // 9. Update Sync Timestamp in the tiktok_account object
            const finalAccount = {
                ...connection,
                last_synced_at: new Date().toISOString()
            };

            await this.supabase
                .from('creator_profiles')
                .update({
                    tiktok_account: finalAccount,
                    updated_at: new Date().toISOString()
                })
                .eq('id', creatorId);

            return { success: true, videosSynced: videoIds.length };

        } catch (error: any) {
            console.error(`[TikTokSync] Sync failed for ${creatorId}:`, error);
            return { success: false, error: error.message };
        }
    }
}
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
            if (new Date(expires_at) <= new Date()) {
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

            if (videoIds.length > 0) {
                // 4. Fetch Metrics for these videos
                const metrics = await this.provider.getVideoMetrics(access_token, videoIds);

                // 5. Build Upsert Payload
                const upsertPayload = metrics.map((m: any) => ({
                    creator_id: creatorId,
                    platform_id: 'tiktok',
                    video_id: m.videoId,
                    title: m.title,
                    url: m.url,
                    view_count: m.viewCount,
                    like_count: m.likeCount,
                    comment_count: m.commentCount,
                    share_count: m.shareCount,
                    save_count: m.saveCount,
                    duration: m.duration,
                    published_at: m.publishedAt.toISOString(),
                }));

                // 6. DB Bulk Upsert
                const { error: upsertError } = await this.supabase
                    .from('video_metrics')
                    .upsert(upsertPayload, { onConflict: 'platform_id, video_id' });

                if (upsertError) {
                    throw new Error(`Failed to upsert metrics: ${upsertError.message}`);
                }

                console.log(`[TikTokSync] Successfully synced ${videoIds.length} videos for ${creatorId}.`);
            } else {
                console.log(`[TikTokSync] No recent videos found for ${creatorId}.`);
            }

            // 7. Update Sync Timestamp in the tiktok_account object
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
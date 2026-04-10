import { TikTokProvider } from '../provider/TikTokProvider';
import { createClient } from '@supabase/supabase-js';
import { extractTikTokVideoIdFromLink } from '@/lib/tiktok/extract-video-id';
import { normalizeTcmVideoReport } from '@/lib/tiktok/normalize-tcm-report';
import { watchTimeToMsSeconds } from '@/lib/tiktok/watch-time-ms';
import type { TikTokBusinessVideoRowMetrics } from '@/lib/tiktok/map-business-video-row';

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
     * Business/Marketing access tokens expire in ~24h. Refresh using refresh_token when near expiry.
     */
    private async ensureMarketingAccessFresh(
        connection: Record<string, any>,
        creatorId: string,
    ): Promise<Record<string, any>> {
        const marketing = connection.marketing;
        if (!marketing?.access_token || !marketing?.refresh_token) {
            return connection;
        }

        const expMs = marketing.access_token_expires_at
            ? new Date(marketing.access_token_expires_at).getTime()
            : 0;
        const bufferMs = 5 * 60 * 1000;
        const needsRefresh =
            !expMs ||
            !Number.isFinite(expMs) ||
            expMs <= Date.now() + bufferMs;

        if (!needsRefresh) {
            return connection;
        }

        try {
            const fresh = await this.provider.refreshBusinessCreatorToken(
                marketing.refresh_token,
            );
            const newMarketing = {
                ...marketing,
                access_token: fresh.accessToken,
                refresh_token: fresh.refreshToken,
                access_token_expires_at: new Date(
                    Date.now() + fresh.expiresIn * 1000,
                ).toISOString(),
                last_token_refresh_at: new Date().toISOString(),
            };
            const next = { ...connection, marketing: newMarketing };
            await this.supabase
                .from("creator_profiles")
                .update({
                    tiktok_account: next,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", creatorId);
            console.log(
                `[TikTokSync] Refreshed Marketing access token for ${creatorId}`,
            );
            return next;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.warn(
                `[TikTokSync] Marketing token refresh failed (user may need to reconnect Marketing): ${msg}`,
            );
            return connection;
        }
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
            connection = await this.ensureMarketingAccessFresh(connection, creatorId);
            let marketing = connection.marketing;
            if (marketing && marketing.access_token) {
                console.log(`[TikTokSync] Marketing account found for ${creatorId}, fetching advanced data...`);
                const ttoForTcm =
                    marketing.tto_tcm_account_id ??
                    marketing.creator_id ??
                    marketing.business_id ??
                    null;
                const demographicsCreatorId =
                    marketing.creator_id ||
                    marketing.business_id ||
                    connection.platform_user_id;
                try {
                    if (!demographicsCreatorId) {
                        console.warn(
                            `[TikTokSync] Skip demographics: no creator_id / business_id / platform_user_id`,
                        );
                    } else {
                    // Fetch Demographics
                    const demographics = await this.provider.getDemographics(
                        marketing.access_token,
                        demographicsCreatorId,
                        { ttoTcmAccountId: ttoForTcm },
                    );
                    
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
                    marketing = connection.marketing;
                    }
                } catch (dmErr: any) {
                    console.warn(`[TikTokSync] Failed to sync demographics for ${creatorId}. This may be because the business key is invalid or permissions are missing. Error: ${dmErr.message}`);
                }
            } else {
                console.log(`[TikTokSync] No Marketing/Business account connected for ${creatorId}. Skipping advanced demographics.`);
            }

            if (videoIds.length > 0) {
                marketing = connection.marketing;
                const ttoForVideoReports =
                    marketing?.tto_tcm_account_id ??
                    marketing?.creator_id ??
                    marketing?.business_id ??
                    null;
                // 3.5 Organic Business video list (richer metrics than Display API alone)
                let organicByItemId = new Map<string, TikTokBusinessVideoRowMetrics>();
                if (marketing?.access_token) {
                    const businessKey =
                        marketing.business_id ??
                        marketing.creator_id ??
                        connection.platform_user_id;
                    if (businessKey) {
                        try {
                            organicByItemId =
                                await this.provider.fetchBusinessOrganicVideoMetricsByItemId(
                                    marketing.access_token,
                                    String(businessKey),
                                );
                        } catch (orgErr: any) {
                            console.warn(
                                `[TikTokSync] business/video/list failed for ${creatorId} (falling back to Display + TCM):`,
                                orgErr?.message ?? orgErr,
                            );
                        }
                    } else {
                        console.warn(
                            `[TikTokSync] Marketing connected but no business_id/creator_id — skipping business/video/list`,
                        );
                    }
                }

                // 4. Fetch Metrics for these videos
                const metrics = await this.provider.getVideoMetrics(access_token, videoIds);

                console.log(`[TikTokSync] Successfully fetched metrics for ${videoIds.length} videos for ${creatorId}.`);

                const totalStats = metrics.reduce(
                    (acc: { views: number; likes: number; comments: number; shares: number; saves: number }, m: any) => {
                        acc.views += m.viewCount;
                        acc.likes += m.likeCount;
                        acc.comments += m.commentCount;
                        acc.shares += m.shareCount;
                        return acc;
                    },
                    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
                );

                // 7. NEW: Update the submissions table as well
                const { data: submissions, error: subError } = await this.supabase
                    .from('submissions')
                    .select('id, content_link, other_stats')
                    .eq('creator_id', creatorId)
                    .eq('platform', 'tiktok');

                if (!subError && submissions) {
                    for (const submission of submissions) {
                        const linkId = extractTikTokVideoIdFromLink(submission.content_link);
                        const match = metrics.find((m: any) => {
                            if (linkId && m.videoId === linkId) return true;
                            if (!submission.content_link || !m.videoId) return false;
                            return (
                                submission.content_link.includes(m.videoId) ||
                                (m.url && submission.content_link.split('?')[0] === String(m.url).split('?')[0])
                            );
                        });

                        if (match) {
                            const org = organicByItemId.get(match.videoId);
                            const pick = (o: number, d: number) => (o > 0 ? o : d);

                            let rawDetailed: unknown = null;
                            if (marketing && marketing.access_token && ttoForVideoReports) {
                                try {
                                    rawDetailed = await this.provider.getDetailedMetrics(
                                        marketing.access_token,
                                        match.url,
                                        ttoForVideoReports,
                                    );
                                    const tcm = normalizeTcmVideoReport(rawDetailed);
                                    if (tcm && (tcm.reach > 0 || tcm.save_count > 0)) {
                                        console.log(
                                            `[TikTokSync] Business API stats for ${match.videoId}: reach=${tcm.reach}, saves=${tcm.save_count}`,
                                        );
                                    } else if (rawDetailed) {
                                        console.warn(
                                            `[TikTokSync] Business API returned report with no normalized metrics for ${match.videoId}`,
                                        );
                                    }
                                } catch (e: any) {
                                    console.error(
                                        `[TikTokSync] Business API Fetch Error for video ${match.videoId}. Check if the business key/token is still valid. Error:`,
                                        e.message,
                                    );
                                }
                            } else if (
                                marketing?.access_token &&
                                !ttoForVideoReports
                            ) {
                                console.warn(
                                    `[TikTokSync] Skip TCM report for ${match.videoId}: set tto_tcm_account_id (reconnect TikTok Marketing / Business)`,
                                );
                            }

                            // TCM per-video report (best-effort) — supplements fields missing from business/video/list
                            const tcmFlat = normalizeTcmVideoReport(rawDetailed);
                            const tcmSaves = tcmFlat?.save_count ?? 0;
                            const favCount = org?.favorites ?? 0;
                            const saves =
                                tcmSaves > 0 ? tcmSaves : favCount;

                            const views = org
                                ? pick(org.views, match.viewCount)
                                : match.viewCount;
                            const likes = org
                                ? pick(org.likes, match.likeCount)
                                : match.likeCount;
                            const comments = org
                                ? pick(org.comments, match.commentCount)
                                : match.commentCount;
                            const shares = org
                                ? pick(org.shares, match.shareCount)
                                : match.shareCount;

                            const reachFromOrg = org?.reach ?? 0;
                            const reach =
                                reachFromOrg > 0
                                    ? reachFromOrg
                                    : (tcmFlat?.reach ?? 0);

                            const avgFromOrg = org?.avgWatchTimeMs ?? 0;
                            const totalFromOrg = org?.totalWatchTimeMs ?? 0;
                            const avgWatchTimeMs =
                                avgFromOrg > 0
                                    ? avgFromOrg
                                    : watchTimeToMsSeconds(
                                          tcmFlat?.avg_watch_time_sec ?? 0,
                                      );
                            const totalWatchTimeMs =
                                totalFromOrg > 0
                                    ? totalFromOrg
                                    : watchTimeToMsSeconds(
                                          tcmFlat?.total_watch_time_sec ?? 0,
                                      );

                            const tiktokStats = {
                                views,
                                likes,
                                comments,
                                shares,
                                saves,
                                favorites: favCount,
                                reach,
                                media_type: org?.mediaType ?? null,
                                caption: org?.caption ?? null,
                                thumbnail_url: org?.thumbnailUrl ?? null,
                                share_url: org?.shareUrl ?? null,
                                embed_url: org?.embedUrl ?? null,
                                create_time: org?.createTime ?? null,
                                video_duration_sec: org?.videoDurationSec ?? 0,
                                full_video_watched_rate:
                                    org?.fullVideoWatchedRate ?? 0,
                                new_followers: org?.newFollowers ?? 0,
                                profile_views: org?.profileViews ?? 0,
                                website_clicks: org?.websiteClicks ?? 0,
                                phone_number_clicks: org?.phoneNumberClicks ?? 0,
                                lead_submissions: org?.leadSubmissions ?? 0,
                                app_download_clicks: org?.appDownloadClicks ?? 0,
                                email_clicks: org?.emailClicks ?? 0,
                                address_clicks: org?.addressClicks ?? 0,
                                impression_sources: org?.impressionSources ?? null,
                                audience_genders: org?.audienceGenders ?? null,
                                audience_countries: org?.audienceCountries ?? null,
                                audience_cities: org?.audienceCities ?? null,
                                audience_types: org?.audienceTypes ?? null,
                                video_view_retention: org?.videoViewRetention ?? null,
                                engagement_likes: org?.engagementLikes ?? null,
                                total_interactions:
                                    likes +
                                    comments +
                                    shares +
                                    Number(saves),
                                avg_watch_time_ms: avgWatchTimeMs,
                                total_watch_time_ms: totalWatchTimeMs,
                                last_updated: new Date().toISOString(),
                            };

                            totalStats.saves += saves;

                            console.log(`[TikTokSync] Updating Submission ${submission.id}:`, {
                                views,
                                likes,
                                shares,
                                reach,
                                saves,
                                avgWatchTimeMs,
                                totalWatchTimeMs,
                                organicRow: Boolean(org),
                            });

                            const currentOtherStats = typeof submission.other_stats === 'string' 
                                ? JSON.parse(submission.other_stats) 
                                : (submission.other_stats || {});

                            await this.supabase
                                .from('submissions')
                                .update({
                                    views,
                                    other_stats: { ...currentOtherStats, tiktok: tiktokStats },
                                    last_insights_update: new Date().toISOString(),
                                    insights_status: 'ok'
                                })
                                .eq('id', submission.id);
                        }
                    }
                }

                // 8. Summary stats for 'tiktok_achieved' (account-wide Display API + Business saves from matched submissions)
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
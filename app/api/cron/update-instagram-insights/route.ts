import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs'; // For date manipulation
// Assuming you have types generated, e.g., from `npx supabase gen types typescript --project-id your-project-id > types/supabase.ts`
// import type { Database } from '@/types/supabase'; // Uncomment if you have this

// Use a more generic type if Database types aren't set up for this structure yet
interface InstagramAccount {
  access_token: string;
  token_expiry: string; // ISO String timestamp
  app_scoped_user_id: string; // This is the IG Business Account ID (IGBA ID)
  // other fields like username, profile_picture_url etc., might exist
  instagram_user_id?: string; // The global Instagram User ID
  account_type?: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL';
}

interface CreatorProfile {
  id: string;
  instagram_account: InstagramAccount | null;
  updated_at?: string; // Assuming you have an updated_at for the profile itself
}

interface Submission {
  id: string;
  creator_id: string;
  video_id: string; // This is the Instagram Media ID
  views: number | null;
  other_stats: any | null;
  platform: string;
  updated_at?: string; // Assuming you have an updated_at for the submission
}

// Define the structure for the expected Instagram insights response
interface InstagramInsightValue {
  value: number;
}
interface InstagramInsightMetric {
  name: string;
  period: string;
  values: InstagramInsightValue[];
  title: string;
  description: string;
  id: string;
}
interface InstagramInsightsResponse {
  data: InstagramInsightMetric[];
}

interface InstagramTokenRefreshResponse {
  access_token: string;
  token_type: string; // Should be 'bearer'
  expires_in: number; // Lifespan of new token in seconds
}

const TOKEN_REFRESH_THRESHOLD_DAYS = 7; // Refresh if token expires within this many days

// Helper function to chunk array (if needed for batching, though IG insights are per media)
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function GET(request: Request) {
  // 1. Verify Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('CRON Job (Instagram): Invalid or missing CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('CRON Job (Instagram): Starting Instagram insights update...');

  // 2. Initialize Supabase Admin Client
  // Make sure to use your actual Supabase types if available
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
    // { db: { schema: 'public' } } // Specify schema if needed, default is public
  );

  try {
    // 3. Fetch relevant submissions
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: submissions, error: submissionError } = await supabaseAdmin
      .from('submissions')
      .select('id, creator_id, video_id, views, other_stats, platform')
      .eq('platform', 'instagram')
      .not('video_id', 'is', null)
      // Optional: Filter for submissions that haven't been updated recently or are part of active contests
      // For example, update submissions created/updated in the last 7 days, or link to active contests
      // .gte('updated_at', sevenDaysAgo) // Example: only submissions updated recently
      .returns<Submission[]>(); // Ensure the return type

    if (submissionError) {
      console.error('CRON Job (Instagram): Error fetching submissions:', submissionError);
      throw new Error(`Database error fetching submissions: ${submissionError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      console.log('CRON Job (Instagram): No relevant Instagram submissions found to update.');
      return NextResponse.json({ message: 'No Instagram submissions to update' }, { status: 200 });
    }

    console.log(`CRON Job (Instagram): Found ${submissions.length} Instagram submissions to potentially update.`);

    // 4. Group submissions by creator_id to batch fetch creator profiles
    const submissionsByCreator: { [key: string]: Submission[] } = {};
    for (const sub of submissions) {
      if (!submissionsByCreator[sub.creator_id]) {
        submissionsByCreator[sub.creator_id] = [];
      }
      submissionsByCreator[sub.creator_id].push(sub);
    }
    
    const creatorIds = Object.keys(submissionsByCreator);
    console.log(`CRON Job (Instagram): Processing updates for ${creatorIds.length} unique creators.`);

    // 5. Fetch creator profiles (creator_profiles table)
    const { data: creatorsData, error: profilesError } = await supabaseAdmin
      .from('creator_profiles')
      .select('id, instagram_account, updated_at')
      .in('id', creatorIds)
      .not('instagram_account', 'is', null)
      .returns<CreatorProfile[]>();

    if (profilesError) {
      console.error('CRON Job (Instagram): Error fetching creator profiles:', profilesError);
      throw new Error(`Database error fetching creator profiles: ${profilesError.message}`);
    }

    if (!creatorsData || creatorsData.length === 0) {
      console.log('CRON Job (Instagram): No creator profiles with connected Instagram accounts found for these submissions.');
      return NextResponse.json({ message: 'No connected Instagram accounts found for submissions' }, { status: 200 });
    }

    // Create a map for easy lookup of creator profiles
    const creatorProfileMap = new Map(creatorsData.map(profile => [profile.id, profile]));

    let updatedSubmissionsCount = 0;
    const metricsToUpdateDatabase: { id: string; views: number; other_stats: any; updated_at: string }[] = [];
    const tokenUpdatesToDatabase: { userId: string; newAccountData: InstagramAccount }[] = [];

    // Updated metricsString based on user's successful manual API call and error message guidance
    const metricsString = 'reach,likes,comments,ig_reels_video_view_total_time,ig_reels_avg_watch_time';

    // 6. Process each creator and their submissions
    for (const creatorId of creatorIds) {
      let creatorProfile = creatorProfileMap.get(creatorId);
      const userSubmissions = submissionsByCreator[creatorId];

      if (!creatorProfile || !creatorProfile.instagram_account) {
        console.warn(`CRON Job (Instagram): Skipping creator ${creatorId} - missing profile or Instagram account details.`);
        continue;
      }

      let currentInstagramAccount = { ...creatorProfile.instagram_account };

      if (!currentInstagramAccount.access_token || !currentInstagramAccount.app_scoped_user_id) {
        console.warn(`CRON Job (Instagram): Skipping creator ${creatorId} - missing access_token or app_scoped_user_id (IGBA ID).`);
        continue;
      }
      
      // Ensure it's a business or creator account that can access insights
      if (currentInstagramAccount.account_type !== 'BUSINESS' && currentInstagramAccount.account_type !== 'MEDIA_CREATOR') {
        console.warn(`CRON Job (Instagram): Skipping creator ${creatorId} - account type is ${currentInstagramAccount.account_type}, not BUSINESS or MEDIA_CREATOR.`);
        continue;
      }

      // Token Refresh Logic
      if (currentInstagramAccount.token_expiry) {
        const expiryDate = dayjs(currentInstagramAccount.token_expiry);
        if (expiryDate.isBefore(dayjs().add(TOKEN_REFRESH_THRESHOLD_DAYS, 'day'))) {
          console.log(`CRON Job (Instagram): Token for creator ${creatorId} expiring soon (or expired). Attempting refresh.`);
          try {
            const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentInstagramAccount.access_token}`;
            const refreshRes = await fetch(refreshUrl);
            const refreshData = await refreshRes.json();

            if (!refreshRes.ok || refreshData.error) {
              console.error(`CRON Job (Instagram): Failed to refresh token for creator ${creatorId}. API Error:`, refreshData.error || refreshRes.statusText);
              // Potentially mark token as invalid or needing manual re-auth if refresh fails persistently
              continue; // Skip this creator for this run if token refresh fails
            } else {
              const refreshedTokenData = refreshData as InstagramTokenRefreshResponse;
              const newExpiry = dayjs().add(refreshedTokenData.expires_in, 'second').toISOString();
              console.log(`CRON Job (Instagram): Token refreshed successfully for creator ${creatorId}. New expiry: ${newExpiry}`);
              
              currentInstagramAccount.access_token = refreshedTokenData.access_token;
              currentInstagramAccount.token_expiry = newExpiry;
              tokenUpdatesToDatabase.push({ userId: creatorId, newAccountData: currentInstagramAccount });
            }
          } catch (refreshErr: any) {
            console.error(`CRON Job (Instagram): Exception during token refresh for creator ${creatorId}:`, refreshErr.message);
            continue; // Skip this creator for this run
          }
        }
      } else {
        console.warn(`CRON Job (Instagram): Token for creator ${creatorId} has no expiry date. Cannot determine if refresh is needed. Consider re-authenticating.`);
        // Potentially skip or attempt insights fetch cautiously
      }

      for (const submission of userSubmissions) {
        if (!submission.video_id) { // Instagram Media ID
          console.warn(`CRON Job (Instagram): Submission ${submission.id} for creator ${creatorId} is missing video_id. Skipping.`);
          continue;
        }

        try {
          console.log(`CRON Job (Instagram): Fetching insights for media ${submission.video_id} (submission ${submission.id}) for creator ${creatorId}...`);
          
          // Corrected API URL structure for media insights
          const insightsApiUrl = `https://graph.instagram.com/${submission.video_id}/insights?metric=${metricsString}&access_token=${currentInstagramAccount.access_token}`;

          const insightsRes = await fetch(insightsApiUrl, {
            method: 'GET', // Explicitly set method, though GET is default
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          if (!insightsRes.ok) {
            const errorData = await insightsRes.json().catch(() => ({ message: insightsRes.statusText }));
            console.error(
              `CRON Job (Instagram): API Error fetching insights for media ${submission.video_id} (creator ${creatorId}). Status: ${insightsRes.status}`,
              errorData
            );
            // If error indicates invalid token (e.g. code 190), could trigger re-auth flag for user
            if (errorData.error?.code === 190) {
                console.warn(`CRON Job (Instagram): Access token for creator ${creatorId} is invalid. Needs re-authentication.`);
                // Potentially skip all further submissions for this user in this run or mark profile
            }
            continue; // Skip this submission
          }

          const insightsData = await insightsRes.json() as InstagramInsightsResponse;

          if (!insightsData.data || insightsData.data.length === 0) {
            console.log(`CRON Job (Instagram): No insights data returned for media ${submission.video_id}. It might be too new or have no data.`);
            continue;
          }
          
          let currentViews = 0;
          const newInstagramStats: any = {};
          insightsData.data.forEach((metric) => {
            const value = metric.values[0]?.value || 0;
            newInstagramStats[metric.name] = value;
            if (metric.name === 'reach') { // 'reach' is used for 'views' for Instagram Reels
              currentViews = value;
            }
          });

          // Only update if views have changed or other_stats are different (more robust check needed for other_stats)
          // For simplicity, let's assume if reach is different, we update.
          // A more robust check would involve comparing the whole newInstagramStats with submission.other_stats?.instagram
          let hasChanged = (submission.views !== currentViews);
          
          // Basic check for other_stats change (can be improved)
          if (!hasChanged && submission.other_stats?.instagram) {
             for (const key in newInstagramStats) {
                 if (newInstagramStats[key] !== submission.other_stats.instagram[key]) {
                     hasChanged = true;
                     break;
                 }
             }
             // Check if keys were removed from newInstagramStats that existed in old
             if (!hasChanged) {
                for (const key in submission.other_stats.instagram) {
                    if (!(key in newInstagramStats)) {
                         hasChanged = true;
                         break;
                    }
                }
             }
          } else if (!submission.other_stats?.instagram && Object.keys(newInstagramStats).length > 0) {
             // If old stats didn't exist but new ones do
             hasChanged = true;
          }


          if (hasChanged) {
            metricsToUpdateDatabase.push({
              id: submission.id,
              views: currentViews,
              other_stats: { ...submission.other_stats, instagram: newInstagramStats },
              updated_at: new Date().toISOString(),
            });
            updatedSubmissionsCount++;
            console.log(`CRON Job (Instagram): Insights updated for media ${submission.video_id} (submission ${submission.id}). New views: ${currentViews}`);
          } else {
            console.log(`CRON Job (Instagram): Insights for media ${submission.video_id} (submission ${submission.id}) have not changed. Views: ${currentViews}. Skipping DB update.`);
          }

        } catch (fetchError: any) {
          console.error(`CRON Job (Instagram): Error processing submission ${submission.id} for media ${submission.video_id}:`, fetchError.message);
          // Log and continue with the next submission/creator
        }
      }
    }

    // 7. Perform Batch Updates
    if (tokenUpdatesToDatabase.length > 0) {
      console.log(`CRON Job (Instagram): Updating ${tokenUpdatesToDatabase.length} creator Instagram tokens in DB...`);
      for (const tokenUpdate of tokenUpdatesToDatabase) {
        const { error: dbTokenUpdateError } = await supabaseAdmin
          .from('creator_profiles')
          .update({ 
            instagram_account: tokenUpdate.newAccountData,
            updated_at: new Date().toISOString() 
          })
          .eq('id', tokenUpdate.userId);
        if (dbTokenUpdateError) {
          console.error(`CRON Job (Instagram): Failed to update token for creator ${tokenUpdate.userId} in DB:`, dbTokenUpdateError.message);
        }
      }
    }

    if (metricsToUpdateDatabase.length > 0) {
      console.log(`CRON Job (Instagram): Updating metrics for ${metricsToUpdateDatabase.length} submissions in DB...`);
      let updateErrors = 0;
      for (const update of metricsToUpdateDatabase) {
        const { error: dbUpdateError } = await supabaseAdmin
          .from('submissions')
          .update({
            views: update.views,
            other_stats: update.other_stats,
            updated_at: update.updated_at, // Ensure your table has 'updated_at'
          })
          .eq('id', update.id);

        if (dbUpdateError) {
          console.error(`CRON Job (Instagram): Failed to update submission ${update.id} in DB:`, dbUpdateError.message);
          updateErrors++;
        }
      }
      console.log(`CRON Job (Instagram): Database updates attempted for ${metricsToUpdateDatabase.length} submissions. Errors: ${updateErrors}`);
    }

    console.log(`CRON Job (Instagram): Instagram insights update finished. Updated ${updatedSubmissionsCount} submissions.`);
    return NextResponse.json({ message: `OK. Updated ${updatedSubmissionsCount} Instagram submission insights.` });

  } catch (error: any) {
    console.error('CRON Job (Instagram): Unhandled error during execution:', error);
    return NextResponse.json({ error: `Cron job failed: ${error.message}` }, { status: 500 });
  }
} 
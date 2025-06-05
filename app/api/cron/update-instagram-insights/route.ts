import { NextResponse } from 'next/server';
import dayjs from 'dayjs'; // For date manipulation
import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';
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

const TOKEN_REFRESH_THRESHOLD_DAYS = 10; // Refresh if expiring within 10 days

// Helper function to chunk array (if needed for batching, though IG insights are per media)
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Function to update budget spent for CPM contests
async function updateCpmContestBudgets(supabaseAdmin: any) {
    console.log('CRON Job (Instagram): Starting CPM budget updates...');
    
    try {
        // Get all active CPM contests
        const { data: cpmContests, error: contestsError } = await supabaseAdmin
            .from('contests')
            .select('id, contest_based_details')
            .eq('contest_type', 'cpm')
            .not('contest_based_details', 'is', null);

        if (contestsError) {
            console.error('CRON Job (Instagram): Error fetching CPM contests:', contestsError);
            return;
        }

        if (!cpmContests || cpmContests.length === 0) {
            console.log('CRON Job (Instagram): No CPM contests found to update.');
            return;
        }

        console.log(`CRON Job (Instagram): Found ${cpmContests.length} CPM contests to process.`);

        for (const contest of cpmContests) {
            const cpmConfig = contest.contest_based_details?.cpm_contest;
            if (!cpmConfig || !cpmConfig.cpm_rate_usd) {
                console.warn(`CRON Job (Instagram): Contest ${contest.id} has invalid CPM config. Skipping.`);
                continue;
            }

            // Get all verified submissions for this contest
            const { data: verifiedSubmissions, error: submissionsError } = await supabaseAdmin
                .from('submissions')
                .select('views')
                .eq('contest_id', contest.id)
                .eq('status', 'verified');

            if (submissionsError) {
                console.error(`CRON Job (Instagram): Error fetching submissions for contest ${contest.id}:`, submissionsError);
                continue;
            }

            if (!verifiedSubmissions || verifiedSubmissions.length === 0) {
                console.log(`CRON Job (Instagram): No verified submissions for contest ${contest.id}. Budget spent: $0.00`);
                continue;
            }

            // Calculate total budget spent
            let totalSpent = 0;
            for (const submission of verifiedSubmissions) {
                let effectiveViews = submission.views || 0;
                
                // Apply min/max view constraints
                if (cpmConfig.min_views != null && effectiveViews < cpmConfig.min_views) {
                    effectiveViews = 0;
                } else if (cpmConfig.max_views != null && effectiveViews > cpmConfig.max_views) {
                    effectiveViews = cpmConfig.max_views;
                }
                
                const earnings = (effectiveViews * cpmConfig.cpm_rate_usd) / 1000;
                totalSpent += earnings;
            }

            // Convert to cents for storage consistency
            const totalSpentCents = Math.round(totalSpent * 100);

            // Update the contest with new budget_spent value
            const updatedContestDetails = {
                ...contest.contest_based_details,
                cpm_contest: {
                    ...cpmConfig,
                    budget_spent: totalSpentCents
                }
            };

            const { error: updateError } = await supabaseAdmin
                .from('contests')
                .update({ 
                    contest_based_details: updatedContestDetails,
                    updated_at: new Date().toISOString()
                })
                .eq('id', contest.id);

            if (updateError) {
                console.error(`CRON Job (Instagram): Error updating budget for contest ${contest.id}:`, updateError);
            } else {
                console.log(`CRON Job (Instagram): Updated budget for contest ${contest.id}. Budget spent: $${totalSpent.toFixed(2)} (${verifiedSubmissions.length} verified submissions)`);
            }
        }
    } catch (error: any) {
        console.error('CRON Job (Instagram): Error updating CPM contest budgets:', error.message);
    }
}

export async function GET(request: Request) {
  // 1. Verify Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('CRON Job (Instagram): Invalid or missing CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('CRON Job (Instagram): Starting Instagram insights update...');

  // const supabaseAdmin = await createClient(); // Old way
  const supabaseAdmin = createAdminSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 3. Fetch relevant submissions
    
    const { data: submissions, error: submissionError } = await supabaseAdmin
      .from('submissions')
      .select('id, creator_id, video_id, views, other_stats, platform')
      .eq('platform', 'instagram')
      .not('video_id', 'is', null)
      .returns<Submission[]>(); // Ensure the return type

    if (submissionError) {
      console.error('CRON Job (Instagram): Error fetching submissions:', submissionError);
      throw new Error(`Database error fetching submissions: ${submissionError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      console.log('CRON Job (Instagram): No relevant Instagram submissions found to update.');
      
      // Still run budget updates even if no submissions to process
      await updateCpmContestBudgets(supabaseAdmin);
      
      return NextResponse.json({ message: 'No Instagram submissions to update, budget tracking completed' }, { status: 200 });
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
      
      // Still run budget updates
      await updateCpmContestBudgets(supabaseAdmin);
      
      return NextResponse.json({ message: 'No connected Instagram accounts found for submissions, budget tracking completed' }, { status: 200 });
    }

    // Create a map for easy lookup of creator profiles
    const creatorProfileMap = new Map(creatorsData.map(profile => [profile.id, profile]));

    let updatedSubmissionsCount = 0;
    const metricsToUpdateDatabase: { id: string; views: number; other_stats: any; updated_at: string }[] = [];
    const tokenUpdatesToDatabase: { userId: string; newAccountData: InstagramAccount }[] = [];

    // Updated metricsString based on user's successful manual API call
    const metricsString = 'reach,likes,comments,shares,saved,total_interactions,views';

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
          
          let primaryViews = 0; // Changed from currentViews to align with client logic
          const newInstagramStats: any = {};

          insightsData.data.forEach((metric) => {
            const value = metric.values[0]?.value || 0;
            newInstagramStats[metric.name] = value; // Store each metric by its name

            if (metric.name === 'views') { // Primary source for views count
              primaryViews = value;
            }
          });

          // Fallback logic for views, similar to client-side
          if (primaryViews === 0 && newInstagramStats.reach !== undefined && newInstagramStats.reach > 0) {
            console.log(`CRON Job (Instagram): Primary 'views' for media ${submission.video_id} was 0 or not found. Falling back to 'reach':`, newInstagramStats.reach);
            primaryViews = newInstagramStats.reach;
          } else if (primaryViews === 0) {
            console.log(`CRON Job (Instagram): Primary 'views' and 'reach' for media ${submission.video_id} are 0 or not available. Submission views will be 0.`);
          }

          // Ensure all expected other_stats fields are at least defaulted if not present in API response
          const defaultStats = { reach: 0, likes: 0, comments: 0, shares: 0, saved: 0, total_interactions: 0, views: 0 };
          const finalInstagramStats = { ...defaultStats, ...newInstagramStats };
          
          // Determine if stats have meaningfully changed
          let hasChanged = (submission.views !== primaryViews);
          
          if (!hasChanged && submission.other_stats?.instagram) {
             // More robust check against all fields in finalInstagramStats vs submission.other_stats.instagram
             for (const key in finalInstagramStats) {
                 if (finalInstagramStats[key] !== submission.other_stats.instagram[key]) {
                     hasChanged = true;
                     break;
                 }
             }
             // Check if keys were removed from finalInstagramStats that existed in old (less likely here since we use defaultStats)
             if (!hasChanged) {
                for (const key in submission.other_stats.instagram) {
                    if (!(key in finalInstagramStats)) {
                         hasChanged = true;
                         break;
                    }
                }
             }
          } else if (!submission.other_stats?.instagram && Object.keys(finalInstagramStats).length > 0) {
             hasChanged = true;
          }

          if (hasChanged) {
            metricsToUpdateDatabase.push({
              id: submission.id,
              views: primaryViews, // Use the determined primary views
              other_stats: { ...submission.other_stats, instagram: finalInstagramStats }, // Store all new stats
              updated_at: new Date().toISOString(),
            });
            updatedSubmissionsCount++;
            console.log(`CRON Job (Instagram): Insights updated for media ${submission.video_id} (submission ${submission.id}). New primary views: ${primaryViews}`);
          } else {
            console.log(`CRON Job (Instagram): Insights for media ${submission.video_id} (submission ${submission.id}) have not changed. Primary views: ${primaryViews}. Skipping DB update.`);
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

    // 8. Update CPM Contest Budgets
    await updateCpmContestBudgets(supabaseAdmin);

    console.log(`CRON Job (Instagram): Instagram insights update finished. Updated ${updatedSubmissionsCount} submissions.`);
    return NextResponse.json({ message: `OK. Updated ${updatedSubmissionsCount} Instagram submission insights and CPM contest budgets.` });

  } catch (error: any) {
    console.error('CRON Job (Instagram): Unhandled error during execution:', error);
    return NextResponse.json({ error: `Cron job failed: ${error.message}` }, { status: 500 });
  }
} 
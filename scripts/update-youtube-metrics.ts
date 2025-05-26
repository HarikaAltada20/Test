import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js';
import { createOAuthClient, getVideoStats } from '../lib/youtube-api';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createAdminSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface YouTubeAccount {
  access_token: string;
  refresh_token: string;
  channel_id: string;
  expires_at: string;
  updated_at: string;
}

interface CreatorProfile {
  id: string;
  youtube_account: YouTubeAccount;
}

interface RawSubmissionData {
  id: string;
  video_id: string;
  creator_profile: {
    id: string;
    youtube_account: {
      access_token: string;
      refresh_token: string;
      channel_id: string;
      expires_at: string;
      updated_at: string;
    };
  };
}

interface VideoMetrics {
  views: number;
  likes: number;
  comments: number;
}

// Helper function to refresh token
async function refreshYouTubeToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const oauth2Client = await createOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return {
      access_token: credentials.access_token!,
      expires_in: credentials.expiry_date ? 
        Math.floor((credentials.expiry_date - Date.now()) / 1000) : 
        3600
    };
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Helper function to get video metrics
async function getVideoMetrics(accessToken: string, videoId: string): Promise<VideoMetrics | null> {
  try {
    const stats = await getVideoStats(videoId, accessToken);
    if (!stats) return null;

    return {
      views: parseInt(stats.viewCount || '0'),
      likes: parseInt(stats.likeCount || '0'),
      comments: parseInt(stats.commentCount || '0')
    };
  } catch (error) {
    console.error(`Error getting video metrics for ${videoId}:`, error);
    return null;
  }
}

// Type guard to validate submission data
function isValidSubmission(data: any): data is RawSubmissionData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.id === 'string' &&
    typeof data.video_id === 'string' &&
    typeof data.creator_profile === 'object' &&
    data.creator_profile !== null &&
    typeof data.creator_profile.id === 'string' &&
    typeof data.creator_profile.youtube_account === 'object' &&
    data.creator_profile.youtube_account !== null &&
    typeof data.creator_profile.youtube_account.access_token === 'string' &&
    typeof data.creator_profile.youtube_account.refresh_token === 'string' &&
    typeof data.creator_profile.youtube_account.channel_id === 'string'
  );
}

async function updateMetrics() {
  console.log('Starting YouTube metrics update...');
  
  try {
    // Get all submissions with their creator profiles
    const { data, error } = await supabase
    .from('submissions')
      .select('id, video_id, creator_profile:creator_profiles!inner(id, youtube_account)')
    .not('video_id', 'is', null);
  
  if (error) {
      console.error('Error fetching submissions:', error.message);
    return;
  }
  
    // Type assertion after validation
    const submissionsData = data as unknown as RawSubmissionData[];
    
    if (!submissionsData || submissionsData.length === 0) {
      console.log('No submissions found');
    return;
  }
  
    console.log(`Found ${submissionsData.length} submissions to update`);
  
    for (const submission of submissionsData) {
    try {
      console.log(`Processing submission ${submission.id} with video ${submission.video_id}...`);
      
        const { youtube_account } = submission.creator_profile;
        
        // Refresh token if needed
        const tokens = await refreshYouTubeToken(youtube_account.refresh_token);
        if (tokens) {
          console.log(`Updating tokens for creator ${submission.creator_profile.id}...`);
          
          const updatedAccount = {
            ...youtube_account,
            access_token: tokens.access_token,
            expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
            updated_at: new Date().toISOString()
          };
      
          // Update the tokens in the database
          const { error: updateError } = await supabase
            .from('creator_profiles')
        .update({
              youtube_account: updatedAccount
            })
            .eq('id', submission.creator_profile.id);

          if (updateError) {
            console.error(`Error updating tokens for creator ${submission.creator_profile.id}:`, updateError);
            continue;
          }

          // Use the updated access token
          youtube_account.access_token = tokens.access_token;
        }

        // Get video metrics using the current access token
        const metrics = await getVideoMetrics(youtube_account.access_token, submission.video_id);
      
        if (!metrics) {
          console.log(`No metrics found for video ${submission.video_id}, skipping...`);
          continue;
        }
        
        // Prepare data for update
        const updateData = {
          views: metrics.views,
          other_stats: { 
            youtube: {
              likes: metrics.likes,
              comments: metrics.comments,
              // Storing views here too for completeness within the platform-specific stats
              views: metrics.views 
            }
          },
          last_insights_update: new Date().toISOString()
        };

        console.log("updateData", updateData);
        // Update submission metrics
        const { error: metricsError } = await supabase
          .from('submissions')
          .update(updateData)
          .eq('id', submission.id);
          
        if (metricsError) {
          console.error(`Error updating metrics for submission ${submission.id}:`, metricsError);
          continue;
        }

        console.log(`Successfully updated metrics for submission ${submission.id}`);

      } catch (submissionError) {
        console.error(`Error processing submission ${submission.id}:`, submissionError);
      }
    }

    console.log('Metrics update completed successfully');
  } catch (error) {
    console.error('Error in updateMetrics:', error);
  }
}

// Run the update
updateMetrics()
  .then(() => {
    console.log('YouTube metrics update process completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in YouTube metrics update process:', err);
    process.exit(1);
  }); 
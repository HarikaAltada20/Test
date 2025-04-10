import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { createOAuthClient, getVideoStats } from '../lib/youtube-api';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshToken(refreshToken: string) {
  const oauth2Client = await createOAuthClient();
  
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return credentials;
}

interface YouTubeAccount {
  id: string;
  creator_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface Submission {
  id: string;
  video_id: string;
  creator_youtube_accounts: YouTubeAccount;
}

async function updateMetrics() {
  console.log('Starting YouTube metrics update...');
  
  // Get all submissions with YouTube video IDs
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('id, video_id, creator_youtube_accounts!inner(*)')
    .not('video_id', 'is', null);
  
  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }
  
  if (!submissions || submissions.length === 0) {
    console.log('No submissions with YouTube videos found');
    return;
  }
  
  console.log(`Found ${submissions.length} submissions to update`);
  
  for (const submission of submissions as unknown as Submission[]) {
    try {
      console.log(`Processing submission ${submission.id} with video ${submission.video_id}...`);
      
      // Get fresh access token
      const tokens = await refreshToken(submission.creator_youtube_accounts.refresh_token);
      
      // Update access token in database
      await supabase
        .from('creator_youtube_accounts')
        .update({
          access_token: tokens.access_token,
          expires_at: new Date(Date.now() + ((tokens as any).expires_in * 1000)).toISOString()
        })
        .eq('id', submission.creator_youtube_accounts.id);
      
      // Get video stats using our utility function
      const stats = await getVideoStats(submission.video_id, tokens.access_token!);
      
      if (stats) {
        console.log(`Updating metrics for video ${submission.video_id}:`, stats);
        
        // Update submission with latest metrics
        await supabase
          .from('submissions')
          .update({
            current_views: parseInt(stats.viewCount || '0'),
            like_count: parseInt(stats.likeCount || '0'),
            comment_count: parseInt(stats.commentCount || '0'),
            last_metrics_update: new Date().toISOString()
          })
          .eq('id', submission.id);
          
        console.log(`Successfully updated metrics for submission ${submission.id}`);
      } else {
        console.log(`No statistics found for video ${submission.video_id}`);
      }
    } catch (error) {
      console.error(`Error updating metrics for submission ${submission.id}:`, error);
    }
  }
  
  console.log('Metrics update completed');
}

// Run the update
updateMetrics()
  .then(() => {
    console.log('YouTube metrics update process completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in YouTube metrics update process:', err);
    process.exit(1);
  }); 
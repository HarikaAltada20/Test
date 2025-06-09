import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { METRICS_REFRESH_COOLDOWN_MS } from '@/lib/constants';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const resolvedParams = await params;
    const contestId = resolvedParams.id;
    const now = new Date();

    // Get contest details including last metrics update time
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, title, platform, advertiser_id, last_metrics_updated')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    // Check if user has access (either owns the contest or is viewing opportunities)
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const isOwner = contest.advertiser_id === authUser?.id;
    
    // For opportunities side, we'll allow any authenticated user to refresh
    // For owner side, we'll check ownership
    const isOpportunitiesRefresh = request.headers.get('x-refresh-source') === 'opportunities';
    
    if (!isOpportunitiesRefresh && !isOwner) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Database-based rate limiting using last_metrics_updated
    if (contest.last_metrics_updated) {
      const lastUpdate = new Date(contest.last_metrics_updated);
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();
      
      if (timeSinceLastUpdate < METRICS_REFRESH_COOLDOWN_MS) {
        const remainingMs = METRICS_REFRESH_COOLDOWN_MS - timeSinceLastUpdate;
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        return NextResponse.json({ 
          error: `Metrics were updated ${Math.floor(timeSinceLastUpdate / 1000 / 60)} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
          nextRefreshAvailable: new Date(lastUpdate.getTime() + METRICS_REFRESH_COOLDOWN_MS).toISOString()
        }, { status: 429 });
      }
    }

    // Determine which cron job to call based on platform
    let cronEndpoint: string;
    let cronName: string;

    switch (contest.platform?.toLowerCase()) {
      case 'instagram':
        cronEndpoint = '/api/cron/update-instagram-insights';
        cronName = 'Instagram Insights';
        break;
      case 'youtube':
        cronEndpoint = '/api/cron/update-youtube-metrics';
        cronName = 'YouTube Metrics';
        break;
      default:
        return NextResponse.json({ 
          error: `Metrics refresh not supported for platform: ${contest.platform}` 
        }, { status: 400 });
    }

    // Call the appropriate cron job with contest-specific parameter
    const baseUrl = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const cronUrl = `${protocol}://${baseUrl}${cronEndpoint}?contestId=${contestId}`;

    console.log(`Manual refresh triggered for contest ${contestId} (${contest.title}) - calling ${cronName} - Source: ${isOpportunitiesRefresh ? 'Opportunities' : 'Owner'}`);

    const cronResponse = await fetch(cronUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
        'X-Contest-Id': contestId
      }
    });

    if (!cronResponse.ok) {
      const errorText = await cronResponse.text();
      console.error(`Cron job failed for contest ${contestId}:`, errorText);
      return NextResponse.json({ 
        error: `Failed to refresh ${cronName.toLowerCase()}` 
      }, { status: 500 });
    }

    const cronResult = await cronResponse.json();
    const currentTime = new Date().toISOString();

    // Update the contest's last_metrics_updated timestamp
    const { error: updateError } = await supabase
      .from('contests')
      .update({ last_metrics_updated: currentTime })
      .eq('id', contestId);

    if (updateError) {
      console.error(`Failed to update last_metrics_updated for contest ${contestId}:`, updateError);
      // Don't fail the request, just log the error
    } else {
      console.log(`Updated last_metrics_updated for contest ${contestId} to ${currentTime}`);
    }

    console.log(`Successfully refreshed metrics for contest ${contestId}`);

    return NextResponse.json({
      success: true,
      message: `${cronName} refreshed successfully`,
      contestId,
      contestTitle: contest.title,
      platform: contest.platform,
      nextRefreshAvailable: new Date(now.getTime() + METRICS_REFRESH_COOLDOWN_MS).toISOString(),
      timeSinceLastUpdate: contest.last_metrics_updated ? 
        Math.floor((now.getTime() - new Date(contest.last_metrics_updated).getTime()) / 1000 / 60) : null,
      lastMetricsUpdated: currentTime,
      cronResult
    });

  } catch (error: any) {
    console.error('Error in refresh-metrics API:', error);
    return NextResponse.json(
      { error: `Refresh failed: ${error.message}` },
      { status: 500 }
    );
  }
} 
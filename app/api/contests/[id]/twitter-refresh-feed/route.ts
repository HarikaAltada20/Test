import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES } from '@/lib/constants';

export const dynamic = "force-dynamic";

// IMPORTANT: This endpoint triggers Twitter API calls
// This is called ONLY when "Refresh Feed" button is clicked
// All other operations (tab switch, pagination) only read from DB
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contestId } = await params;
    const now = new Date();

    // Get contest details including last metrics update time
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, title, platform, last_metrics_updated')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    // Check cooldown period (1 hour for feed refresh)
    const cooldownMs = METRICS_REFRESH_COOLDOWN_MS_OPPORTUNITIES; // 60 minutes

    if (contest.last_metrics_updated) {
      const lastUpdate = new Date(contest.last_metrics_updated);
      const timeSinceLastUpdate = now.getTime() - lastUpdate.getTime();
      
      if (timeSinceLastUpdate < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastUpdate;
        const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);
        return NextResponse.json({ 
          error: `Feed was updated ${Math.floor(timeSinceLastUpdate / 1000 / 60)} minutes ago. Please wait ${remainingMinutes} more minutes before refreshing again.`,
          nextRefreshAvailable: new Date(lastUpdate.getTime() + cooldownMs).toISOString(),
        }, { status: 429 });
      }
    }

    // This triggers Twitter API calls via twitter-refresh-tweets endpoint
    const baseUrl = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const refreshUrl = `${protocol}://${baseUrl}/api/contests/${contestId}/twitter-refresh-tweets`;

    console.log(`Manual feed refresh triggered for contest ${contestId} (${contest.title})`);

    // Forward cookies from original request to maintain authentication
    const cookieHeader = request.headers.get('cookie');
    const refreshResponse = await fetch(refreshUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error(`Twitter refresh failed for contest ${contestId}:`, errorText);
      return NextResponse.json({ 
        error: 'Failed to refresh Twitter feed' 
      }, { status: 500 });
    }

    const refreshResult = await refreshResponse.json();

    console.log(`Successfully refreshed Twitter feed for contest ${contestId}`);

    // Get updated contest data to return last_metrics_updated
    const { data: updatedContest } = await supabase
      .from('contests')
      .select('last_metrics_updated')
      .eq('id', contestId)
      .single();

    return NextResponse.json({
      success: true,
      message: 'Twitter feed refreshed successfully',
      contestId,
      contestTitle: contest.title,
      nextRefreshAvailable: new Date(now.getTime() + cooldownMs).toISOString(),
      lastMetricsUpdated: updatedContest?.last_metrics_updated || null,
      refreshResult
    });

  } catch (error: any) {
    console.error('Error in twitter-refresh-feed API:', error);
    return NextResponse.json(
      { error: `Refresh failed: ${error.message}` },
      { status: 500 }
    );
  }
}


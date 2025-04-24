import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

// Revalidate data every 60 seconds
export async function GET(
  request: Request
) {
  const cookieStore = await cookies();

  // Extract contestId from URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const contestId = pathSegments[pathSegments.length - 1]; // Assumes ID is the last segment

  console.log('Extracted contestId from URL:', contestId);

  // Check for required environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key missing from environment variables.');
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 }
    );
  }

  // Create a standard Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Manually set the session from the auth token cookie
  const token = cookieStore.get('sb-rjprmbjqetxkramwbrqo-auth-token'); // Replace with your actual cookie name if different
  if (token?.value) {
    try {
        // The auth token cookie value seems to be base64 encoded JSON string containing access_token and refresh_token
        // Decoding and parsing it
        const cookieValue = JSON.parse(Buffer.from(token.value.replace('base64-', ''), 'base64').toString('utf8'));
        if (cookieValue.access_token && cookieValue.refresh_token) {
            await supabase.auth.setSession({
                access_token: cookieValue.access_token,
                refresh_token: cookieValue.refresh_token,
            });
        } else {
            console.warn('Auth token cookie found, but access_token or refresh_token missing.');
        }
    } catch(parseError) {
        console.error('Failed to parse auth token cookie:', parseError);
        // Decide if you want to return an error or proceed unauthenticated
        // return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }
  }

  if (!contestId) {
    return NextResponse.json({ error: 'Contest ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch all submissions for the contest
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        creator_id,
        video_title,
        video_thumbnail_url,
        views,
        earnings,
        status,
        created_at,
        content_link
      `)
      .eq('contest_id', contestId)
      .order('views', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
    }

    if (!submissions || submissions.length === 0) {
        // No submissions yet, return empty leaderboard
        return NextResponse.json({ 
            leaderboard: [],
            lastUpdated: new Date().toISOString() 
        });
    }

    // 2. Extract unique creator IDs (which should match auth.users.id / users.id)
    const creatorIds = [...new Set(submissions.map(sub => sub.creator_id))];

    // 3. Fetch corresponding user profiles from the 'users' table
    const { data: usersData, error: usersError } = await supabase
        .from('users') // <--- Changed to 'users' table
        .select('id, username, profile_picture_url, full_name') // <-- Selected correct columns
        .in('id', creatorIds);

     if (usersError) {
        console.error('Error fetching users:', usersError);
        // Log error but continue
     }

    // 4. Create user lookup map
    const usersMap = new Map(usersData?.map(user => [user.id, user]) || []);

    // 5. Combine submissions with user data
    const leaderboardData = submissions.map(submission => ({
        ...submission,
        // Use 'users' field, default to null
        users: usersMap.get(submission.creator_id) || null 
    }));

    // Data is already sorted by views from the first query

    // 6. Return the combined data
    return NextResponse.json({ 
      leaderboard: leaderboardData,
      lastUpdated: new Date().toISOString() 
    });

  } catch (error: any) {
    console.error('Error in leaderboard endpoint:', error);
    return NextResponse.json(
      { error: `Failed to fetch leaderboard: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 
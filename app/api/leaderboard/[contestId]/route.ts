import { createClient } from '@supabase/supabase-js'; // Revert to basic client
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

// Revalidate data every 60 seconds
export async function GET(
  request: Request
) {
  const cookieStore = cookies();

  // Extract contestId from URL
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const contestId = pathSegments[pathSegments.length - 1]; // Assumes ID is the last segment

  console.log('(Using Anon Client) Extracted contestId from URL:', contestId);

  // Revert to basic Anon client for diagnosis
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
     console.error('Supabase URL or Anon Key missing');
     return NextResponse.json({ error: 'Server config error' }, { status: 500 });
   }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
      console.error('(Anon Client) Error fetching submissions:', submissionsError);
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
        console.error('(Anon Client) Error fetching users data:', usersError);
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
    console.error('(Anon Client) Error in leaderboard endpoint:', error);
    return NextResponse.json(
      { error: `Failed to fetch leaderboard: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 
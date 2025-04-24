import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Revalidate data every 60 seconds
export const revalidate = 60;

export async function GET(
  request: Request,
  { params }: { params: { contestId: string } }
) {
  const contestId = params.contestId;
  const cookieStore = cookies(); 
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

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
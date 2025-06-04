import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Force dynamic rendering

// Revalidate data every 60 seconds
export async function GET(
  request: Request
) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const contestId = pathSegments[pathSegments.length - 1];

  // Pagination parameters
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '25', 10); // Default limit to 25
  const from = (page - 1) * limit;
  const to = page * limit - 1;

  // console.log(`(Using Anon Client) Extracted contestId: ${contestId}, Page: ${page}, Limit: ${limit}, From: ${from}, To: ${to}`);

  if (!contestId) {
    return NextResponse.json({ error: 'Contest ID is required' }, { status: 400 });
  }

  try {
    // 1. Fetch total count of submissions for the contest
    const { count: totalEntries, error: countError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId);

    if (countError) {
      console.error('(Anon Client) Error fetching submission count:', countError);
      throw new Error(`Failed to fetch submission count: ${countError.message}`);
    }
    
    const totalPages = totalEntries ? Math.ceil(totalEntries / limit) : 0;

    // 2. Fetch paginated submissions for the contest
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
        content_link,
        platform
      `)
      .eq('contest_id', contestId)
      .order('views', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .range(from, to); // Apply pagination

    if (submissionsError) {
      console.error('(Anon Client) Error fetching submissions:', submissionsError);
      throw new Error(`Failed to fetch submissions: ${submissionsError.message}`);
    }

    if (!submissions || submissions.length === 0) {
        return NextResponse.json({ 
            leaderboard: [],
            lastUpdated: new Date().toISOString(),
            currentPage: page,
            totalPages: totalPages,
            totalEntries: totalEntries || 0
        });
    }

    // 3. Extract unique creator IDs from the current page of submissions
    const creatorIds = [...new Set(submissions.map(sub => sub.creator_id))];

    // 4. Fetch corresponding user profiles from the 'users' table
    const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, profile_picture_url, full_name')
        .in('id', creatorIds);

     if (usersError) {
        console.error('(Anon Client) Error fetching users data:', usersError);
     }
     
    // 5. Fetch corresponding creator profiles from 'creator_profiles'
    const { data: creatorProfilesData, error: creatorProfilesError } = await supabase
        .from('creator_profiles')
        .select('id, youtube_account, instagram_account')
        .in('id', creatorIds);

    if (creatorProfilesError) {
        console.error('(Anon Client) Error fetching creator profiles data:', creatorProfilesError);
    }

    // 6. Create lookup maps
    const usersMap = new Map(usersData?.map(user => [user.id, user]) || []);
    const creatorProfilesMap = new Map(creatorProfilesData?.map(profile => [profile.id, profile]) || []);

    // 7. Combine submissions with user and creator profile data
    const leaderboardData = submissions.map(submission => {
      const userProfile = usersMap.get(submission.creator_id) || null;
      const creatorProfile = creatorProfilesMap.get(submission.creator_id) || null;
      let creator_pfp_url = null;

      if (creatorProfile && submission.platform) {
        if (submission.platform === 'youtube') {
          creator_pfp_url = creatorProfile.youtube_account?.channel_thumbnail || null;
        } else if (submission.platform === 'instagram') {
          creator_pfp_url = creatorProfile.instagram_account?.profile_picture_url || null;
        }
      }

      return {
        ...submission,
        user_platform_username: userProfile?.username || 'N/A',
        user_full_name: userProfile?.full_name || 'Anonymous User',
        creator_pfp_url: creator_pfp_url,
        user_platform_pfp_url: userProfile?.profile_picture_url || null,
      };
    });

    // 8. Return the combined data with pagination info
    return NextResponse.json({ 
      leaderboard: leaderboardData,
      lastUpdated: new Date().toISOString(),
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries || 0
    });

  } catch (error: any) {
    console.error('(Anon Client) Error in leaderboard endpoint:', error);
    return NextResponse.json(
      { error: `Failed to fetch leaderboard: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 
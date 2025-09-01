import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  context: { params: { contestId: string } }
) {
  const supabase = await createClient();
  const params = await context.params;
  const contestId = params?.contestId;

  if (!contestId) {
    return NextResponse.json({ error: 'Contest ID is required or missing in URL' }, { status: 400 });
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  try {
    // 1. First fetch contest details to determine contest type
    const { data: contestData, error: contestError } = await supabase
      .from('contests')
      .select('id, contest_type')
      .eq('id', contestId)
      .single();

    if (contestError) {
      console.error('Error fetching contest details:', contestError);
      throw new Error(`Failed to fetch contest details: ${contestError.message}`);
    }

    if (!contestData) {
      throw new Error('Contest not found');
    }

    // 2. Fetch the user's submission for the contest
    const { data: mySubmission, error: submissionError } = await supabase
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
        platform,
        other_stats
      `)
      .eq('contest_id', contestId)
      .eq('creator_id', user.id)
      .maybeSingle();

    if (submissionError) {
      console.error(`Error fetching user's submission for contest ${contestId} and user ${user.id}:`, submissionError);
      throw new Error(`Failed to fetch user submission: ${submissionError.message}`);
    }

    if (!mySubmission) {
      // User has not submitted to this contest
      return NextResponse.json({ mySubmission: null, rank: null });
    }

    // 3. Calculate the user's rank based on contest type
    // Public rank should exclude rejected submissions for all contest types
    let rankQuery = supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('contest_id', contestId);

    // Exclude rejected submissions for both leaderboard and CPM
    rankQuery = rankQuery.neq('status', 'rejected');

    const { count: higherRankedCount, error: rankError } = await rankQuery
      .or(`views.gt.${mySubmission.views},and(views.eq.${mySubmission.views},created_at.lt.${mySubmission.created_at})`);

    if (rankError) {
      console.error(`Error calculating rank for user ${user.id} in contest ${contestId}:`, rankError);
      throw new Error(`Failed to calculate rank: ${rankError.message}`);
    }

    // Now both verified and pending submissions get ranks in CPM contests
    const rank = (higherRankedCount ?? 0) + 1;

    // 4. Fetch user's general profile info from 'users' table
    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('id, username, profile_picture_url, full_name')
      .eq('id', user.id)
      .single();

    if (userProfileError) {
        console.warn(`Warning: Could not fetch user profile for ${user.id}: ${userProfileError.message}`);
    }
    
    // 5. Fetch user's creator profile info for PFP
    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from('creator_profiles')
      .select('id, youtube_account, instagram_account')
      .eq('id', user.id)
      .maybeSingle();

    if (creatorProfileError) {
        console.warn(`Warning: Could not fetch creator profile for ${user.id}: ${creatorProfileError.message}`);
    }

    let creator_pfp_url = null;
    if (creatorProfile && mySubmission.platform) {
      if (mySubmission.platform === 'youtube' && creatorProfile.youtube_account) {
        creator_pfp_url = creatorProfile.youtube_account.channel_thumbnail || null;
      } else if (mySubmission.platform === 'instagram' && creatorProfile.instagram_account) {
        creator_pfp_url = creatorProfile.instagram_account.profile_picture_url || null;
      }
    }
    
    const combinedSubmissionData = {
      ...mySubmission,
      user_platform_username: userProfile?.username || 'N/A',
      user_full_name: userProfile?.full_name || 'Anonymous User',
      creator_pfp_url: creator_pfp_url,
      user_platform_pfp_url: userProfile?.profile_picture_url || null,
    };

    return NextResponse.json({ mySubmission: combinedSubmissionData, rank });

  } catch (error: any) {
    console.error(`Error in /my-submission endpoint for contest ${contestId}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch user's submission data: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 
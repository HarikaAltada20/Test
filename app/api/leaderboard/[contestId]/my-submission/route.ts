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

    const { data: mySubmissions, error: submissionError } = await supabase
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
        other_stats,
        video_id
      `)
      .eq('contest_id', contestId)
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (submissionError) {
      console.error(`Error fetching user's submissions for contest ${contestId} and user ${user.id}:`, submissionError);
      throw new Error(`Failed to fetch user submissions: ${submissionError.message}`);
    }

    if (!mySubmissions || mySubmissions.length === 0) {
      return NextResponse.json({ mySubmission: null, submissions: [], rank: null });
    }

    const mySubmission = mySubmissions[0];
    const submissionIds = mySubmissions.map((s) => s.id);

    /** One DB round-trip: all submission ranks for this user + creator-wise stats (see migration). */
    const { data: snapshot, error: snapshotError } = await supabase.rpc(
      'contest_my_leaderboard_snapshot',
      {
        p_contest_id: contestId,
        p_creator_id: user.id,
        p_submission_ids: submissionIds,
      },
    );

    if (snapshotError) {
      console.error('[my-submission] contest_my_leaderboard_snapshot:', snapshotError);
      throw new Error(
        `Leaderboard snapshot failed: ${snapshotError.message}. Ensure migration 20260329_contest_leaderboard_snapshot_functions.sql is applied.`,
      );
    }

    const snap = snapshot as {
      submission_ranks?: Record<string, number | null>;
      creator_wise?: {
        total_views?: number;
        total_earnings?: number;
        creator_rank?: number;
      } | null;
    } | null;

    const ranksMap = snap?.submission_ranks ?? {};
    const leaderboardRanks = mySubmissions.map((s) => {
      if (s.status === 'rejected') return null;
      const raw = ranksMap[s.id];
      return typeof raw === 'number' ? raw : null;
    });

    const rank = leaderboardRanks[0] ?? null;

    const cw = snap?.creator_wise;
    const creator_wise_total_views =
      cw != null && typeof cw.total_views === 'number' ? cw.total_views : null;
    const creator_wise_total_earnings =
      cw != null && typeof cw.total_earnings === 'number' ? cw.total_earnings : null;
    const creator_wise_rank =
      cw != null && typeof cw.creator_rank === 'number' ? cw.creator_rank : null;

    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('id, username, profile_picture_url, full_name')
      .eq('id', user.id)
      .single();

    if (userProfileError) {
        console.warn(`Warning: Could not fetch user profile for ${user.id}: ${userProfileError.message}`);
    }
    
    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from('creator_profiles')
      .select('id, youtube_account, instagram_account')
      .eq('id', user.id)
      .maybeSingle();

    if (creatorProfileError) {
        console.warn(`Warning: Could not fetch creator profile for ${user.id}: ${creatorProfileError.message}`);
    }

    let creator_pfp_url: string | null = null;
    if (creatorProfile && mySubmission.platform) {
      if (mySubmission.platform === 'youtube' && creatorProfile.youtube_account) {
        creator_pfp_url = creatorProfile.youtube_account.channel_thumbnail || null;
      } else if (mySubmission.platform === 'instagram' && creatorProfile.instagram_account) {
        creator_pfp_url = creatorProfile.instagram_account.profile_picture_url || null;
      }
    }
    
    const combinedSubmissionData = {
      ...mySubmission,
      leaderboard_rank: leaderboardRanks[0] ?? null,
      user_platform_username: userProfile?.username || 'N/A',
      user_full_name: userProfile?.full_name || 'Anonymous User',
      creator_pfp_url: creator_pfp_url,
      user_platform_pfp_url: userProfile?.profile_picture_url || null,
    };

    const combinedSubmissions = mySubmissions.map((submission, i) => ({
      ...submission,
      leaderboard_rank: leaderboardRanks[i] ?? null,
      user_platform_username: userProfile?.username || 'N/A',
      user_full_name: userProfile?.full_name || 'Anonymous User',
      creator_pfp_url: creator_pfp_url,
      user_platform_pfp_url: userProfile?.profile_picture_url || null,
      content_url: submission.content_link,
    }));

    return NextResponse.json({ 
      mySubmission: combinedSubmissionData, 
      submissions: combinedSubmissions,
      rank,
      creator_wise_total_views,
      creator_wise_total_earnings,
      creator_wise_rank,
    });

  } catch (error: any) {
    console.error(`Error in /my-submission endpoint for contest ${contestId}:`, error);
    return NextResponse.json(
      { error: `Failed to fetch user's submission data: ${error.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
} 

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const { submissionId, action, reason } = await request.json();
    
    if (!submissionId || !action) {
      return NextResponse.json({ error: 'Submission ID and action are required' }, { status: 400 });
    }

    if (!['verified', 'rejected', 'pending'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be verified, rejected, or pending' }, { status: 400 });
    }

    // Verify admin access first
    const { isAdmin, error: adminError, user: adminUser } = await verifyAdminAccess();
    
    let currentUserId: string;
    
    if (!isAdmin) {
      // If not admin, check if it's an advertiser managing their own contest
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !authUser) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', authUser.id)
        .single();

      if (userDataError || !userData || userData.user_type !== 'advertiser') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      // For advertisers, verify they own the contest associated with this submission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .select('contest_id, contests!inner(advertiser_id)')
        .eq('id', submissionId)
        .single();

      if (submissionError || !submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }

      if ((submission as any).contests.advertiser_id !== authUser.id) {
        return NextResponse.json({ error: 'You can only manage submissions for your own contests' }, { status: 403 });
      }
      
      currentUserId = authUser.id;
    } else {
      currentUserId = adminUser?.id || '';
    }

    // Fetch the submission to verify it exists
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('id, contest_id, creator_id, status')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Fetch the contest to check its type
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('contest_type')
      .eq('id', submission.contest_id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    // Only allow verification for CPM contests
    if (contest.contest_type !== 'cpm') {
      return NextResponse.json({ 
        error: 'Verification is only applicable to CPM-based contests' 
      }, { status: 400 });
    }

    // Update the submission status
    const updateData: any = {
      status: action,
      verified_at: action === 'verified' ? new Date().toISOString() : null,
    };

    // Add rejection reason if rejecting
    if (action === 'rejected' && reason) {
      updateData.rejection_reason = reason;
    } else if (action !== 'rejected') {
      updateData.rejection_reason = null; // Clear rejection reason if not rejecting
    }

    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission status:', updateError);
      return NextResponse.json({ error: 'Failed to update submission status' }, { status: 500 });
    }

    // Note: With the new system, verified and pending submissions show in leaderboard immediately
    // Only rejected submissions are hidden from public view

    // Log the verification action (optional - for audit trail)
    if (currentUserId) {
      const { error: logError } = await supabase
        .from('verification_logs')
        .insert({
          submission_id: submissionId,
          admin_id: currentUserId,
          action: action,
          reason: reason || null,
          performed_at: new Date().toISOString()
        });

      if (logError) {
        console.warn('Failed to log verification action:', logError);
        // Don't fail the request if logging fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      submission: updatedSubmission,
      message: `Submission ${action} successfully${action === 'rejected' ? ' and will be hidden from leaderboard' : ''}`
    });

  } catch (error: any) {
    console.error('Error in verification endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// GET endpoint to fetch submissions for verification based on status filter
export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  
  try {
    // Get current user and check if they have admin privileges
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin or advertiser
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    if (userData.user_type !== 'admin' && userData.user_type !== 'advertiser') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch submissions for verification from CPM contests only
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        creator_id,
        contest_id,
        video_title,
        video_thumbnail_url,
        content_link,
        platform,
        views,
        earnings,
        status,
        created_at,
        verified_at,
        rejection_reason,
        contests!inner(
          title,
          contest_type
        ),
        users!creator_id(
          username,
          full_name
        )
      `)
      .eq('status', status)
      .eq('contests.contest_type', 'cpm')
      .order('created_at', { ascending: false });

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
    }

    return NextResponse.json({ 
      submissions: submissions || [],
      status: status 
    });

  } catch (error: any) {
    console.error('Error in GET /api/admin/verify-submission:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 
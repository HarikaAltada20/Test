import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  try {
    const { submissionId, action, reason, paymentDetails } = await request.json();
    
    if (!submissionId || !action) {
      return NextResponse.json({ error: 'Submission ID and action are required' }, { status: 400 });
    }

    if (!['verified', 'rejected', 'pending', 'paid'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be verified, rejected, pending, or paid' }, { status: 400 });
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

    // Allow status updates for both leaderboard and CPM contests
    if (!contest.contest_type || !['leaderboard', 'cpm'].includes(contest.contest_type)) {
      return NextResponse.json({ 
        error: 'Invalid contest type. Only leaderboard and CPM contests are supported' 
      }, { status: 400 });
    }

    // Update the submission status
    const updateData: any = {
      status: action,
    };

    // Use the metadata column to store structured metadata as JSON
    if (action === 'rejected' && reason) {
      // Parse reason and additional notes if they exist
      const reasonParts = reason.split('\n\nAdditional Notes:');
      const mainReason = reasonParts[0].trim();
      const additionalNotes = reasonParts[1] ? reasonParts[1].trim() : null;
      
      // Map predefined reason values to their human-readable labels
      const PREDEFINED_REASONS = {
        'content_guidelines': 'Content Guidelines Violation',
        'quality_standards': 'Quality Standards Not Met',
        'brand_guidelines': 'Brand Guidelines Violation',
        'inappropriate_content': 'Inappropriate Content',
        'copyright_issues': 'Copyright Issues',
        'technical_issues': 'Technical Issues',
        'off_topic': 'Off Topic',
        'duplicate_content': 'Duplicate Content',
        'incomplete_submission': 'Incomplete Submission',
        'other': 'Other Reason'
      };
      
      // Use the human-readable label if it's a predefined reason, otherwise use as-is
      const displayReason = PREDEFINED_REASONS[mainReason as keyof typeof PREDEFINED_REASONS] || mainReason;
      
      // Store rejection metadata
      updateData.metadata = {
        type: 'rejection',
        reason: displayReason,
        additionalNotes: additionalNotes,
        timestamp: new Date().toISOString(),
        updatedBy: currentUserId
      };
    } else if (action === 'paid' && paymentDetails) {
      // Store payment metadata
      updateData.metadata = {
        type: 'payment',
        paymentProofUrl: paymentDetails.paymentProofUrl || null,
        paymentDescription: paymentDetails.paymentDescription || null,
        timestamp: new Date().toISOString(),
        updatedBy: currentUserId
      };
    } else if (action === 'verified' || action === 'pending') {
      // Clear metadata for verified/pending status
      updateData.metadata = null;
    }

    // Use admin client to bypass RLS for the update operation
    const supabaseAdmin = createAdminClient();
    const { data: updatedSubmission, error: updateError } = await supabaseAdmin
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
      message: `Submission ${action} successfully${action === 'rejected' ? ` with reason: ${reason}` : ''}`
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

    // Fetch submissions for verification from both leaderboard and CPM contests
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
         metadata,
        created_at,
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
      .in('contests.contest_type', ['leaderboard', 'cpm'])
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
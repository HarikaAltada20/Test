import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { verifyAdminAccess } from '@/utils/admin-auth';

// POST: Admin approve/reject contest
export async function POST(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, user: adminUser } = await verifyAdminAccess();
    
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { contestId, action, reason } = await request.json();

    if (!contestId || !action) {
      return NextResponse.json({ error: 'Contest ID and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 });
    }

    if (action === 'reject' && !reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // First, verify the contest exists and is pending approval
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, title, moderation_status, advertiser_id')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    if (contest.moderation_status !== 'pending_approval') {
      return NextResponse.json({ 
        error: 'Contest is not in pending approval status' 
      }, { status: 400 });
    }

    // Update contest moderation status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    
    const updateData: any = {
      moderation_status: newStatus,
    };

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = adminUser.id;
    } else {
      updateData.rejection_reason = reason;
    }

    const { error: updateError } = await supabase
      .from('contests')
      .update(updateData)
      .eq('id', contestId);

    if (updateError) {
      console.error('Error updating contest moderation status:', updateError);
      return NextResponse.json({ error: 'Failed to update contest status' }, { status: 500 });
    }

    // TODO: Send email notification to advertiser about approval/rejection
    // This would be implemented based on your email service

    return NextResponse.json({ 
      success: true, 
      action,
      contestId,
      message: action === 'approve' 
        ? 'Contest approved successfully. Brand can now publish it.'
        : 'Contest rejected. Brand will be notified to make changes.'
    });

  } catch (error) {
    console.error('Error in contest moderation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get contests pending admin approval
export async function GET(request: Request) {
  try {
    // Verify admin access
    const { isAdmin, user: adminUser } = await verifyAdminAccess();
    
    if (!isAdmin || !adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const url = new URL(request.url);
    // Default to 'all' so the All tab can omit the status query param
    const status = url.searchParams.get('status') || 'all';

    const supabase = await createClient();

    // Fetch contests based on moderation status
    let query = supabase
      .from('contests_with_status')
      .select(`
        *,
        advertiser_profiles!advertiser_id(company_name, id)
      `)
      .order('submitted_for_approval_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('moderation_status', status);
    }

    const { data: contests, error } = await query;

    if (error) {
      console.error('Error fetching contests for moderation:', error);
      return NextResponse.json({ error: 'Failed to fetch contests' }, { status: 500 });
    }

    // Separately fetch approved_by user info for contests that have it
    const contestsWithApprover = await Promise.all(
      contests.map(async (contest) => {
        let approvedByName = null;
        if (contest.approved_by) {
          const { data: approver } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', contest.approved_by)
            .single();
          approvedByName = approver?.full_name || null;
        }
        return { ...contest, approved_by_name: approvedByName };
      })
    );

    // Format the data for the frontend
    const formattedContests = contestsWithApprover.map(contest => ({
      id: contest.id,
      title: contest.title,
      platform: contest.platform,
      contest_type: contest.contest_type,
      moderation_status: contest.moderation_status,
      status: contest.status,
      created_at: contest.created_at,
      submitted_for_approval_at: contest.submitted_for_approval_at,
      approved_at: contest.approved_at,
      approved_by_name: contest.approved_by_name,
      published_at: contest.published_at,
      rejection_reason: contest.rejection_reason,
      thumbnail_url: contest.thumbnail_url,
      brief_html: contest.brief_html,
      start_date: contest.start_date,
      end_date: contest.end_date,
      advertiser_name: contest.advertiser_profiles?.company_name || 'Unknown Brand',
      advertiser_id: contest.advertiser_id,
      contest_based_details: contest.contest_based_details
    }));

    return NextResponse.json({ 
      contests: formattedContests,
      total: formattedContests.length 
    });

  } catch (error) {
    console.error('Error fetching contests for moderation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
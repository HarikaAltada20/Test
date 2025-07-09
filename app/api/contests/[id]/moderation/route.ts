import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// POST: Brand submit contest for approval or publish approved contest
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resolvedParams = await params;
    const contestId = resolvedParams.id;
    const { action } = await request.json();

    if (!action || !['submit_for_approval', 'publish'].includes(action)) {
      return NextResponse.json({ 
        error: 'Action must be submit_for_approval or publish' 
      }, { status: 400 });
    }

    // Verify user owns this contest
    const { data: contest, error: contestError } = await supabase
      .from('contests_with_status')
      .select('id, title, moderation_status, advertiser_id, start_date, end_date, brief_html, rules_html, thumbnail_url, payment_details, status')
      .eq('id', contestId)
      .eq('advertiser_id', user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    if (action === 'submit_for_approval') {
      console.log('🔍 Submitting contest for approval - Contest data:', {
        title: contest.title,
        brief_html: contest.brief_html,
        start_date: contest.start_date,
        end_date: contest.end_date,
        payment_details: contest.payment_details
      });
      
      // CRITICAL: All field validation should happen BEFORE payment processing
      // Only validate payment completion here since other validations are done before payment
      
      // Validate payment has been made - this is the ONLY validation that should happen after payment
      if (!contest.payment_details) {
        console.log('❌ No payment details found');
        return NextResponse.json({ 
          error: 'Contest payment is required before submission for approval' 
        }, { status: 400 });
      }
      
      try {
        const paymentDetails = typeof contest.payment_details === 'string' 
          ? JSON.parse(contest.payment_details) 
          : contest.payment_details;
        
        console.log('💰 Payment details:', paymentDetails);
        
        if (!paymentDetails.payment_status || paymentDetails.payment_status !== 'completed') {
          console.log('❌ Payment status not completed:', paymentDetails.payment_status);
          return NextResponse.json({ 
            error: 'Contest payment must be completed before submission for approval' 
          }, { status: 400 });
        }
      } catch (err) {
        console.log('❌ Invalid payment details JSON:', err);
        return NextResponse.json({ 
          error: 'Invalid payment details' 
        }, { status: 400 });
      }

      console.log('✅ Payment validation passed - proceeding with submission');

      // Update to pending approval
      const { error } = await supabase
        .from('contests')
        .update({
          moderation_status: 'pending_approval',
          submitted_for_approval_at: new Date().toISOString()
        })
        .eq('id', contestId);

      if (error) {
        return NextResponse.json({ error: 'Failed to submit for approval' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Contest submitted for approval'
      });

    } else if (action === 'publish') {
      if (contest.moderation_status !== 'approved') {
        return NextResponse.json({ 
          error: 'Contest must be approved before publishing' 
        }, { status: 400 });
      }

      // Publish the contest
      const { error } = await supabase
        .from('contests')
        .update({
          moderation_status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', contestId);

      if (error) {
        return NextResponse.json({ error: 'Failed to publish contest' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true,
        message: 'Contest published successfully'
      });
    }

  } catch (error) {
    console.error('Error in contest moderation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Get contest moderation status and history
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const resolvedParams = await params;
    const contestId = resolvedParams.id;

    // Check user type and permissions
    const { data: userData } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isAdmin = userData.user_type === 'admin';
    const isAdvertiser = userData.user_type === 'advertiser';

    if (!isAdmin && !isAdvertiser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get contest with moderation info
    let contestQuery = supabase
      .from('contests_with_status')
      .select(`
        id, title, moderation_status, status, advertiser_id,
        submitted_for_approval_at, approved_at, approved_by, published_at,
        rejection_reason, last_edit_after_approval,
        users!approved_by(full_name)
      `)
      .eq('id', contestId);

    // Advertisers can only see their own contests
    if (isAdvertiser) {
      contestQuery = contestQuery.eq('advertiser_id', user.id);
    }

    const { data: contest, error: contestError } = await contestQuery.single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found or access denied' }, { status: 404 });
    }

    // Get moderation history
    const { data: moderationLogs, error: logsError } = await supabase
      .from('contest_moderation_logs')
      .select(`
        id, action, previous_status, new_status, reason, created_at,
        users!admin_id(full_name)
      `)
      .eq('contest_id', contestId)
      .order('created_at', { ascending: false });

    if (logsError) {
      console.warn('Failed to fetch moderation logs:', logsError);
    }

    // Format the response
    const response = {
      contest: {
        id: contest.id,
        title: contest.title,
        moderation_status: contest.moderation_status,
        status: contest.status,
        submitted_for_approval_at: contest.submitted_for_approval_at,
        approved_at: contest.approved_at,
        approved_by_name: (contest.users as any)?.full_name || null,
        published_at: contest.published_at,
        rejection_reason: contest.rejection_reason,
        last_edit_after_approval: contest.last_edit_after_approval
      },
      moderation_history: (moderationLogs || []).map(log => ({
        id: log.id,
        action: log.action,
        previous_status: log.previous_status,
        new_status: log.new_status,
        reason: log.reason,
        created_at: log.created_at,
        admin_name: (log.users as any)?.full_name || 'System'
      }))
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching contest moderation info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
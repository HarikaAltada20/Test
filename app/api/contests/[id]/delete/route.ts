import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';

// This function will handle refunds and logging them.
// We'll need a service role client to bypass RLS for updating balances.
const supabaseService = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function issueRefund(userId: string, contestId: string, amount: number) {
  // 1. Add amount back to user's wallet
  const { data: profile, error: profileError } = await supabaseService
    .from('advertiser_profiles')
    .select('available_deposit_balance')
    .eq('id', userId)
    .single();

  if (profileError) throw new Error(`Failed to fetch user profile for refund: ${profileError.message}`);

  const newBalance = (profile.available_deposit_balance || 0) + amount;

  const { error: updateError } = await supabaseService
    .from('advertiser_profiles')
    .update({ available_deposit_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(`Failed to update user balance for refund: ${updateError.message}`);

  // 2. Log the refund transaction
  const { error: logError } = await supabaseService.from('money_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: amount,
    status: 'success',
    description: `Refund for deleted contest (ID: ${contestId})`,
    remarks: 'Contest deleted before going live.',
  });

  if (logError) {
    // If logging fails, we should still proceed, but log this critical failure.
    console.error(`CRITICAL: Failed to log refund transaction for user ${userId}, contest ${contestId}, amount ${amount}. Error: ${logError.message}`);
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const resolvedParams = await params;
  const contestId = resolvedParams.id;

  try {
    // 1. Fetch contest to check ownership and status
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, moderation_status, payment_details, thumbnail_url, resources')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    if (contest.advertiser_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 2. Check if refund is applicable
    // Refund paid contests that haven't gone live yet (draft=no payment, published=already live)
    const isRefundable = ['pending_approval', 'approved', 'rejected'].includes(contest.moderation_status);
    let refundAmount = 0;

    if (isRefundable && contest.payment_details) {
        const paymentDetails = contest.payment_details as any;
        if(paymentDetails.payment_status === 'completed' && paymentDetails.total_amount_paid > 0) {
            refundAmount = paymentDetails.total_amount_paid;
            await issueRefund(user.id, contestId, refundAmount);
        }
    }

    // 3. Clean up storage files (thumbnail and resources)
    const filesToDelete: string[] = [];
    if (contest.thumbnail_url && contest.thumbnail_url.includes('contest-assets')) {
        filesToDelete.push(contest.thumbnail_url.split('contest-assets/')[1]);
    }
    if (contest.resources) {
        Object.values(contest.resources).forEach((url: any) => {
            if (typeof url === 'string' && url.includes('contest-assets')) {
                filesToDelete.push(url.split('contest-assets/')[1]);
            }
        });
    }

    if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from('contest-assets').remove(filesToDelete);
        if (storageError) {
            // Log error but don't block deletion
            console.error(`Failed to delete storage files for contest ${contestId}: ${storageError.message}`);
        }
    }


    // 4. Delete the contest record
    const { error: deleteError } = await supabase
      .from('contests')
      .delete()
      .eq('id', contestId);

    if (deleteError) {
      throw new Error(`Failed to delete contest: ${deleteError.message}`);
    }

    const message = refundAmount > 0
        ? `Contest deleted successfully. ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(refundAmount / 100)} has been refunded to your wallet.`
        : 'Contest deleted successfully.';


    return NextResponse.json({ success: true, message: message });

  } catch (error: any) {
    console.error('Error deleting contest:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 
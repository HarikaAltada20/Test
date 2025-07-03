import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { refundContestPaymentV2, PaymentDetails } from '@/lib/payment-utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { contestId, refundAmount, reason } = body;

    if (!contestId || !refundAmount || refundAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid refund parameters' },
        { status: 400 }
      );
    }

    // Verify contest ownership and get payment details
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, title, payment_details')
      .eq('id', contestId)
      .eq('advertiser_id', user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found or access denied' },
        { status: 404 }
      );
    }

    const currentPaymentDetails = contest.payment_details as PaymentDetails;
    if (!currentPaymentDetails) {
      return NextResponse.json(
        { error: 'No payment details found for this contest' },
        { status: 400 }
      );
    }

    // Process the refund
    const refundResult = await refundContestPaymentV2(
      user.id,
      contestId,
      refundAmount, // Amount should be in cents
      currentPaymentDetails,
      reason || 'Contest budget decreased'
    );

    if (!refundResult.success) {
      return NextResponse.json(
        { error: refundResult.error || 'Failed to process refund' },
        { status: 500 }
      );
    }

    // Update contest with new payment details
    if (refundResult.paymentDetails) {
      const { error: updateError } = await supabase
        .from('contests')
        .update({ payment_details: refundResult.paymentDetails })
        .eq('id', contestId)
        .eq('advertiser_id', user.id);

      if (updateError) {
        console.error('Error updating payment details after refund:', updateError);
        // Don't fail the refund if payment details update fails, just log it
      }
    }

    // Calculate breakdown for user-friendly message
    const commissionRate = currentPaymentDetails.commission_percentage / 100;
    const prizePoolReduction = Math.round(refundAmount / (1 + commissionRate));
    const commissionRefund = refundAmount - prizePoolReduction;

    return NextResponse.json({
      success: true,
      message: `Prize pool reduced by $${(prizePoolReduction / 100).toFixed(2)}. You have been refunded $${(prizePoolReduction / 100).toFixed(2)} + $${(commissionRefund / 100).toFixed(2)} commission = $${(refundAmount / 100).toFixed(2)} total.`,
      breakdown: {
        prizePoolReduction: prizePoolReduction / 100,
        commissionRefund: commissionRefund / 100,
        totalRefunded: refundAmount / 100
      },
      newBalance: refundResult.balance,
      contestTitle: contest.title,
      paymentDetails: refundResult.paymentDetails
    });

  } catch (error) {
    console.error('Error in refund endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
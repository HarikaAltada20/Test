import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { processContestPaymentV2, PaymentDetails } from '@/lib/payment-utils';
import { canCreateNewContest } from '@/lib/contest-utils';
import {
  assertClientPaymentMatchesExpected,
  ContestPaymentValidationError,
  resolveExpectedContestPayment,
} from '@/lib/contest-payment-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contestId, amount, paymentMethod, commissionPercentage, isIncrease, isDecrease } = body;
    
    if (!contestId) {
      return NextResponse.json(
        { error: 'Invalid contest ID' },
        { status: 400 }
      );
    }

    if (!paymentMethod || !['wallet', 'stripe', 'split'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('advertiser_profiles')
      .select('id, available_deposit_balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Only advertisers can create contests' },
        { status: 403 }
      );
    }

    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, title, contest_type, contest_based_details, payment_details')
      .eq('id', contestId)
      .eq('advertiser_id', user.id)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found or access denied' },
        { status: 404 }
      );
    }

    let expectedPayment;
    try {
      expectedPayment = await resolveExpectedContestPayment(contest, user.id, {
        isIncrease: Boolean(isIncrease),
        isDecrease: Boolean(isDecrease),
      });
    } catch (error) {
      if (error instanceof ContestPaymentValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    assertClientPaymentMatchesExpected(
      amount,
      commissionPercentage,
      expectedPayment,
    );

    const { prizePoolInCents, commissionPercentage: serverCommission } =
      expectedPayment;

    const existingPaymentDetails = contest.payment_details as PaymentDetails | null;
    const budgetChangeType = expectedPayment.changeType;
    const isInitialPayment = !existingPaymentDetails || existingPaymentDetails.payment_status !== 'completed';

    if (isInitialPayment) {
      const { getUserPlanFeatures } = await import('@/lib/subscription-utils');
      const planFeatures = await getUserPlanFeatures(user.id);

      if (!planFeatures) {
        return NextResponse.json(
          { error: 'Failed to get user plan details' },
          { status: 500 }
        );
      }

      const maxActiveContests = planFeatures.maxActiveContests;
      const canCreate = await canCreateNewContest(user.id, maxActiveContests);
      
      if (!canCreate.canCreate) {
        console.log(`❌ Active contest limit exceeded for user ${user.id}:`, {
          currentCount: canCreate.currentCount,
          maxAllowed: maxActiveContests,
          contestId: contestId
        });
        
        return NextResponse.json(
          { 
            error: canCreate.error || 'Active contest limit exceeded',
            details: {
              currentActiveContests: canCreate.currentCount,
              maxActiveContests: maxActiveContests,
              planName: 'Current Plan'
            }
          },
          { status: 400 }
        );
      }
    }

    const paymentResult = await processContestPaymentV2(
      user.id,
      contestId,
      prizePoolInCents,
      serverCommission,
      `Contest payment for "${contest.title}" (ID: ${contestId})`,
      paymentMethod !== 'stripe',
      existingPaymentDetails || undefined,
      budgetChangeType
    );

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error },
        { status: 400 }
      );
    }

    if (paymentResult.paymentDetails) {
      const { error: updateError } = await supabase
        .from('contests')
        .update({ payment_details: paymentResult.paymentDetails })
        .eq('id', contestId)
        .eq('advertiser_id', user.id);

      if (updateError) {
        console.error('Error storing payment details:', updateError);
        return NextResponse.json(
          { error: 'Failed to store payment details' },
          { status: 500 }
        );
      }
    }

    const response: Record<string, unknown> = {
      success: true,
      paymentMethod: paymentResult.paymentMethod,
      paymentDetails: paymentResult.paymentDetails
    };

    if (paymentResult.amountFromWallet && paymentResult.amountFromWallet > 0) {
      response.amountFromWallet = paymentResult.amountFromWallet / 100;
    }

    if (paymentResult.amountFromStripe && paymentResult.amountFromStripe > 0) {
      response.amountFromStripe = paymentResult.amountFromStripe / 100;
    }

    if (paymentResult.paymentIntent) {
      response.clientSecret = paymentResult.paymentIntent.client_secret;
      response.paymentIntentId = paymentResult.paymentIntent.id;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in contest payment endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSubscriptionCheckoutSession, getSubscriptionPlanById } from '@/lib/subscription-utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is an advertiser
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || userData?.user_type !== 'advertiser') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse request body - updated to use new parameter names
    const body = await request.json();
    const { productId, priceId, upgradeType = 'immediate', scheduledDate, trialDays } = body;

    // Validate required fields
    if (!productId || !priceId) {
      return NextResponse.json({ error: 'Product ID and Price ID are required' }, { status: 400 });
    }

    // Validate plan exists
    const plan = getSubscriptionPlanById(productId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    // For free plans (EXPLORER), just update subscription_info
    if (plan.price === 0) {
      const subscriptionInfo = {
        product_id: productId,
        price_id: priceId,
        subscription_id: 'free-plan', // Special ID for free plan
        last_synced: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('advertiser_profiles')
        .update({ subscription_info: subscriptionInfo })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating free plan subscription:', updateError);
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Free plan subscription activated',
        subscription: {
          product_id: productId,
          price_id: priceId,
          subscription_id: 'free-plan',
          status: 'active',
          upgrade_type: 'immediate'
        }
      });
    }

    // For paid plans, create Stripe checkout session
    const upgradeOptions = {
      upgradeType: upgradeType as 'immediate' | 'scheduled',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
    };

    const checkoutSession = await createSubscriptionCheckoutSession({
      userId: user.id,
      productId, // Use real Stripe product ID
      priceId,   // Use real Stripe price ID
      upgradeOptions,
      trialDays
    });

    if (!checkoutSession) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.sessionId,
      message: 'Checkout session created successfully'
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
} 
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserSubscription, 
  getSubscriptionPlanById, 
  createSubscriptionCheckoutSession
} from '@/lib/subscription-utils';
import { stripe } from '@/lib/stripe';

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
    const { targetProductId, targetPriceId, upgradeType = 'immediate', scheduledDate } = body;

    // Validate required fields
    if (!targetProductId || !targetPriceId) {
      return NextResponse.json({ error: 'Target product ID and price ID are required' }, { status: 400 });
    }

    if (!upgradeType || !['immediate', 'scheduled'].includes(upgradeType)) {
      return NextResponse.json({ error: 'Invalid upgrade type' }, { status: 400 });
    }

    // Get current subscription
    const currentSubscription = await getUserSubscription(user.id);
    if (!currentSubscription) {
      return NextResponse.json({ error: 'No current subscription found' }, { status: 404 });
    }

    // Validate target plan exists
    const targetPlan = getSubscriptionPlanById(targetProductId);
    if (!targetPlan) {
      return NextResponse.json({ error: 'Invalid target product ID' }, { status: 400 });
    }

    const currentPlan = getSubscriptionPlanById(currentSubscription.product_id);
    if (!currentPlan) {
      return NextResponse.json({ error: 'Invalid current product ID' }, { status: 400 });
    }

    // Check if upgrade is possible (target plan should be more expensive)
    const isUpgrade = targetPlan.price > currentPlan.price;
    if (!isUpgrade && targetPlan.price !== 0) {
      return NextResponse.json({ error: 'Target plan must be an upgrade or free plan' }, { status: 400 });
    }

    // Calculate price difference
    const priceDifference = targetPlan.price - currentPlan.price;

    // Handle scheduled upgrade (for future implementation)
    if (upgradeType === 'scheduled') {
      // For now, we'll treat scheduled upgrades as immediate
      // In the future, you could implement this with Stripe's subscription_schedule
      return NextResponse.json({ 
        error: 'Scheduled upgrades not implemented yet. Please use immediate upgrade.' 
      }, { status: 400 });
    }

    // Handle immediate upgrade
    if (upgradeType === 'immediate') {
      // Handle free plan upgrade (EXPLORER)
      if (targetPlan.price === 0) {
        const subscriptionInfo = {
          product_id: targetProductId,
          price_id: targetPriceId,
          subscription_id: 'free-plan', // Special ID for free plan
          last_synced: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('advertiser_profiles')
          .update({ subscription_info: subscriptionInfo })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating to free plan:', updateError);
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
        }

        // Cancel current Stripe subscription if it exists
        if (currentSubscription.id !== 'free-plan') {
          try {
            await stripe().subscriptions.cancel(currentSubscription.id);
          } catch (stripeError) {
            console.error('Error canceling Stripe subscription:', stripeError);
            // Continue even if Stripe cancellation fails
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Downgraded to free plan immediately',
          upgrade: {
            type: 'immediate',
            current_plan: currentPlan.displayName,
            target_plan: targetPlan.displayName,
            price_difference: priceDifference,
            warning: 'Your paid subscription has been canceled. You now have access to free plan features.'
          }
        });
      }

      // For paid plans, create new checkout session for immediate upgrade
      const checkoutSession = await createSubscriptionCheckoutSession({
        userId: user.id,
        productId: targetProductId, // Use real Stripe product ID
        priceId: targetPriceId,     // Use real Stripe price ID
        upgradeOptions: {
          upgradeType: 'immediate'
        }
      });

      if (!checkoutSession) {
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.sessionId,
        message: 'Immediate upgrade checkout created',
        upgrade: {
          type: 'immediate',
          current_plan: currentPlan.displayName,
          target_plan: targetPlan.displayName,
          price_difference: priceDifference,
          warning: 'You will be charged the prorated amount immediately. Your current plan will be upgraded.'
        }
      });
    }

  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
} 
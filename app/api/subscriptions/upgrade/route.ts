import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserSubscription, 
  getSubscriptionPlanById, 
  createSubscriptionCheckoutSession,
  createOrGetStripeCustomer
} from '@/lib/subscription-utils';
import { stripe } from '@/lib/stripe';
import { formatCurrencyFromCents } from '@/lib/currency-utils';

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

    // Check if upgrade/downgrade is valid
    const isUpgrade = targetPlan.price > currentPlan.price;
    const isDowngrade = targetPlan.price < currentPlan.price;
    const isSamePlan = targetPlan.price === currentPlan.price;
    
    // Allow upgrades, downgrades, or moving to free plan
    if (isSamePlan && targetPlan.id !== currentPlan.id) {
      return NextResponse.json({ error: 'Target plan is the same price as current plan' }, { status: 400 });
    }

    if (targetPlan.id === currentPlan.id) {
      return NextResponse.json({ error: 'You are already on this plan' }, { status: 400 });
    }

    // Calculate price difference (can be positive for upgrade, negative for downgrade)
    const priceDifference = targetPlan.price - currentPlan.price;

    // Handle immediate upgrade
    if (upgradeType === 'immediate') {
      // Handle downgrade to free plan (EXPLORER)
      if (targetPlan.price === 0) {
        const subscriptionInfo = {
          product_id: targetProductId,
          price_id: targetPriceId,
          subscription_id: null, // No Stripe subscription for free plan
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

        // Cancel current Stripe subscription immediately if it exists
        if (currentSubscription.id !== 'free-plan' && currentSubscription.id) {
          try {
            await stripe().subscriptions.cancel(currentSubscription.id, {
              invoice_now: false, // Don't create final invoice
              prorate: false // Don't prorate
            });
            console.log(`✅ Cancelled subscription ${currentSubscription.id} for downgrade to free plan`);
          } catch (stripeError) {
            console.error('Error canceling Stripe subscription:', stripeError);
            // Continue even if Stripe cancellation fails
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Downgraded to free plan successfully',
          downgrade: {
            type: 'immediate',
            current_plan: currentPlan.displayName,
            target_plan: targetPlan.displayName,
            price_difference: priceDifference,
            warning: 'Your paid subscription has been canceled immediately. You now have access to free plan features only.'
          }
        });
      }

      // For paid plans: INSTANT CHANGE = Cancel old + Create new subscription immediately
      try {
        console.log(`🔄 Starting instant ${isUpgrade ? 'upgrade' : 'downgrade'} from ${currentPlan.name} to ${targetPlan.name}`);

        // Step 1: Cancel current subscription immediately (if not free plan)
        if (currentSubscription.id !== 'free-plan' && currentSubscription.id) {
          console.log(`❌ Canceling current subscription: ${currentSubscription.id}`);
          await stripe().subscriptions.cancel(currentSubscription.id, {
            invoice_now: false, // Don't create final invoice
            prorate: false // Don't prorate - user loses remaining time
          });
          console.log(`✅ Successfully cancelled subscription ${currentSubscription.id}`);
        }

        // Step 2: Create new checkout session for immediate new subscription
        const checkoutSession = await createSubscriptionCheckoutSession({
          userId: user.id,
          productId: targetProductId,
          priceId: targetPriceId,
          upgradeOptions: {
            upgradeType: 'immediate'
          }
        });

        if (!checkoutSession) {
          throw new Error('Failed to create checkout session for new subscription');
        }

        const changeType = isUpgrade ? 'upgrade' : 'downgrade';
        const timeWarning = currentSubscription.id !== 'free-plan' 
          ? 'Your current subscription has been cancelled immediately. You will lose any remaining time on your current plan.'
          : 'You will be charged immediately for the new plan.';

        return NextResponse.json({
          success: true,
          checkoutUrl: checkoutSession.url,
          sessionId: checkoutSession.sessionId,
          message: `Instant ${changeType} checkout created`,
          [changeType]: {
            type: 'immediate',
            current_plan: currentPlan.displayName,
            target_plan: targetPlan.displayName,
            price_difference: priceDifference,
            warning: `${timeWarning} You will be charged ${formatCurrencyFromCents(targetPlan.price)} immediately for your new subscription.`
          }
        });

      } catch (error) {
        console.error(`Error in instant ${isUpgrade ? 'upgrade' : 'downgrade'}:`, error);
        return NextResponse.json({ 
          error: `Failed to process instant ${isUpgrade ? 'upgrade' : 'downgrade'}` 
        }, { status: 500 });
      }
    }

    // Handle scheduled upgrade (for future billing cycle)
    if (upgradeType === 'scheduled') {
      try {
        console.log(`📅 Starting scheduled ${isUpgrade ? 'upgrade' : 'downgrade'} from ${currentPlan.name} to ${targetPlan.name}`);

        // For scheduled changes, we create a subscription schedule in Stripe
        // This will automatically start the new subscription when current one ends
        
        if (currentSubscription.id === 'free-plan') {
          // User is on free plan, just create immediate subscription since there's no current billing cycle
          const checkoutSession = await createSubscriptionCheckoutSession({
            userId: user.id,
            productId: targetProductId,
            priceId: targetPriceId,
            upgradeOptions: {
              upgradeType: 'immediate'
            }
          });

          if (!checkoutSession) {
            throw new Error('Failed to create checkout session');
          }

          return NextResponse.json({
            success: true,
            checkoutUrl: checkoutSession.url,
            sessionId: checkoutSession.sessionId,
            message: 'Since you\'re on the free plan, your upgrade will start immediately',
            upgrade: {
              type: 'immediate',
              current_plan: currentPlan.displayName,
              target_plan: targetPlan.displayName,
              price_difference: priceDifference,
              warning: 'You will be charged immediately as there is no current billing cycle to wait for.'
            }
          });
        }

        // Get current subscription end date
        const currentPeriodEnd = new Date(currentSubscription.current_period_end);
        const scheduleStartDate = Math.floor(currentPeriodEnd.getTime() / 1000); // Convert to Unix timestamp

        console.log(`📅 Scheduling new subscription to start at: ${currentPeriodEnd.toISOString()}`);

        // Create subscription schedule in Stripe
        const customerId = await createOrGetStripeCustomer(user.id);
        if (!customerId) {
          throw new Error('Failed to get Stripe customer ID');
        }

        const subscriptionSchedule = await stripe().subscriptionSchedules.create({
          customer: customerId,
          start_date: scheduleStartDate,
          end_behavior: 'release',
          phases: [
            {
              items: [
                {
                  price: targetPriceId,
                  quantity: 1,
                },
              ],
              metadata: {
                user_id: user.id,
                product_id: targetProductId,
                scheduled_change: 'true',
                previous_product_id: currentPlan.id
              }
            },
          ],
          metadata: {
            user_id: user.id,
            product_id: targetProductId,
            scheduled_change_type: isUpgrade ? 'upgrade' : 'downgrade',
            scheduled_from: currentPlan.id
          }
        });

        // Set current subscription to cancel at period end (natural expiration)
        await stripe().subscriptions.update(currentSubscription.id, {
          cancel_at_period_end: true,
          metadata: {
            ...currentSubscription.subscription_info,
            scheduled_replacement: subscriptionSchedule.id,
            cancel_reason: `scheduled_${isUpgrade ? 'upgrade' : 'downgrade'}_to_${targetPlan.name}`
          }
        });

        const changeType = isUpgrade ? 'upgrade' : 'downgrade';
        
        return NextResponse.json({
          success: true,
          message: `Scheduled ${changeType} created successfully`,
          schedule: {
            id: subscriptionSchedule.id,
            start_date: currentPeriodEnd.toISOString()
          },
          [changeType]: {
            type: 'scheduled',
            current_plan: currentPlan.displayName,
            target_plan: targetPlan.displayName,
            price_difference: priceDifference,
            scheduled_date: currentPeriodEnd.toISOString(),
            warning: `Your current plan will continue until ${currentPeriodEnd.toLocaleDateString()}. Your new plan will start automatically after that, and you'll be charged ${formatCurrencyFromCents(targetPlan.price)} for the new billing cycle.`
          }
        });

      } catch (error) {
        console.error(`Error in scheduled ${isUpgrade ? 'upgrade' : 'downgrade'}:`, error);
        return NextResponse.json({ 
          error: `Failed to schedule ${isUpgrade ? 'upgrade' : 'downgrade'}` 
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('Error upgrading subscription:', error);
    return NextResponse.json(
      { error: 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
} 
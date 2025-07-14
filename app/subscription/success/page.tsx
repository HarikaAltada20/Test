import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { SubscriptionSuccessClient } from './SubscriptionSuccessClient';
import { stripe } from '@/lib/stripe';
import { getSubscriptionPlanById } from '@/lib/subscription-utils';

export default async function SubscriptionSuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }>;
}) {
    const resolvedSearchParams = await searchParams;
    const sessionId = resolvedSearchParams.session_id;

    if (!sessionId) {
        redirect('/dashboard/billing');
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/auth/signin');
    }

    try {
        // Get checkout session details from Stripe
        const session = await stripe().checkout.sessions.retrieve(sessionId);

        if (!session) {
            redirect('/subscription/failed?error=session_not_found');
        }

        // If payment isn't completed, redirect to failure
        if (session.payment_status !== 'paid') {
            redirect('/subscription/failed?error=payment_not_completed');
        }

        // Get subscription details - try to get expanded subscription separately
        let subscriptionData = null;
        if (session.subscription) {
            try {
                const subscription = await stripe().subscriptions.retrieve(
                    typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
                    { expand: ['items.data.price'] }
                );

                // Get plan info from subscription metadata (this is set during checkout)
                const planId = subscription.metadata?.product_id;
                const plan = planId ? getSubscriptionPlanById(planId) : null;

                if (plan) {
                    // Convert Date objects to ISO strings for serialization with proper null checks
                    const currentPeriodStart = (subscription as any).current_period_start;
                    const currentPeriodEnd = (subscription as any).current_period_end;
                    const interval = subscription.items?.data[0]?.price?.recurring?.interval || 'month';

                    // Calculate proper fallback dates based on subscription interval
                    const now = new Date();
                    const startDate = currentPeriodStart ? new Date(currentPeriodStart * 1000) : now;

                    let endDate: Date;
                    if (currentPeriodEnd) {
                        endDate = new Date(currentPeriodEnd * 1000);
                    } else {
                        // Calculate end date based on interval
                        endDate = new Date(startDate);
                        if (interval === 'year') {
                            endDate.setFullYear(endDate.getFullYear() + 1);
                        } else {
                            // Default to monthly
                            endDate.setMonth(endDate.getMonth() + 1);
                        }
                    }

                    subscriptionData = {
                        id: subscription.id,
                        status: subscription.status,
                        planName: plan.displayName || 'Subscription Plan',
                        amount: subscription.items?.data[0]?.price?.unit_amount || 0,
                        currency: subscription.items?.data[0]?.price?.currency || 'usd',
                        interval: interval,
                        currentPeriodStart: startDate.toISOString(),
                        currentPeriodEnd: endDate.toISOString(),
                        nextBillingDate: endDate.toISOString(),
                    };
                }
            } catch (subscriptionError) {
                console.log('Could not fetch subscription details, but payment was successful:', subscriptionError);
                // Continue without subscription details - we'll show a basic success page
            }
        }

        // Get user profile for additional context
        const { data: profile } = await supabase
            .from('advertiser_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return (
            <Suspense fallback={<div>Loading...</div>}>
                <SubscriptionSuccessClient
                    sessionId={sessionId}
                    subscriptionData={subscriptionData}

                />
            </Suspense>
        );

    } catch (error) {
        console.error('Error fetching session data:', error);
        // If we can't fetch the session at all, still try to show success page with minimal info
        const { data: profile } = await supabase
            .from('advertiser_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        return (
            <Suspense fallback={<div>Loading...</div>}>
                <SubscriptionSuccessClient
                    sessionId={sessionId}
                    subscriptionData={null}
                />
            </Suspense>
        );
    }
} 
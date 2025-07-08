import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getUserSubscription, getSubscriptionPlanById } from '@/lib/subscription-utils';

export async function GET(request: NextRequest) {
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

    // Get current subscription
    const subscription = await getUserSubscription(user.id);
    
    if (!subscription) {
      return NextResponse.json({
        subscription: null,
        plan: null,
        message: 'No subscription found'
      });
    }

    // Get plan details
    const plan = getSubscriptionPlanById(subscription.product_id);
    
    return NextResponse.json({
      subscription,
      plan,
      message: 'Subscription retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
} 
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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

    // Parse request body
    const body = await request.json();
    const { scheduleId } = body;

    console.log('🔍 Received cancel request for schedule ID:', scheduleId);

    if (!scheduleId) {
      console.log('❌ No schedule ID provided');
      return NextResponse.json({ error: 'Schedule ID is required' }, { status: 400 });
    }

    try {
      console.log('📋 Attempting to cancel schedule in Stripe:', scheduleId);
      
      // First, check the current status of the schedule
      const schedule = await stripe().subscriptionSchedules.retrieve(scheduleId);
      console.log('📋 Current schedule status:', schedule.status);
      
      if (schedule.status === 'canceled') {
        console.log('✅ Schedule is already canceled');
        return NextResponse.json({
          success: true,
          message: 'Scheduled change is already canceled'
        });
      }
      
      if (schedule.status !== 'not_started' && schedule.status !== 'active') {
        console.log('❌ Schedule cannot be canceled in current status:', schedule.status);
        return NextResponse.json(
          { error: `Cannot cancel schedule in ${schedule.status} status` },
          { status: 400 }
        );
      }
      
      // Cancel the subscription schedule in Stripe
      const result = await stripe().subscriptionSchedules.cancel(scheduleId);
      console.log('✅ Schedule canceled successfully:', result.id);
      
      // CRITICAL: Restore current subscription to auto-renewal
      // Get the current subscription that was set to cancel at period end
      const { data: profile, error: profileError } = await supabase
        .from('advertiser_profiles')
        .select('subscription_info')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ Error fetching subscription info:', profileError);
      } else if (profile.subscription_info?.subscription_id && profile.subscription_info.subscription_id !== 'free-plan') {
        try {
          console.log('🔄 Restoring current subscription to auto-renewal...');
          
          // Update the subscription to remove cancel_at_period_end
          const updatedSubscription = await stripe().subscriptions.update(
            profile.subscription_info.subscription_id,
            {
              cancel_at_period_end: false,
              metadata: {
                ...profile.subscription_info,
                scheduled_replacement: null,
                cancel_reason: null
              }
            }
          );
          
          console.log('✅ Current subscription restored to auto-renewal:', updatedSubscription.id);
          
          // Update the subscription info in database
          const updatedSubscriptionInfo = {
            ...profile.subscription_info,
            last_synced: new Date().toISOString()
          };
          
          const { error: updateError } = await supabase
            .from('advertiser_profiles')
            .update({ subscription_info: updatedSubscriptionInfo })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('❌ Error updating subscription info in database:', updateError);
          } else {
            console.log('✅ Database subscription info updated');
          }
          
        } catch (restoreError) {
          console.error('❌ Error restoring subscription to auto-renewal:', restoreError);
          // Don't fail the entire operation if restoration fails
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Scheduled change canceled successfully. Your current plan will continue to auto-renew.'
      });
         } catch (stripeError: any) {
       console.error('❌ Error canceling scheduled change:', stripeError);
       
       // Provide more specific error messages
       if (stripeError.type === 'StripeInvalidRequestError') {
         return NextResponse.json(
           { error: stripeError.message || 'Invalid request to cancel schedule' },
           { status: 400 }
         );
       }
      
      return NextResponse.json(
        { error: 'Failed to cancel scheduled change' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error canceling scheduled change:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled change' },
      { status: 500 }
    );
  }
} 
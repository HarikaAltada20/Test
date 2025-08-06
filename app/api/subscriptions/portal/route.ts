import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerPortalUrl } from '@/lib/subscription-utils';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Creating customer portal session...');
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ Authentication error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.id);

    // Check if user is an advertiser
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    if (userData?.user_type !== 'advertiser') {
      console.error('❌ User is not an advertiser:', userData?.user_type);
      return NextResponse.json({ error: 'Access denied - advertiser account required' }, { status: 403 });
    }

    console.log('✅ User is advertiser, creating portal session...');
    console.log('🔧 Environment check - NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

    // Get customer portal URL
    const portalUrl = await getCustomerPortalUrl(user.id);
    
    if (!portalUrl) {
      console.error('❌ Failed to create portal session for user:', user.id);
      return NextResponse.json({ 
        error: 'Failed to create portal session. Please ensure you have an active subscription.' 
      }, { status: 500 });
    }

    console.log('✅ Portal session created successfully:', portalUrl);

    return NextResponse.json({
      success: true,
      portalUrl,
      message: 'Customer portal session created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
} 
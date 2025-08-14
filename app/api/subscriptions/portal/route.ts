import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getCustomerPortalUrl } from '@/lib/subscription-utils';

export async function POST(request: NextRequest) {
  try {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log('[API] POST /api/subscriptions/portal:start', { requestId });
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[API] /subscriptions/portal:auth-error', { requestId, authError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] /subscriptions/portal:user', { requestId, userId: user.id });

    // Check if user is an advertiser
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('[API] /subscriptions/portal:user-error', { requestId, userError });
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }

    if (userData?.user_type !== 'advertiser') {
      console.error('[API] /subscriptions/portal:not-advertiser', { requestId, userType: userData?.user_type });
      return NextResponse.json({ error: 'Access denied - advertiser account required' }, { status: 403 });
    }

    console.log('[API] /subscriptions/portal:authorized', { requestId, appUrlDefined: Boolean(process.env.NEXT_PUBLIC_APP_URL) });

    // Get customer portal URL
    const portalUrl = await getCustomerPortalUrl(user.id);
    
    if (!portalUrl) {
      console.error('[API] /subscriptions/portal:failed', { requestId, userId: user.id });
      return NextResponse.json({ 
        error: 'Failed to create portal session. Please ensure you have an active subscription.' 
      }, { status: 500 });
    }

    console.log('[API] /subscriptions/portal:success', { requestId, hasUrl: Boolean(portalUrl) });

    return NextResponse.json({
      success: true,
      portalUrl,
      message: 'Customer portal session created successfully'
    });

  } catch (error) {
    console.error('[API] /subscriptions/portal:error', { message: (error as any)?.message || String(error), raw: error });
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
} 
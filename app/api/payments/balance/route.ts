import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAdvertiserDepositBalance } from '@/lib/payment-utils';

export async function GET(request: NextRequest) {
  try {
    console.log('💳 BALANCE API CALLED');
    
    // Get user from session
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('❌ Balance API: Unauthorized');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('👤 Balance API: User ID:', user.id);

    const { data: userRow } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .maybeSingle();

    if (userRow?.user_type === 'admin') {
      return NextResponse.json(
        {
          error:
            'Admin accounts do not have a wallet. Use pay-as-brand for brand campaigns.',
        },
        { status: 403 },
      );
    }

    // Get advertiser balance (already in cents from database)
    const balanceResult = await getAdvertiserDepositBalance(user.id);
    
    if (!balanceResult.success) {
      console.log('❌ Balance API: Failed to fetch balance:', balanceResult.error);
      return NextResponse.json(
        { error: balanceResult.error || 'Failed to fetch balance' },
        { status: 500 }
      );
    }

    console.log('💰 Balance API: Current balance (cents):', balanceResult.balance);

    return NextResponse.json({
      balance: balanceResult.balance || 0, // Already in cents
      currency: 'USD'
    });

  } catch (error) {
    console.error('Error in balance endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
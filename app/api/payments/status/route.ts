import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentIntentId = searchParams.get('payment_intent_id');

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment intent ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Checking payment status for:', paymentIntentId);

    // Get user from session
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check transaction status in database
    const { data: transaction, error } = await supabase
      .from('money_transactions')
      .select('status, remarks, amount, type')
      .eq('payment_intent_id', paymentIntentId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.log('❌ Transaction not found:', error);
      return NextResponse.json({
        status: 'unknown',
        message: 'Transaction not found'
      });
    }

    console.log('📊 Transaction status:', transaction);

    return NextResponse.json({
      status: transaction.status,
      message: transaction.remarks || 'Processing payment...',
      amount: transaction.amount,
      type: transaction.type
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
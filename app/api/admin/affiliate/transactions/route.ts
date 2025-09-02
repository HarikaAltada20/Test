import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const contestId = searchParams.get('contest_id');

    if (!userId && !contestId) {
      return NextResponse.json({ error: 'Either user_id or contest_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    let query = supabase
      .from('money_transactions')
      .select('*')
      .eq('type', 'reward')
      .contains('metadata', { affiliate_commission: true })
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (contestId) {
      query = query.contains('metadata', { contest_id: contestId });
    }

    const { data: transactions, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

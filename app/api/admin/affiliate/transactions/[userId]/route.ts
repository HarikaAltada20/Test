import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) return NextResponse.json({ error: error || 'Admin required' }, { status: 403 });

    const resolved = await params;
    const userId = resolved.userId;
    const supabase = createAdminClient();

    const { data, error: txErr } = await supabase
      .from('money_transactions')
      .select('id, type, status, amount, description, remarks, metadata, created_at')
      .eq('user_id', userId)
      .contains('metadata', { affiliate_commission: true })
      .order('created_at', { ascending: false });

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}



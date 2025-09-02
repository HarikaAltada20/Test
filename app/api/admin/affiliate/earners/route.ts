import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) return NextResponse.json({ error: error || 'Admin required' }, { status: 403 });

    const supabase = createAdminClient();

    // Strategy: show earners where users.total_other_earnings > 0
    // Optional: includeZeros=1 to list all users with balances
    const url = new URL(req.url);
    const includeZeros = url.searchParams.get('includeZeros') === '1';

    const usersQuery = supabase
      .from('users')
      .select('id, username, full_name, user_type, total_other_earnings');
    const { data: users, error: usersErr } = includeZeros
      ? await usersQuery
      : await usersQuery.gt('total_other_earnings', 0);
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

    const userIds = (users || []).map(u => u.id);
    if (userIds.length === 0) return NextResponse.json({ items: [] });

    // Split ids by user type to fetch balances
    const creators = (users || []).filter(u => u.user_type === 'creator').map(u => u.id);
    const advertisers = (users || []).filter(u => u.user_type === 'advertiser').map(u => u.id);

    const [creatorProfiles, advertiserProfiles] = await Promise.all([
      creators.length > 0 ? supabase
        .from('creator_profiles')
        .select('id, withdrawable_balance')
        .in('id', creators) : Promise.resolve({ data: [], error: null } as any),
      advertisers.length > 0 ? supabase
        .from('advertiser_profiles')
        .select('id, withdrawable_balance')
        .in('id', advertisers) : Promise.resolve({ data: [], error: null } as any),
    ]);

    const creatorBal: Record<string, number> = {};
    for (const p of (creatorProfiles.data || [])) creatorBal[p.id] = p.withdrawable_balance || 0;
    const advertiserBal: Record<string, number> = {};
    for (const p of (advertiserProfiles.data || [])) advertiserBal[p.id] = p.withdrawable_balance || 0;

    // Latest affiliate credit timestamp per user from transactions (if present)
    const { data: lastTxns } = await supabase
      .from('money_transactions')
      .select('user_id, created_at, metadata')
      .in('user_id', userIds)
      .eq('type', 'reward')
      .contains('metadata', { affiliate_commission: true })
      .order('created_at', { ascending: false });
    const lastAtByUser: Record<string, string> = {};
    for (const t of lastTxns || []) {
      const uid = (t as any).user_id as string;
      if (!lastAtByUser[uid]) lastAtByUser[uid] = (t as any).created_at as string;
    }

    const items = (users || []).map(u => {
      const bal = u.user_type === 'creator' ? (creatorBal[u.id] || 0) : (advertiserBal[u.id] || 0);
      const totalOther = (u as any).total_other_earnings || 0;
      return {
        user_id: u.id,
        username: u.username,
        full_name: u.full_name,
        user_type: u.user_type,
        withdrawable_balance_cents: bal,
        lifetime_affiliate_cents: totalOther,
        last_affiliate_credit_at: lastAtByUser[u.id] || null,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ contestId: string }> }
) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) return NextResponse.json({ error: error || 'Admin required' }, { status: 403 });

    const resolvedParams = await params;
    const contestId = resolvedParams.contestId;
    const supabase = createAdminClient();

    // 1) Fetch submissions for contest with earnings > 0 (winners). Prefer status 'paid'. Include affiliate flags
    const { data: submissions, error: subsErr } = await supabase
      .from('submissions')
      .select('id, contest_id, creator_id, earnings, status, affiliate_paid, affiliate_metadata')
      .eq('contest_id', contestId);
    if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 });

    const winnerSubs = (submissions || []).filter((s: any) => (s.earnings || 0) > 0 && s.status === 'paid');
    if (winnerSubs.length === 0) {
      return NextResponse.json({ items: [], totals: { winners: 0, pending: 0, credited: 0, totalAmountCents: 0 } });
    }

    const winnerIds = Array.from(new Set(winnerSubs.map((s: any) => s.creator_id)));

    // 2) Fetch winners' user rows to get referred_by (referral code string)
    const { data: winnerUsers, error: usersErr } = await supabase
      .from('users')
      .select('id, full_name, username, referred_by')
      .in('id', winnerIds);
    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

    const codeSet = new Set((winnerUsers || []).map((u: any) => u.referred_by).filter(Boolean));
    const codes = Array.from(codeSet) as string[];

    // 3) Resolve referrers from referral_code
    let referrersByCode: Record<string, any> = {};
    if (codes.length > 0) {
      const { data: referrers, error: refErr } = await supabase
        .from('users')
        .select('id, username, full_name, referral_code')
        .in('referral_code', codes);
      if (refErr) return NextResponse.json({ error: refErr.message }, { status: 500 });
      for (const r of referrers || []) referrersByCode[r.referral_code] = r;
    }

    // 4) Fetch existing affiliate credits for this contest to mark credited rows (legacy safety)
    const { data: existingTxns } = await supabase
      .from('money_transactions')
      .select('id, user_id, metadata')
      .eq('type', 'reward')
      .contains('metadata', { affiliate_commission: true, contest_id: contestId });

    const creditedBySubmission = new Set<string>();
    for (const t of existingTxns || []) {
      const subId = (t as any)?.metadata?.submission_id;
      if (subId) creditedBySubmission.add(String(subId));
    }

    // 5) Build response items
    const winnerById: Record<string, any> = {};
    for (const u of winnerUsers || []) winnerById[u.id] = u;

    const items = winnerSubs
      .map((s: any) => {
        const winnerUser = winnerById[s.creator_id];
        const refCode = winnerUser?.referred_by || null;
        const refUser = refCode ? referrersByCode[refCode] : null;
        if (!refUser || refUser.id === s.creator_id) return null; // no referrer or self-referral

        const winningCents = s.earnings || 0;
        const defaultRatePercent = 10;
        const commissionCents = Math.round((winningCents * defaultRatePercent) / 100);
        const isCredited = s.affiliate_paid === true || creditedBySubmission.has(String(s.id));

        return {
          submission_id: s.id,
          contest_id: s.contest_id,
          winner_user_id: s.creator_id,
          winner_username: winnerUser?.username || null,
          referrer_user_id: refUser.id,
          referrer_username: refUser.username || null,
          winning_amount_cents: winningCents,
          default_rate_percent: defaultRatePercent,
          default_commission_cents: commissionCents,
          status: isCredited ? 'credited' : 'pending',
          affiliate_metadata: s.affiliate_metadata || null,
        };
      })
      .filter(Boolean);

    const totals = {
      winners: items.length,
      pending: items.filter((i: any) => i.status === 'pending').length,
      credited: items.filter((i: any) => i.status === 'credited').length,
      totalAmountCents: items.reduce((acc: number, i: any) => acc + (i.default_commission_cents || 0), 0),
    };

    return NextResponse.json({ items, totals });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}



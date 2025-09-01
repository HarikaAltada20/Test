import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

type ConfirmPayload = {
  items: Array<{
    submission_id: string;
    contest_id: string;
    referrer_user_id: string;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const { isAdmin, error } = await verifyAdminAccess();
    if (!isAdmin) return NextResponse.json({ error: error || 'Admin required' }, { status: 403 });

    const body = (await req.json()) as ConfirmPayload;
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const results: any[] = [];

    for (const row of body.items) {
      // If a credit/marker already exists, skip
      const { data: existing } = await supabase
        .from('money_transactions')
        .select('id')
        .eq('user_id', row.referrer_user_id)
        .eq('type', 'reward')
        .contains('metadata', { affiliate_commission: true, contest_id: row.contest_id, submission_id: row.submission_id })
        .limit(1);
      if (existing && existing.length > 0) {
        results.push({ submission_id: row.submission_id, status: 'already_marked' });
        continue;
      }

      const { error: insErr } = await supabase
        .from('money_transactions')
        .insert({
          user_id: row.referrer_user_id,
          type: 'reward',
          status: 'completed',
          amount: 0,
          description: `Affiliate commission confirmed (external) for contest ${row.contest_id}`,
          remarks: 'Affiliate marked as confirmed (no wallet credit)',
          metadata: { affiliate_commission: true, contest_id: row.contest_id, submission_id: row.submission_id, external: true },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      if (insErr) {
        results.push({ submission_id: row.submission_id, status: 'failed', error: insErr.message });
      } else {
        // Mark submission affiliate flags
        const { error: updErr } = await supabase
          .from('submissions')
          .update({
            affiliate_paid: true,
            affiliate_metadata: { confirmed_at: new Date().toISOString(), method: 'external' }
          })
          .eq('id', row.submission_id);
        if (updErr) {
          results.push({ submission_id: row.submission_id, status: 'marked_but_flag_update_failed', error: updErr.message });
        } else {
          results.push({ submission_id: row.submission_id, status: 'marked' });
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}



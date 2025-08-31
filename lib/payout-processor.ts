import { createAdminClient } from '@/utils/supabase/admin';
import { MetricsService } from '@/lib/metrics-service';

export interface PayoutJobResult {
  id: string;
  status: 'done' | 'error';
  error?: string;
}

// Processes up to batchSize queued payout jobs. Returns per-job results.
export async function processQueuedPayouts(batchSize: number = 10): Promise<PayoutJobResult[]> {
  const supabaseAdmin = createAdminClient();

  const { data: jobs, error: jobsErr } = await supabaseAdmin
    .from('payout_jobs')
    .select('id, submission_id, requested_by, payload, status, created_at')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (jobsErr) {
    throw new Error(`Failed to load jobs: ${jobsErr.message}`);
  }

  if (!jobs || jobs.length === 0) {
    return [];
  }

  const results: PayoutJobResult[] = [];

  for (const job of jobs) {
    try {
      await supabaseAdmin
        .from('payout_jobs')
        .update({ status: 'processing' })
        .eq('id', job.id);

      // Load submission + contest
      const { data: sub, error: subErr } = await supabaseAdmin
        .from('submissions')
        .select('id, contest_id, creator_id, status, earnings, views')
        .eq('id', job.submission_id)
        .single();
      if (subErr || !sub) throw new Error(`Submission not found: ${subErr?.message || ''}`);

      const { data: contest, error: contestErr } = await supabaseAdmin
        .from('contests')
        .select('contest_type, contest_based_details')
        .eq('id', sub.contest_id)
        .single();
      if (contestErr || !contest) throw new Error(`Contest not found: ${contestErr?.message || ''}`);

      // Compute reward amount if missing
      let rewardAmount = sub.earnings || 0; // cents
      if (!rewardAmount || rewardAmount <= 0) {
        if ((contest as any).contest_type === 'cpm') {
          const cpm = (contest as any)?.contest_based_details?.cpm_contest;
          const rate = typeof cpm?.cpm_rate_usd === 'number' ? cpm.cpm_rate_usd : 0;
          let effectiveViews = sub.views || 0;
          if (typeof cpm?.min_views === 'number' && effectiveViews < cpm.min_views) effectiveViews = 0;
          if (typeof cpm?.max_views === 'number' && effectiveViews > cpm.max_views) effectiveViews = cpm.max_views;
          rewardAmount = Math.round((effectiveViews * rate / 1000) * 100);
        } else if ((contest as any).contest_type === 'leaderboard') {
          const { count: higherViewsCount } = await supabaseAdmin
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('contest_id', sub.contest_id)
            .in('status', ['verified', 'paid'])
            .gt('views', sub.views || 0);
          const rank = (higherViewsCount || 0) + 1;
          const prizes = (contest as any)?.contest_based_details?.leaderboard_contest?.prizes || [];
          const prizeForRank = prizes.find((p: any) => p.position === rank);
          rewardAmount = prizeForRank?.amount || 0; // cents
        }
      }

      if (rewardAmount > 0) {
        await supabaseAdmin
          .from('submissions')
          .update({ earnings: rewardAmount, status: 'paid' })
          .eq('id', sub.id);
        try {
          await MetricsService.incrementContestsWon(sub.creator_id);
        } catch {}
      }

      await supabaseAdmin
        .from('payout_jobs')
        .update({ status: 'done', processed_at: new Date().toISOString() })
        .eq('id', job.id);

      results.push({ id: job.id, status: 'done' });
    } catch (e: any) {
      const message = e?.message || 'unknown error';
      await supabaseAdmin
        .from('payout_jobs')
        .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
        .eq('id', job.id);
      results.push({ id: job.id, status: 'error', error: message });
    }
  }

  return results;
}



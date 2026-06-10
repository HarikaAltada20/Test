import { createAdminClient } from '@/utils/supabase/admin';
import { SUBMISSION_STATUS } from './constants-status';

export interface ParticipationKey {
  creatorId: string;
  contestId: string;
}

export const MetricsService = {
  // Calculate contests participated dynamically from submissions table
  // Note: creator_profiles.id = submissions.creator_id
  async getContestsParticipated(creatorId: string): Promise<number> {
    const supabase = createAdminClient();
    
    // Read directly from the column - it's maintained by database triggers
    // This is O(1) and scales well even with millions of submissions
    const { data, error } = await supabase
      .from('creator_profiles')
      .select('total_contests_participated')
      .eq('id', creatorId)
      .single();
    
    if (error) throw new Error(`Failed to get contests participated: ${error.message}`);
    return data?.total_contests_participated || 0;
  },

  // Legacy method - kept for backward compatibility but now calculates dynamically
  async ensureCreatorParticipation({ creatorId, contestId }: ParticipationKey): Promise<void> {
    // No longer needed - participations are calculated dynamically
    // This method is kept for backward compatibility but does nothing
    return;
  },

  async getCreatorField(
    creatorId: string,
    field: 'total_contests_participated' | 'total_contests_won' | 'total_views' | 'total_money_won' | 'withdrawable_balance' | 'total_submissions_made' | 'total_submissions_won'
  ): Promise<number> {
    const supabase = createAdminClient();
    type CreatorPick = {
      total_contests_participated?: number;
      total_contests_won?: number;
      total_views?: number;
      total_money_won?: number;
      withdrawable_balance?: number;
      total_submissions_made?: number;
      total_submissions_won?: number;
    };
    const { data, error } = await supabase
      .from('creator_profiles')
      .select(field)
      .eq('id', creatorId)
      .single<CreatorPick>();
    if (error) throw new Error(`Failed to read creator field ${field}: ${error.message}`);
    const value = (data && (data as any)[field]) ?? 0;
    return Number(value) || 0;
  },

  async getAdvertiserField(
    advertiserId: string,
    field: 'total_contests_run' | 'total_money_spent' | 'available_deposit_balance' | 'withdrawable_balance'
  ): Promise<number> {
    const supabase = createAdminClient();
    type AdvertiserPick = {
      total_contests_run?: number;
      total_money_spent?: number;
      available_deposit_balance?: number;
      withdrawable_balance?: number;
    };
    const { data, error } = await supabase
      .from('advertiser_profiles')
      .select(field)
      .eq('id', advertiserId)
      .single<AdvertiserPick>();
    if (error) throw new Error(`Failed to read advertiser field ${field}: ${error.message}`);
    const value = (data && (data as any)[field]) ?? 0;
    return Number(value) || 0;
  },

  // When submission is created: increment total_submissions_made
  async incrementSubmissionsMade(creatorId: string): Promise<void> {
    const supabase = createAdminClient();
    const currentCount = await this.getCreatorField(creatorId, 'total_submissions_made');
    const { error } = await supabase
      .from('creator_profiles')
      .update({
        total_submissions_made: currentCount + 1,
      })
      .eq('id', creatorId);
    if (error) throw new Error(`Failed to increment total_submissions_made: ${error.message}`);
  },

  // When submission is marked paid: increment submission wins and contest wins (idempotent)
  // Money updates are handled elsewhere (payment-utils credit/debit).
  async incrementSubmissionWin(creatorId: string, contestId: string, submissionId: string): Promise<void> {
    const supabase = createAdminClient();

    // 1. Always increment total_submissions_won
    const currentSubmissionWins = await this.getCreatorField(creatorId, 'total_submissions_won');
    const { error: subError } = await supabase
      .from('creator_profiles')
      .update({
        total_submissions_won: currentSubmissionWins + 1,
      })
      .eq('id', creatorId);
    if (subError) throw new Error(`Failed to increment total_submissions_won: ${subError.message}`);

    // 2. Check if creator already has a contest win for this contest
    // Use limit(1) instead of single() — duplicate rows (bad data) break .single() with
    // "Cannot coerce the result to a single JSON object".
    const { data: existingContestWinRows, error: checkErr } = await supabase
      .from('creator_contest_wins')
      .select('first_win_submission_id')
      .eq('creator_id', creatorId)
      .eq('contest_id', contestId)
      .limit(1);

    if (checkErr) {
      throw new Error(`Failed to check existing contest win: ${checkErr.message}`);
    }
    const existingContestWin = existingContestWinRows?.[0];

    // 3. Handle contest win tracking
    if (!existingContestWin) {
      // No existing contest win - this is the first win for this contest
      const { data: contestWinInserted, error: contestWinErr } = await supabase
        .from('creator_contest_wins')
        .insert({ 
          creator_id: creatorId, 
          contest_id: contestId,
          first_win_submission_id: submissionId
        })
        .select('creator_id, contest_id')
        .single();

      if (contestWinErr && !contestWinErr.message?.includes('duplicate key')) {
        throw new Error(`Failed to record contest win: ${contestWinErr.message}`);
      }

      // Increment total_contests_won only if this was a new contest win
      if (contestWinInserted) {
        const currentContestWins = await this.getCreatorField(creatorId, 'total_contests_won');
        const { error: contestError } = await supabase
          .from('creator_profiles')
          .update({
            total_contests_won: currentContestWins + 1,
          })
          .eq('id', creatorId);
        if (contestError) throw new Error(`Failed to increment total_contests_won: ${contestError.message}`);
      }
    } else {
      // Creator already has a contest win for this contest
      // This submission win doesn't change the contest win count
      // But we might want to update the first_win_submission_id if this submission was created earlier
      const { data: submissionData, error: subDataErr } = await supabase
        .from('submissions')
        .select('created_at')
        .eq('id', submissionId)
        .single();

      const { data: firstWinSubmissionData, error: firstWinErr } = await supabase
        .from('submissions')
        .select('created_at')
        .eq('id', existingContestWin.first_win_submission_id)
        .single();

      if (!subDataErr && !firstWinErr && submissionData && firstWinSubmissionData) {
        // If current submission was created before the first win submission, update the record
        if (new Date(submissionData.created_at) < new Date(firstWinSubmissionData.created_at)) {
          await supabase
            .from('creator_contest_wins')
            .update({ first_win_submission_id: submissionId })
            .eq('creator_id', creatorId)
            .eq('contest_id', contestId);
        }
      }
    }
  },


  // When submission win is reversed or status toggled away from paid: decrement submission wins
  async decrementSubmissionWin(creatorId: string, contestId: string, submissionId: string): Promise<void> {
    const supabase = createAdminClient();

    // 1. Always decrement total_submissions_won
    const currentSubmissionWins = await this.getCreatorField(creatorId, 'total_submissions_won');
    const { error: subError } = await supabase
      .from('creator_profiles')
      .update({
        total_submissions_won: Math.max(0, currentSubmissionWins - 1),
      })
      .eq('id', creatorId);
    if (subError) throw new Error(`Failed to decrement total_submissions_won: ${subError.message}`);

    // 2. Check if this was the first win for this contest (limit(1): tolerate duplicate rows)
    const { data: contestWinRows, error: contestWinErr } = await supabase
      .from('creator_contest_wins')
      .select('first_win_submission_id')
      .eq('creator_id', creatorId)
      .eq('contest_id', contestId)
      .limit(1);

    if (contestWinErr) {
      throw new Error(`Failed to check contest win: ${contestWinErr.message}`);
    }
    const contestWin = contestWinRows?.[0];

    // 3. If this was the first win submission for this contest, remove contest win and decrement total_contests_won
    if (contestWin && contestWin.first_win_submission_id === submissionId) {
      const { error: deleteErr } = await supabase
        .from('creator_contest_wins')
        .delete()
        .eq('creator_id', creatorId)
        .eq('contest_id', contestId);
      
      if (deleteErr) throw new Error(`Failed to remove contest win: ${deleteErr.message}`);

      // Decrement total_contests_won
      const currentContestWins = await this.getCreatorField(creatorId, 'total_contests_won');
      const { error: contestError } = await supabase
        .from('creator_profiles')
        .update({
          total_contests_won: Math.max(0, currentContestWins - 1),
        })
        .eq('id', creatorId);
      if (contestError) throw new Error(`Failed to decrement total_contests_won: ${contestError.message}`);
    }
  },


  // Credit views when contest moves into verification or payouts_processed.
  // Uses submission_views_credited to apply only the delta.
  async creditViewsForContest(contestId: string, batchSize: number = 10000): Promise<{ processedAll: boolean }> {
    const supabase = createAdminClient();

    // Load submissions with credited snapshot
    const { data: subs, error: subsErr } = await supabase
      .from('submissions')
      .select('id, creator_id, views, status')
      .eq('contest_id', contestId)
      .limit(batchSize);
    if (subsErr) throw new Error(`Failed to load contest submissions: ${subsErr.message}`);

    const filtered = (subs || []).filter(s => s.status !== SUBMISSION_STATUS.rejected);

    if (filtered.length === 0) return { processedAll: true };

    // Fetch credited snapshots
    const submissionIds = filtered.map(s => s.id);
    const { data: creditedRows, error: credErr } = await supabase
      .from('submission_views_credited')
      .select('submission_id, credited_views')
      .in('submission_id', submissionIds);
    if (credErr) throw new Error(`Failed to load credited snapshots: ${credErr.message}`);

    const creditedMap = new Map<string, number>();
    for (const row of creditedRows || []) {
      creditedMap.set(row.submission_id as string, (row as any).credited_views || 0);
    }

    const updatesForSnapshot: Array<{ submission_id: string; credited_views: number } > = [];

    for (const s of filtered) {
      const credited = creditedMap.get(s.id) || 0;
      const views = (s.views || 0) as number;
      if (views > credited) {
        updatesForSnapshot.push({ submission_id: s.id, credited_views: views });
      }
    }

    // Upsert snapshots (creator_profiles.total_views is maintained by DB trigger)
    if (updatesForSnapshot.length > 0) {
      const { error: upErr } = await supabase
        .from('submission_views_credited')
        .upsert(
          updatesForSnapshot.map(u => ({ submission_id: u.submission_id, credited_views: u.credited_views, credited_at: new Date().toISOString() })),
          { onConflict: 'submission_id' }
        );
      if (upErr) throw new Error(`Failed to upsert credited snapshots: ${upErr.message}`);
    }

    // Check if fully processed: no submission has views > credited
    const { data: remaining, error: remErr } = await supabase
      .from('submissions')
      .select('id, views')
      .eq('contest_id', contestId)
      .limit(1);
    if (remErr) throw new Error(`Failed to check remaining snapshots: ${remErr.message}`);

    // Fetch credited for those few to be safe
    let processedAll = true;
    if ((remaining || []).length > 0) {
      const remIds = (remaining || []).map(r => r.id);
      const { data: remCred } = await supabase
        .from('submission_views_credited')
        .select('submission_id, credited_views')
        .in('submission_id', remIds);
      for (const r of remaining || []) {
        const cv = (remCred || []).find(c => c.submission_id === r.id)?.credited_views || 0;
        if ((r.views || 0) > cv) { processedAll = false; break; }
      }
    }

    return { processedAll };
  },

  // Advertiser accounting when contest is published: increment totals only.
  async applyContestPublished(advertiserId: string, amountInCents: number): Promise<void> {
    const supabase = createAdminClient();
    const totalRun = await this.getAdvertiserField(advertiserId, 'total_contests_run');
    const spent = await this.getAdvertiserField(advertiserId, 'total_money_spent');
    const { error } = await supabase
      .from('advertiser_profiles')
      .update({
        total_contests_run: totalRun + 1,
        total_money_spent: spent + Math.max(0, amountInCents),
      })
      .eq('id', advertiserId);
    if (error) throw new Error(`Failed to update advertiser publish accounting: ${error.message}`);
  },

  // Reversal of advertiser accounting if publish is rolled back: decrement totals only.
  async revertContestPublished(advertiserId: string, amountInCents: number): Promise<void> {
    const supabase = createAdminClient();
    const totalRun = await this.getAdvertiserField(advertiserId, 'total_contests_run');
    const spent = await this.getAdvertiserField(advertiserId, 'total_money_spent');
    const { error } = await supabase
      .from('advertiser_profiles')
      .update({
        total_contests_run: Math.max(0, totalRun - 1),
        total_money_spent: Math.max(0, spent - Math.max(0, amountInCents)),
      })
      .eq('id', advertiserId);
    if (error) throw new Error(`Failed to revert advertiser publish accounting: ${error.message}`);
  },
};



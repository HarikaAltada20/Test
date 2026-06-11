import { createAdminClient } from '@/utils/supabase/admin';
import { SUBMISSION_STATUS } from './constants-status';
import { getSubmissionViewsForCrediting } from './submission-credited-views';

export type ContestViewsSyncResult = {
  contest_id: string;
  deleted_rejected_credits: number;
  upserted_or_updated: number;
};

export type AllCreatorViewsSyncResult = {
  deleted_rejected_credits: number;
  upserted_or_updated: number;
  platform_aware_submissions: number;
};

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


  /** Platform-wide sync of credited views → creator_profiles (admin repair). */
  async syncAllCreatorProfileViews(): Promise<AllCreatorViewsSyncResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      'sync_all_submission_views_credited',
    );
    if (error) {
      throw new Error(
        `Failed to sync all creator profile views: ${error.message}`,
      );
    }
    const row = (data || {}) as Omit<
      AllCreatorViewsSyncResult,
      'platform_aware_submissions'
    >;
    const platformAwareSubmissions =
      await this.applyPlatformAwareViewCreditsAll();
    return {
      deleted_rejected_credits: Number(row.deleted_rejected_credits) || 0,
      upserted_or_updated: Number(row.upserted_or_updated) || 0,
      platform_aware_submissions: platformAwareSubmissions,
    };
  },

  /** Paginated platform-aware credit pass for all eligible submissions. */
  async applyPlatformAwareViewCreditsAll(): Promise<number> {
    const supabase = createAdminClient();
    const pageSize = 2000;
    let offset = 0;
    let processed = 0;

    while (true) {
      const { data: subs, error: subsErr } = await supabase
        .from('submissions')
        .select('id, views, status, platform, other_stats')
        .in('status', [
          SUBMISSION_STATUS.pending,
          SUBMISSION_STATUS.verified,
          SUBMISSION_STATUS.paid,
        ])
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (subsErr) {
        throw new Error(
          `Failed to load submissions for platform-aware view sync: ${subsErr.message}`,
        );
      }

      const batch = subs || [];
      if (batch.length === 0) break;

      await this.creditSubmissionViews(
        batch as Array<{
          id: string;
          views?: number | null;
          platform?: string | null;
          other_stats?: unknown;
        }>,
      );

      processed += batch.length;
      if (batch.length < pageSize) break;
      offset += pageSize;
    }

    return processed;
  },

  /** Sync all pending/verified/paid submission views for a contest into creator_profiles (via DB RPC). */
  async syncContestViewsToCreatorProfiles(
    contestId: string,
  ): Promise<ContestViewsSyncResult> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      'sync_contest_submission_views_credited',
      { p_contest_id: contestId },
    );
    if (error) {
      throw new Error(
        `Failed to sync contest views to creator profiles: ${error.message}`,
      );
    }
    const row = (data || {}) as ContestViewsSyncResult;
    await this.applyPlatformAwareViewCreditsForContest(contestId);
    return row;
  },

  /**
   * Second pass: upsert credits using platform-aware view counts (Instagram/TikTok other_stats).
   * DB RPC uses submissions.views; this aligns credited snapshots with contest UI metrics.
   */
  async applyPlatformAwareViewCreditsForContest(contestId: string): Promise<void> {
    const supabase = createAdminClient();
    const { data: subs, error: subsErr } = await supabase
      .from('submissions')
      .select('id, views, status, platform, other_stats')
      .eq('contest_id', contestId)
      .in('status', [
        SUBMISSION_STATUS.pending,
        SUBMISSION_STATUS.verified,
        SUBMISSION_STATUS.paid,
      ]);
    if (subsErr) {
      throw new Error(
        `Failed to load submissions for platform-aware view sync: ${subsErr.message}`,
      );
    }
    await this.creditSubmissionViews((subs || []) as Array<{
      id: string;
      views?: number | null;
      platform?: string | null;
      other_stats?: unknown;
    }>);
  },

  /** Upsert submission_views_credited for specific submissions (bulk pay, verify). */
  async creditSubmissionViews(
    rows: Array<{
      id: string;
      views?: number | null;
      platform?: string | null;
      other_stats?: unknown;
    }>,
  ): Promise<void> {
    if (rows.length === 0) return;

    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const payload = rows.map((row) => ({
      submission_id: row.id,
      credited_views: getSubmissionViewsForCrediting(row),
      credited_at: now,
    }));

    const { error } = await supabase
      .from('submission_views_credited')
      .upsert(payload, { onConflict: 'submission_id' });
    if (error) {
      throw new Error(`Failed to credit submission views: ${error.message}`);
    }
  },

  /** @deprecated Prefer syncContestViewsToCreatorProfiles */
  async creditViewsForContest(
    contestId: string,
    _batchSize: number = 10000,
  ): Promise<{ processedAll: boolean }> {
    await this.syncContestViewsToCreatorProfiles(contestId);
    return { processedAll: true };
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



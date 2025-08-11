import { createAdminClient } from '@/utils/supabase/admin';
import { SUBMISSION_STATUS } from './constants-status';

export interface ParticipationKey {
  creatorId: string;
  contestId: string;
}

export const MetricsService = {
  // Idempotent: ensures exactly one participation increment per (creator, contest)
  async ensureCreatorParticipation({ creatorId, contestId }: ParticipationKey): Promise<void> {
    const supabase = createAdminClient();

    // upsert into helper table; if inserted, increment profile counter
    const { data: inserted, error: insertErr } = await supabase
      .from('creator_contest_participations')
      .insert({ creator_id: creatorId, contest_id: contestId })
      .select('creator_id, contest_id')
      .single();

    if (insertErr && !insertErr.message?.includes('duplicate key')) {
      // Ignore conflict errors; only bubble real failures
      throw new Error(`Failed to record participation: ${insertErr.message}`);
    }

    if (inserted) {
      const { error: updErr } = await supabase
        .from('creator_profiles')
        .update({
          total_contests_participated: (await this.getCreatorField(creatorId, 'total_contests_participated')) + 1,
        })
        .eq('id', creatorId);
      if (updErr) throw new Error(`Failed to increment total_contests_participated: ${updErr.message}`);
    }
  },

  async getCreatorField(
    creatorId: string,
    field: 'total_contests_participated' | 'total_contests_won' | 'total_views' | 'total_money_won' | 'withdrawable_balance'
  ): Promise<number> {
    const supabase = createAdminClient();
    type CreatorPick = {
      total_contests_participated?: number;
      total_contests_won?: number;
      total_views?: number;
      total_money_won?: number;
      withdrawable_balance?: number;
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

  // When submission is marked paid: only increment total_contests_won.
  // Money updates are handled elsewhere (payment-utils credit/debit).
  async incrementContestsWon(creatorId: string): Promise<void> {
    const supabase = createAdminClient();
    const currentWonCount = await this.getCreatorField(creatorId, 'total_contests_won');
    const { error } = await supabase
      .from('creator_profiles')
      .update({
        total_contests_won: currentWonCount + 1,
      })
      .eq('id', creatorId);
    if (error) throw new Error(`Failed to increment total_contests_won: ${error.message}`);
  },

  // When paid is reversed or status toggled away from paid: decrement total_contests_won only.
  async decrementContestsWon(creatorId: string): Promise<void> {
    const supabase = createAdminClient();
    const currentWonCount = await this.getCreatorField(creatorId, 'total_contests_won');
    const { error } = await supabase
      .from('creator_profiles')
      .update({
        total_contests_won: Math.max(0, currentWonCount - 1),
      })
      .eq('id', creatorId);
    if (error) throw new Error(`Failed to decrement total_contests_won: ${error.message}`);
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

    // Aggregate deltas per creator
    const creatorDelta = new Map<string, number>();
    const updatesForSnapshot: Array<{ submission_id: string; credited_views: number } > = [];

    for (const s of filtered) {
      const credited = creditedMap.get(s.id) || 0;
      const views = (s.views || 0) as number;
      const delta = Math.max(0, views - credited);
      if (delta > 0) {
        creatorDelta.set(s.creator_id, (creatorDelta.get(s.creator_id) || 0) + delta);
        updatesForSnapshot.push({ submission_id: s.id, credited_views: views });
      }
    }

    // Apply creator deltas
    for (const [creatorId, delta] of creatorDelta) {
      const current = await this.getCreatorField(creatorId, 'total_views');
      const { error: updErr } = await supabase
        .from('creator_profiles')
        .update({ total_views: current + delta })
        .eq('id', creatorId);
      if (updErr) throw new Error(`Failed to update total_views: ${updErr.message}`);
    }

    // Upsert snapshots
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



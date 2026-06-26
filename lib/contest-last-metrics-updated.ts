/**
 * Bump contests.last_metrics_updated after a metrics cron refreshes submissions.
 * CPM budget rollups also set this field; this covers milestone/leaderboard campaigns too.
 */
export async function bumpContestLastMetricsUpdated(
  supabaseAdmin: { from: (t: string) => any },
  contestIds: string[],
): Promise<void> {
  const unique = [...new Set(contestIds.filter(Boolean))];
  if (!unique.length) return;

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("contests")
    .update({ last_metrics_updated: now, updated_at: now })
    .in("id", unique);

  if (error) {
    console.error(
      "[bumpContestLastMetricsUpdated] Failed for contests:",
      unique,
      error,
    );
  }
}

/** Map submission ids that were updated → distinct contest ids from the source rows. */
export function contestIdsForUpdatedSubmissions(
  submissions: Array<{ id: string; contest_id: string }>,
  updatedSubmissionIds: Iterable<string>,
): string[] {
  const updated = new Set(updatedSubmissionIds);
  return [
    ...new Set(
      submissions
        .filter((s) => updated.has(s.id))
        .map((s) => s.contest_id)
        .filter(Boolean),
    ),
  ];
}

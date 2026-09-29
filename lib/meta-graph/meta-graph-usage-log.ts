import { createAdminClient } from "@/utils/supabase/admin";
import { parseXAppUsageRaw } from "@/lib/meta-graph/parse-app-usage";
import type { MetaGraphUsageAccumulator } from "@/lib/meta-graph/usage-accumulator";

export type MetaGraphUsageLogSource =
  | "instagram_insights_batch"
  | "instagram_insights_cron";

type InsertMetaGraphUsageLogParams = {
  source: MetaGraphUsageLogSource;
  contestId: string | null;
  runId: string | null;
  batchIndex: number | null;
  accumulator: MetaGraphUsageAccumulator;
};

function buildRowFields(accumulator: MetaGraphUsageAccumulator): {
  call_count: number;
  total_time: number;
  total_cputime: number;
  business_use_case: Record<string, unknown> | null;
  raw_headers: Record<string, string> | null;
} {
  const raw_headers: Record<string, string> = {};
  if (accumulator.xAppUsageRaw) {
    raw_headers.x_app_usage = accumulator.xAppUsageRaw;
  }
  if (accumulator.xBusinessUseCaseRaw) {
    raw_headers.x_business_use_case_usage = accumulator.xBusinessUseCaseRaw;
  }

  const parsedApp = accumulator.xAppUsageRaw
    ? parseXAppUsageRaw(accumulator.xAppUsageRaw)
    : null;

  let business_use_case: Record<string, unknown> | null = null;
  if (accumulator.xBusinessUseCaseRaw) {
    try {
      const parsed = JSON.parse(accumulator.xBusinessUseCaseRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        business_use_case = parsed as Record<string, unknown>;
      }
    } catch {
      business_use_case = null;
    }
  }

  return {
    call_count: parsedApp?.call_count ?? 0,
    total_time: parsedApp?.total_time ?? 0,
    total_cputime: parsedApp?.total_cputime ?? 0,
    business_use_case,
    raw_headers: Object.keys(raw_headers).length > 0 ? raw_headers : null,
  };
}

/**
 * Append-only snapshot after each Instagram insights batch/cron.
 * “Latest” usage: query the log with ORDER BY created_at DESC LIMIT 1 (or MAX(created_at)).
 * Never throws — failures are logged to console.
 */
export async function insertMetaGraphUsageLogRow(
  params: InsertMetaGraphUsageLogParams
): Promise<void> {
  try {
    const client = createAdminClient();
    const fields = buildRowFields(params.accumulator);

    const { error } = await client.from("meta_graph_app_usage_log").insert({
      source: params.source,
      contest_id: params.contestId,
      run_id: params.runId,
      batch_index: params.batchIndex,
      call_count: fields.call_count,
      total_time: fields.total_time,
      total_cputime: fields.total_cputime,
      business_use_case: fields.business_use_case,
      raw_headers: fields.raw_headers,
    });
    if (error) {
      console.warn(
        "[meta-graph] meta_graph_app_usage_log insert failed:",
        error.message
      );
    }
  } catch (e) {
    console.warn(
      "[meta-graph] meta_graph_app_usage_log insert exception:",
      e instanceof Error ? e.message : e
    );
  }
}

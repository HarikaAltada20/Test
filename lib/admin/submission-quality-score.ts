import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseQualityScore,
  parseQualityScoreCounts,
  type QualityScore,
} from "@/lib/quality-score";

export type CreatorQualitySnapshot = {
  avg_quality_score: number | null;
  best_quality_score: number | null;
  quality_score_counts: {
    score1: number;
    score2: number;
    score3: number;
  };
};

export async function fetchCreatorQualitySnapshots(
  supabaseAdmin: SupabaseClient,
  creatorIds: string[],
): Promise<Record<string, CreatorQualitySnapshot>> {
  const uniqueIds = [...new Set(creatorIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};

  const { data: rows, error } = await supabaseAdmin
    .from("creator_profiles")
    .select("id, avg_quality_score, best_quality_score, quality_score_counts")
    .in("id", uniqueIds);

  if (error) {
    console.error(
      "[submission-quality-score] Failed to load creator quality snapshots:",
      error,
    );
    return {};
  }

  const snapshots: Record<string, CreatorQualitySnapshot> = {};
  (rows || []).forEach((row) => {
    const creatorId = String(row.id || "");
    if (!creatorId) return;
    snapshots[creatorId] = {
      avg_quality_score:
        row.avg_quality_score === null || row.avg_quality_score === undefined
          ? null
          : Number(row.avg_quality_score),
      best_quality_score:
        row.best_quality_score === null || row.best_quality_score === undefined
          ? null
          : Number(row.best_quality_score),
      quality_score_counts: parseQualityScoreCounts(row.quality_score_counts),
    };
  });

  return snapshots;
}

export async function updateSubmissionQualityScores(
  supabaseAdmin: SupabaseClient,
  submissionIds: string[],
  qualityScore: QualityScore,
): Promise<
  | {
      ok: true;
      updatedSubmissions: Array<{
        id: string;
        status: string;
        quality_score: number;
        creator_id: string;
      }>;
      creatorQualityByCreatorId: Record<string, CreatorQualitySnapshot>;
    }
  | { ok: false; error: string; status: number }
> {
  const uniqueIds = [...new Set(submissionIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "submissionIds must be a non-empty array", status: 400 };
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("submissions")
    .select("id, status, creator_id, quality_score")
    .in("id", uniqueIds);

  if (existingError) {
    return {
      ok: false,
      error: existingError.message || "Failed to load submissions",
      status: 500,
    };
  }

  const rows = existingRows || [];
  if (rows.length !== uniqueIds.length) {
    return { ok: false, error: "One or more submissions were not found", status: 404 };
  }

  const invalidStatus = rows.find((row) => {
    const status = String(row.status || "").toLowerCase();
    return status !== "verified" && status !== "paid";
  });
  if (invalidStatus) {
    return {
      ok: false,
      error: "Quality score can only be updated for verified or paid submissions",
      status: 400,
    };
  }

  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("submissions")
    .update({ quality_score: qualityScore })
    .in("id", uniqueIds)
    .select("id, status, quality_score, creator_id");

  if (updateError || !updatedRows?.length) {
    return {
      ok: false,
      error: updateError?.message || "Failed to update quality scores",
      status: 500,
    };
  }

  const creatorIds = updatedRows
    .map((row) => String(row.creator_id || ""))
    .filter(Boolean);
  const creatorQualityByCreatorId = await fetchCreatorQualitySnapshots(
    supabaseAdmin,
    creatorIds,
  );

  return {
    ok: true,
    updatedSubmissions: updatedRows.map((row) => ({
      id: String(row.id),
      status: String(row.status || ""),
      quality_score: Number(row.quality_score),
      creator_id: String(row.creator_id),
    })),
    creatorQualityByCreatorId,
  };
}

export function parseQualityScoreBody(value: unknown): QualityScore | null {
  return parseQualityScore(value);
}

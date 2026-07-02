export type CreatorRequirementFieldInput = {
  trust_score?: unknown;
  trust_number?: unknown;
  min_avg_quality_score?: unknown;
  min_best_quality_score?: unknown;
  min_platform_earnings?: unknown;
  min_platform_views?: unknown;
};

export type NormalizedCreatorRequirementFields = {
  trust_score?: number | null;
  trust_number?: number | null;
  min_avg_quality_score?: number | null;
  min_best_quality_score?: number | null;
  min_platform_earnings?: number | null;
  min_platform_views?: number | null;
};

export function validateCreatorRequirementFields(
  fields: CreatorRequirementFieldInput,
): { ok: true; values: NormalizedCreatorRequirementFields } | { ok: false; error: string } {
  const values: NormalizedCreatorRequirementFields = {};

  if (fields.trust_score !== undefined) {
    if (fields.trust_score === null || fields.trust_score === "") {
      values.trust_score = null;
    } else {
      const trustNum =
        typeof fields.trust_score === "number"
          ? fields.trust_score
          : parseInt(String(fields.trust_score), 10);
      if (Number.isNaN(trustNum) || trustNum < 0 || trustNum > 100) {
        return {
          ok: false,
          error: "trust_score must be between 0 and 100, or null",
        };
      }
      values.trust_score = trustNum;
    }
  }

  if (fields.trust_number !== undefined) {
    if (fields.trust_number === null || fields.trust_number === "") {
      values.trust_number = null;
    } else {
      const trustNumber =
        typeof fields.trust_number === "number"
          ? fields.trust_number
          : parseInt(String(fields.trust_number), 10);
      if (Number.isNaN(trustNumber) || trustNumber < 0) {
        return {
          ok: false,
          error: "trust_number must be a non-negative integer, or null",
        };
      }
      values.trust_number = trustNumber;
    }
  }

  if (fields.min_best_quality_score !== undefined) {
    if (
      fields.min_best_quality_score === null ||
      fields.min_best_quality_score === ""
    ) {
      values.min_best_quality_score = null;
    } else {
      const minBest = Number(fields.min_best_quality_score);
      if (!Number.isInteger(minBest) || minBest < 1 || minBest > 3) {
        return {
          ok: false,
          error:
            "min_best_quality_score must be an integer between 1 and 3, or null",
        };
      }
      values.min_best_quality_score = minBest;
    }
  }

  if (fields.min_avg_quality_score !== undefined) {
    if (
      fields.min_avg_quality_score === null ||
      fields.min_avg_quality_score === ""
    ) {
      values.min_avg_quality_score = null;
    } else {
      const minAvg = Number(fields.min_avg_quality_score);
      if (!Number.isFinite(minAvg) || minAvg < 1 || minAvg > 3) {
        return {
          ok: false,
          error: "min_avg_quality_score must be between 1 and 3, or null",
        };
      }
      values.min_avg_quality_score = minAvg;
    }
  }

  if (fields.min_platform_earnings !== undefined) {
    if (
      fields.min_platform_earnings === null ||
      fields.min_platform_earnings === ""
    ) {
      values.min_platform_earnings = null;
    } else {
      const minEarnings =
        typeof fields.min_platform_earnings === "number"
          ? fields.min_platform_earnings
          : parseInt(String(fields.min_platform_earnings), 10);
      if (!Number.isInteger(minEarnings) || minEarnings <= 0) {
        return {
          ok: false,
          error:
            "min_platform_earnings must be a positive integer (cents), or null",
        };
      }
      values.min_platform_earnings = minEarnings;
    }
  }

  if (fields.min_platform_views !== undefined) {
    if (
      fields.min_platform_views === null ||
      fields.min_platform_views === ""
    ) {
      values.min_platform_views = null;
    } else {
      const minViews =
        typeof fields.min_platform_views === "number"
          ? fields.min_platform_views
          : parseInt(String(fields.min_platform_views), 10);
      if (!Number.isInteger(minViews) || minViews <= 0) {
        return {
          ok: false,
          error: "min_platform_views must be a positive integer, or null",
        };
      }
      values.min_platform_views = minViews;
    }
  }

  return { ok: true, values };
}

export function hasNormalizedCreatorRequirement(
  values: NormalizedCreatorRequirementFields,
): boolean {
  return (
    (values.trust_score !== undefined && values.trust_score !== null) ||
    (values.trust_number !== undefined && values.trust_number !== null) ||
    (values.min_avg_quality_score !== undefined &&
      values.min_avg_quality_score !== null) ||
    (values.min_best_quality_score !== undefined &&
      values.min_best_quality_score !== null) ||
    (values.min_platform_earnings !== undefined &&
      values.min_platform_earnings !== null) ||
    (values.min_platform_views !== undefined &&
      values.min_platform_views !== null)
  );
}

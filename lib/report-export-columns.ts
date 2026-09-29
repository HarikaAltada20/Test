import type { LeaderboardExportFormat } from "@/lib/submission-leaderboard-export";

export const CREATOR_NAME_COLUMN_ID = "creator_name";

/** PDF/Excel use Username only; Creator (display name) stays available for CSV. */
export function omitCreatorNameForSpreadsheetFormats(
  columns: { id: string; label: string }[],
  format: LeaderboardExportFormat,
) {
  if (format === "csv") return columns;
  return columns.filter((c) => c.id !== CREATOR_NAME_COLUMN_ID);
}

import type { LeaderboardExportFormat } from "@/lib/submission-leaderboard-export";
import { toast } from "sonner";

export const PDF_EXPORT_ROW_WARN_THRESHOLD = 1000;

export function maybeWarnLargePdfExport(
  rowCount: number,
  format: LeaderboardExportFormat,
): void {
  if (format !== "pdf" || rowCount <= PDF_EXPORT_ROW_WARN_THRESHOLD) return;
  toast.warning(
    `Large export (${rowCount.toLocaleString()} rows). PDF generation may take a while — Excel is faster for big datasets.`,
  );
}

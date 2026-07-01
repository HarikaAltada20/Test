import { parseQualityScore } from "@/lib/quality-score";
import { formatQualityScoreDisplay } from "@/lib/creator-profile-stats";
import { cn } from "@/lib/utils";

function qualityScoreBadgeClass(score: number): string {
  if (score >= 3) return "bg-green-100 text-green-700 border-green-300";
  if (score >= 2) return "bg-amber-100 text-amber-700 border-amber-300";
  return "bg-orange-100 text-orange-700 border-orange-300";
}

export function SubmissionQualityScoreCell({
  qualityScore,
  isDark = false,
  className,
}: {
  qualityScore?: number | null;
  isDark?: boolean;
  className?: string;
}) {
  const parsed = parseQualityScore(qualityScore);
  if (parsed === null) {
    return (
      <span
        className={cn(
          "text-xs",
          isDark ? "text-slate-500" : "text-slate-400",
          className,
        )}
      >
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
        qualityScoreBadgeClass(parsed),
        className,
      )}
    >
      {formatQualityScoreDisplay(parsed)}
    </span>
  );
}

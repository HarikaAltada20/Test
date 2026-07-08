import { parseQualityScore } from "@/lib/quality-score";
import { formatQualityScoreDisplay } from "@/lib/creator-profile-stats";
import { cn } from "@/lib/utils";

function getQualityScoreTone(score: number, isDark = false) {
  if (score >= 3) {
    return {
      text: isDark ? "text-emerald-400" : "text-emerald-700",
      bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: isDark ? "border-emerald-500/25" : "border-emerald-200",
      badge: isDark
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
        : "bg-emerald-100 text-emerald-700 border-emerald-300",
    };
  }
  if (score >= 2) {
    return {
      text: isDark ? "text-amber-400" : "text-amber-700",
      bg: isDark ? "bg-amber-500/10" : "bg-amber-50",
      border: isDark ? "border-amber-500/25" : "border-amber-200",
      badge: isDark
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-amber-100 text-amber-700 border-amber-300",
    };
  }
  return {
    text: isDark ? "text-orange-400" : "text-orange-700",
    bg: isDark ? "bg-orange-500/10" : "bg-orange-50",
    border: isDark ? "border-orange-500/25" : "border-orange-200",
    badge: isDark
      ? "bg-orange-500/15 text-orange-300 border-orange-300"
      : "bg-orange-100 text-orange-700 border-orange-300",
  };
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

  const tone = getQualityScoreTone(parsed, isDark);

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border",
        tone.badge,
        className,
      )}
    >
      {formatQualityScoreDisplay(parsed)}
    </span>
  );
}

/** Quality score display for creator-facing submission views. */
export function SubmissionQualityScoreDisplay({
  qualityScore,
  isDark = false,
  variant = "inline",
  className,
}: {
  qualityScore?: number | null;
  isDark?: boolean;
  variant?: "inline" | "tile";
  className?: string;
}) {
  const parsed = parseQualityScore(qualityScore);
  if (parsed === null) return null;

  const scoreText = formatQualityScoreDisplay(parsed);

  if (variant === "tile") {
    return (
      <div
        className={cn(
          "rounded-[10px] p-3",
          isDark ? "bg-slate-800/60" : "bg-slate-50",
          className,
        )}
      >
        <p
          className={cn(
            "text-[15px] font-semibold",
            isDark ? "text-slate-300" : "text-slate-700",
          )}
        >
          Quality Score:{" "}
          <span className={cn("font-black", isDark ? "text-white" : "text-slate-900")}>
            {scoreText}
          </span>
        </p>
      </div>
    );
  }

  return (
    <p
      className={cn(
        "text-[15px] font-semibold",
        isDark ? "text-slate-300" : "text-slate-700",
        className,
      )}
    >
      Quality Score:{" "}
      <span className={cn("font-black", isDark ? "text-white" : "text-slate-900")}>
        {scoreText}
      </span>
    </p>
  );
}

import { CircleCheck, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequirementState } from "@/lib/campaign-access";

type Props = {
  state: RequirementState | null | undefined;
  className?: string;
};

/**
 * "Meets requirements" or "Below requirements" for an applicant. Nothing for
 * campaigns without requirements, or whose approved creators skip them.
 */
export function RequirementStateTag({ state, className }: Props) {
  if (state !== "meets" && state !== "below") return null;
  const meets = state === "meets";
  const Icon = meets ? CircleCheck : TriangleAlert;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        meets
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meets ? "Meets requirements" : "Below requirements"}
    </span>
  );
}

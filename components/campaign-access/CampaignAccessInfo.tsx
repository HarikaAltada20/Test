import { Hourglass, PauseCircle, PlayCircle, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPrivateLikeAccessMode } from "@/lib/campaign-access";

type Props = {
  accessMode: string | null | undefined;
  /** Restricted only; null while loading or unknown. */
  applicationsOpen?: boolean | null;
  /** Restricted only; pending applications waiting for review. */
  pendingCount?: number | null;
  skipsRequirements?: boolean | null;
  isDark: boolean;
};

/**
 * One-glance access facts for a brand or admin campaign card: whether
 * applications are open, how many are waiting, and whether creators on the
 * access list skip the requirements. Renders nothing for Public campaigns.
 */
export function CampaignAccessInfo({
  accessMode,
  applicationsOpen,
  pendingCount,
  skipsRequirements,
  isDark,
}: Props) {
  if (!isPrivateLikeAccessMode(accessMode)) return null;
  const restricted = accessMode === "restricted";
  const chip = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium";
  const tones = {
    green: isDark ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-200 bg-emerald-50 text-emerald-700",
    gray: isDark ? "border-white/15 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600",
    amber: isDark ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-800",
    purple: isDark ? "border-[#7F39EC]/40 bg-[#7F39EC]/15 text-purple-200" : "border-purple-200 bg-purple-50 text-[#4A00BE]",
  };

  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Campaign access">
      {restricted && applicationsOpen != null && (
        <li
          className={cn(chip, applicationsOpen ? tones.green : tones.gray)}
          title={
            applicationsOpen
              ? "Creators can apply to this campaign."
              : "Applications are paused. Creators can't apply right now."
          }
        >
          {applicationsOpen ? (
            <PlayCircle className="h-3 w-3" aria-hidden="true" />
          ) : (
            <PauseCircle className="h-3 w-3" aria-hidden="true" />
          )}
          {applicationsOpen ? "Applications open" : "Applications closed"}
        </li>
      )}
      {restricted && pendingCount != null && pendingCount > 0 && (
        <li className={cn(chip, tones.amber)} title="Applications waiting for your review.">
          <Hourglass className="h-3 w-3" aria-hidden="true" />
          {pendingCount} pending
        </li>
      )}
      <li
        className={cn(chip, skipsRequirements ? tones.purple : tones.gray)}
        title={
          skipsRequirements
            ? "Creators on the access list can submit even if they don't meet the requirements."
            : "Creators on the access list still need to meet the requirements to submit."
        }
      >
        {skipsRequirements ? (
          <ShieldOff className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        )}
        {skipsRequirements ? "Skips requirements" : "Requirements apply"}
      </li>
    </ul>
  );
}

import { CardContent } from "@/components/ui/card";
import {
  buildContestEligibilityDisplayItems,
  hasAnyContestCreatorRequirement,
  type ContestCreatorRequirements,
} from "@/lib/creator-requirements";
import { isVideoContestFormat } from "@/lib/trust-score";
import { cn } from "@/lib/utils";
import {
  CheckCheck,
  DollarSign,
  Eye,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

const ELIGIBILITY_ICONS: Record<string, LucideIcon> = {
  "trust-score": CheckCheck,
  "trust-number": CheckCheck,
  "best-quality": Star,
  "min-quality": Star,
  "avg-quality": Star,
  "platform-earnings": DollarSign,
  "platform-views": Eye,
};

function EligibilityRequirementCard({
  icon: Icon,
  label,
  value,
  description,
  isDark,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-300",
        isDark ? "border-slate-600" : "border-[#e5e5e5]",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              isDark
                ? "bg-white/10 text-white"
                : "bg-[#ffedd5] text-[#f97316]",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-md font-medium tracking-wide",
                isDark ? "text-white" : "text-[#0a0a0a]",
              )}
            >
              {label}
            </p>
            <p
              className={cn(
                "mt-1 text-lg font-bold md:text-xl",
                isDark ? "text-white" : "text-[#0a0a0a]",
              )}
            >
              {value}
            </p>
            <p
              className={cn(
                "mt-1 text-md leading-relaxed",
                isDark ? "text-slate-300" : "text-gray-500",
              )}
            >
              {description}
            </p>
          </div>
        </div>
      </CardContent>
    </div>
  );
}

type CreatorEligibilitySectionProps = {
  contest: ContestCreatorRequirements;
  isDark?: boolean;
  className?: string;
  id?: string;
  sectionRef?: (el: HTMLDivElement | null) => void;
};

export function CreatorEligibilitySection({
  contest,
  isDark = false,
  className,
  id = "creator-eligibility",
  sectionRef,
}: CreatorEligibilitySectionProps) {
  if (
    !isVideoContestFormat(contest.contest_format) ||
    !hasAnyContestCreatorRequirement(contest)
  ) {
    return null;
  }

  const items = buildContestEligibilityDisplayItems(contest);
  if (items.length === 0) return null;

  return (
    <div
      id={id}
      ref={sectionRef}
      className={cn("space-y-5 overflow-hidden", className)}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            isDark ? "bg-white/10 text-white" : "bg-[#f5f5f5] text-[#0a0a0a]",
          )}
        >
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h3
            className={cn(
              "text-xl font-semibold tracking-[-0.3px]",
              isDark ? "text-white" : "text-[#0a0a0a]",
            )}
          >
            Creator Eligibility
          </h3>
          <p
            className={cn(
              "text-[14px] leading-relaxed",
              isDark ? "text-slate-300" : "text-gray-500 ",
            )}
          >
            Minimum creator requirements to submit to this campaign. Each item
            compares your platform stats against what the brand set at creation.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ELIGIBILITY_ICONS[item.key] ?? ShieldCheck;
          return (
            <EligibilityRequirementCard
              key={item.key}
              icon={Icon}
              label={item.label}
              value={item.value}
              description={item.description}
              isDark={isDark}
            />
          );
        })}
      </div>
    </div>
  );
}

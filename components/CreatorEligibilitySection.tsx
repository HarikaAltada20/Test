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
        "border rounded-xl transition-all duration-300",
        isDark ? "border-gray-600" : "border-gray-300",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-full shrink-0",
              isDark ? "bg-[#FFFFFF42] text-white" : "bg-purple-100 text-[#4A00BE]",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-md font-medium tracking-wide",
                isDark ? "text-white" : "text-black",
              )}
            >
              {label}
            </p>
            <p
              className={cn(
                "text-lg md:text-xl font-bold mt-1",
                isDark ? "text-white" : "text-black",
              )}
            >
              {value}
            </p>
            <p
              className={cn(
                "text-sm mt-1 leading-relaxed",
                isDark ? "text-gray-300" : "text-muted-foreground",
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
      className={cn("space-y-3", className)}
    >
      <h3
        className={cn(
          "font-semibold text-xl flex items-center gap-2",
          isDark ? "text-white" : "text-foreground",
        )}
      >
        <ShieldCheck className="h-6 w-6 text-[#7F39EC]" />
        Creator Eligibility
      </h3>
      <p
        className={cn(
          "text-sm leading-relaxed",
          isDark ? "text-gray-300" : "text-muted-foreground",
        )}
      >
        Minimum creator requirements to submit to this campaign. Each item
        compares your platform stats against what the brand set at creation.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

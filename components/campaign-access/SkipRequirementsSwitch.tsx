"use client";

import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Extra line under the label, e.g. where to add more creators later. */
  note?: string;
};

const EXAMPLE =
  "Example: the campaign needs a trust score of 60. A creator you added with a score of 40 can still submit while this is on.";

/** "Creators on the access list skip requirements" as a switch with an example tooltip. */
export function SkipRequirementsSwitch({ checked, onCheckedChange, disabled, note }: Props) {
  const isDark = useDashboardDark();
  return (
    <div className={cn("flex items-start gap-3", isDark && "dark")}>
      <Switch
        id="accessListSkipsRequirements"
        variant="theme-aware"
        theme={isDark ? "dark" : "light"}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby="accessListSkipsRequirements-help"
      />
      <div className="text-sm">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="accessListSkipsRequirements"
            className="cursor-pointer font-medium text-gray-900 dark:text-gray-100"
          >
            Creators on the access list skip requirements
          </label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Example"
                  className="rounded-full text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:text-gray-200"
                >
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipPortal>
              <TooltipContent className="max-w-64 border-gray-200 bg-white text-xs text-gray-900">
                {EXAMPLE}
              </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p id="accessListSkipsRequirements-help" className="text-xs text-gray-500 dark:text-gray-400">
          When off, creators you add still need to meet the requirements below.
          {note ? ` ${note}` : ""}
        </p>
      </div>
    </div>
  );
}

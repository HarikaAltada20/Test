"use client";

import { format, formatDistanceToNowStrict } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  /** Text before the relative date, e.g. "Sent". */
  prefix?: string;
  className?: string;
};

/** "2 days ago", with the exact date and time on hover or keyboard focus. */
export function RelativeTime({ value, prefix, className }: Props) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const exact = format(date, "PPp");
  const relative = formatDistanceToNowStrict(date, { addSuffix: true });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            dateTime={date.toISOString()}
            tabIndex={0}
            className={cn(
              "cursor-default rounded-sm underline decoration-dotted decoration-gray-300 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:decoration-white/30",
              className,
            )}
          >
            {prefix ? `${prefix} ${relative}` : relative}
            <span className="sr-only"> ({exact})</span>
          </time>
        </TooltipTrigger>
        <TooltipPortal>
        <TooltipContent className="border-gray-200 bg-white text-xs text-gray-900">
          {exact}
        </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    </TooltipProvider>
  );
}

"use client";

import type { ReactNode } from "react";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";

type Props = {
  step: number;
  title: string;
  description?: string;
  /** Extra controls on the right of the heading, e.g. a preview button. */
  action?: ReactNode;
  children?: ReactNode;
  accent?: "purple" | "ink";
};

/** A numbered step inside the "Who can see this campaign" settings. */
export function AccessStep({ step, title, description, action, children, accent = "purple" }: Props) {
  const isDark = useDashboardDark();
  const ink = accent === "ink";
  const headingId = `access-step-${step}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className={cn("space-y-3", isDark && "dark")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
              ink ? "bg-[#1a1a1a]" : "bg-[#7F39EC]",
            )}
            aria-hidden="true"
          >
            {step}
          </span>
          <div>
            <h4 id={headingId} className="text-sm font-semibold text-gray-900 dark:text-white">
              <span className="sr-only">Step {step}: </span>
              {title}
            </h4>
            {description && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children && <div className="sm:pl-9">{children}</div>}
    </section>
  );
}

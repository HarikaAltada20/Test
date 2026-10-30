import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Buttons for the next step; the first should be the primary action. */
  actions?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, actions, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-12 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-4 text-[17px] font-semibold text-[#1a1a1a] dark:text-white">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-[#8d8d95] dark:text-white/50">{description}</p>
      )}
      {actions && (
        <div className="mt-5 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}

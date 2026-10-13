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
    <div className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-[#7F39EC] dark:bg-[#7F39EC]/20 dark:text-purple-200">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-3 font-medium text-gray-900 dark:text-white">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      {actions && (
        <div className="mt-4 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}

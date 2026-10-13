"use client";

import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PREVIEW_DESCRIPTION_LENGTH } from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";

type Props = {
  description: string;
  onDescriptionChange: (value: string) => void;
  applicationsOpen: boolean;
  onApplicationsOpenChange: (value: boolean) => void;
  disabled?: boolean;
};

const PLACEHOLDER = [
  "Who we're looking for: lifestyle creators who post short, upbeat videos.",
  "What you'll create: one 30–60 second video showing how you use the product.",
  "Timeline: apply by the 20th, post within a week of approval.",
].join("\n");

export function PreviewEditor({
  description,
  onDescriptionChange,
  applicationsOpen,
  onApplicationsOpenChange,
  disabled,
}: Props) {
  const isDark = useDashboardDark();
  const nearLimit = description.length >= MAX_PREVIEW_DESCRIPTION_LENGTH * 0.9;
  const empty = !description.trim();

  return (
    <div className={cn("space-y-4 rounded-lg border border-gray-200 p-4 dark:border-white/10", isDark && "dark")}>
      <div className="space-y-2">
        <Label
          htmlFor="restricted-preview-description"
          className="font-medium text-gray-900 dark:text-gray-100"
        >
          Preview description
        </Label>
        <p id="restricted-preview-description-help" className="text-xs text-gray-500 dark:text-gray-400">
          Creators who aren&apos;t approved yet only see the title, brand, thumbnail, dates,
          prize and this description.
        </p>
        <Textarea
          id="restricted-preview-description"
          rows={5}
          maxLength={MAX_PREVIEW_DESCRIPTION_LENGTH}
          placeholder={PLACEHOLDER}
          aria-describedby="restricted-preview-description-help restricted-preview-description-count"
          className="dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
          value={description}
          disabled={disabled}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
        <div className="flex items-start justify-between gap-3">
          {empty ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Creators will only see the title and prize.
            </p>
          ) : (
            <span />
          )}
          <p
            id="restricted-preview-description-count"
            className={cn(
              "shrink-0 text-xs",
              nearLimit ? "font-medium text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500",
            )}
          >
            {description.length}/{MAX_PREVIEW_DESCRIPTION_LENGTH}
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <Switch
          variant="theme-aware"
          theme={isDark ? "dark" : "light"}
          checked={applicationsOpen}
          disabled={disabled}
          onCheckedChange={onApplicationsOpenChange}
        />
        <span className="text-sm text-gray-900 dark:text-gray-100">
          <span className="font-medium">Accepting applications</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Turn off to pause new applications without changing who already has access.
          </span>
        </span>
      </label>
    </div>
  );
}

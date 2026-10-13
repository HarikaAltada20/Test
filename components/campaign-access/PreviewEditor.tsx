"use client";

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

export function PreviewEditor({
  description,
  onDescriptionChange,
  applicationsOpen,
  onApplicationsOpenChange,
  disabled,
}: Props) {
  const isDark = useDashboardDark();
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
          rows={4}
          maxLength={MAX_PREVIEW_DESCRIPTION_LENGTH}
          placeholder="What is this campaign about, and who should apply?"
          aria-describedby="restricted-preview-description-help"
          className="dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
          value={description}
          disabled={disabled}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
        <p className="text-right text-xs text-gray-400 dark:text-gray-500">
          {description.length}/{MAX_PREVIEW_DESCRIPTION_LENGTH}
        </p>
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

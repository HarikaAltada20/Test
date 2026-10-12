"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PREVIEW_DESCRIPTION_LENGTH } from "@/lib/campaign-access";

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
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div className="space-y-2">
        <Label htmlFor="restricted-preview-description" className="font-medium">
          Preview description
        </Label>
        <p className="text-xs text-gray-500">
          Creators who aren&apos;t approved yet only see the title, brand, thumbnail, dates,
          prize and this description.
        </p>
        <Textarea
          id="restricted-preview-description"
          rows={4}
          maxLength={MAX_PREVIEW_DESCRIPTION_LENGTH}
          placeholder="What is this campaign about, and who should apply?"
          value={description}
          disabled={disabled}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
        <p className="text-right text-xs text-gray-400">
          {description.length}/{MAX_PREVIEW_DESCRIPTION_LENGTH}
        </p>
      </div>

      <label className="flex items-start gap-3">
        <Switch
          checked={applicationsOpen}
          disabled={disabled}
          onCheckedChange={onApplicationsOpenChange}
        />
        <span className="text-sm">
          <span className="font-medium">Accepting applications</span>
          <span className="block text-xs text-gray-500">
            Turn off to pause new applications without changing who already has access.
          </span>
        </span>
      </label>
    </div>
  );
}

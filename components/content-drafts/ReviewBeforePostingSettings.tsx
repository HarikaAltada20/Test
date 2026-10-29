"use client";

import { useEffect, useId, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DRAFT_MAX_OPEN,
  DEFAULT_DRAFT_MAX_REVISIONS,
  DRAFT_LIMIT_RANGES,
  MAX_DRAFT_DURATION_SEC,
  MAX_DRAFT_FILE_BYTES,
  type DraftReviewSettings,
} from "@/lib/content-drafts";

type Props = {
  value: DraftReviewSettings;
  onChange: (next: DraftReviewSettings) => void;
  isDark: boolean;
  /** Ask before switching on or off, e.g. when editing a campaign that's already live. */
  confirmChanges?: boolean;
  disabled?: boolean;
};

/**
 * "Review before posting" campaign setting for the create and edit forms:
 * the switch plus the three optional limits.
 */
export function ReviewBeforePostingSettings({ value, onChange, isDark, confirmChanges, disabled }: Props) {
  const id = useId();
  const [pending, setPending] = useState<boolean | null>(null);
  const enabled = value.review_before_posting;

  const setEnabled = (next: boolean) => {
    if (next === enabled) return;
    if (confirmChanges) {
      setPending(next);
      return;
    }
    onChange({ ...value, review_before_posting: next });
  };

  const maxMb = Math.round(MAX_DRAFT_FILE_BYTES / (1024 * 1024));
  const maxMin = Math.round(MAX_DRAFT_DURATION_SEC / 60);
  const muted = isDark ? "text-gray-300" : "text-gray-600";

  return (
    <div
      className={cn(
        "space-y-4 rounded-lg border p-4",
        isDark ? "border-[#C9A7FF] bg-[#C9A7FF26]" : "bg-gray-50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor={`${id}-switch`} className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-[#7F39EC]" aria-hidden="true" />
            Review before posting
          </Label>
          <p id={`${id}-help`} className={cn("mt-1 text-sm", muted)}>
            Creators upload their video for your approval before posting. Only approved videos can be
            submitted.
          </p>
        </div>
        <Switch
          id={`${id}-switch`}
          variant="theme-aware"
          theme={isDark ? "dark" : "light"}
          checked={enabled}
          disabled={disabled}
          onCheckedChange={setEnabled}
          aria-describedby={`${id}-help`}
        />
      </div>

      {enabled && (
        <div className="space-y-4 border-t pt-4">
          <p className={cn("text-sm", muted)}>
            Creators upload drafts from the campaign page, and you review them in the campaign&apos;s Drafts
            tab. Videos can be up to {maxMb} MB and {maxMin} minutes (MP4, MOV or WebM).
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <LimitField
              label="Open drafts per creator"
              help="Drafts in review or waiting for a revision. Leave empty for no limit."
              placeholder="No limit"
              value={value.draft_max_open}
              range={DRAFT_LIMIT_RANGES.open}
              defaultHint={DEFAULT_DRAFT_MAX_OPEN}
              disabled={disabled}
              isDark={isDark}
              onChange={(n) => onChange({ ...value, draft_max_open: n })}
            />
            <LimitField
              label="Revision rounds per draft"
              help="After this many rounds you can only approve or reject. Leave empty for no limit."
              placeholder="No limit"
              value={value.draft_max_revisions}
              range={DRAFT_LIMIT_RANGES.revisions}
              defaultHint={DEFAULT_DRAFT_MAX_REVISIONS}
              disabled={disabled}
              isDark={isDark}
              onChange={(n) => onChange({ ...value, draft_max_revisions: n })}
            />
            <LimitField
              label="Rejections before new drafts are blocked"
              help="Per creator. Their approved drafts and submissions keep working. Leave empty to turn this off."
              placeholder="Off"
              value={value.draft_max_rejections}
              range={DRAFT_LIMIT_RANGES.rejections}
              disabled={disabled}
              isDark={isDark}
              onChange={(n) => onChange({ ...value, draft_max_rejections: n })}
            />
          </div>
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? "Turn on review before posting?" : "Turn off review before posting?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              {pending
                ? "Once you save, creators need your approval for each video before they can submit its link. Links already submitted aren't affected."
                : "Once you save, creators can post and submit links without your approval. Drafts already sent stay visible, and approved ones can still be linked."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={cn(isDark && "border-white/15 bg-transparent text-gray-200 hover:bg-white/10 hover:text-white")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
              onClick={() => {
                if (pending !== null) onChange({ ...value, review_before_posting: pending });
                setPending(null);
              }}
            >
              {pending ? "Turn on" : "Turn off"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LimitField({
  label,
  help,
  placeholder,
  value,
  range,
  defaultHint,
  disabled,
  isDark,
  onChange,
}: {
  label: string;
  help: string;
  placeholder: string;
  value: number | null;
  range: { min: number; max: number };
  defaultHint?: number;
  disabled?: boolean;
  isDark: boolean;
  onChange: (value: number | null) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  // Follow outside changes (loaded campaign, clamping) except while typing.
  useEffect(() => {
    if (!focused) setText(value == null ? "" : String(value));
  }, [value, focused]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium leading-snug">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        step={1}
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        aria-describedby={`${id}-help`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          setText(raw);
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Math.min(range.max, Math.max(range.min, parseInt(raw, 10)));
          if (Number.isFinite(n)) onChange(n);
        }}
        className={cn("max-w-[10rem]", isDark ? "border border-gray-400 bg-[#C9A7FF26] text-white" : "bg-white text-black")}
      />
      <p id={`${id}-help`} className={cn("text-xs", isDark ? "text-gray-400" : "text-gray-500")}>
        {help}
        {defaultHint != null && ` Default ${defaultHint}.`}
      </p>
    </div>
  );
}

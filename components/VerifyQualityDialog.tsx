"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QualityScore } from "@/lib/quality-score";

const QUALITY_OPTIONS: {
  value: QualityScore;
  description: string;
}[] = [
  {
    value: 1,
    description: "Meets brief — simple clip, room to grow",
  },
  {
    value: 2,
    description: "Below average quality — basic edit",
  },
  {
    value: 3,
    description: "Decent edit — solid and usable",
  },
  {
    value: 4,
    description: "Strong — hook, subtitles, music, and polished edit",
  },
  {
    value: 5,
    description: "Exceptional — stands out; feels premium end-to-end",
  },
];

const VERIFY_BUTTON_LABELS: Record<QualityScore, string> = {
  1: "Verify — Meets brief (1)",
  2: "Verify — Below average (2)",
  3: "Verify — Decent edit (3)",
  4: "Verify — Strong (4)",
  5: "Verify — Exceptional (5)",
};

const EDIT_BUTTON_LABELS: Record<QualityScore, string> = {
  1: "Save — Meets brief (1)",
  2: "Save — Below average (2)",
  3: "Save — Decent edit (3)",
  4: "Save — Strong (4)",
  5: "Save — Exceptional (5)",
};

type VerifyQualityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionCount?: number;
  onConfirm: (qualityScore: QualityScore) => void;
  loading?: boolean;
  variant?: "verify" | "edit";
  initialQuality?: QualityScore;
};

export function VerifyQualityDialog({
  open,
  onOpenChange,
  submissionCount = 1,
  onConfirm,
  loading = false,
  variant = "verify",
  initialQuality = 1,
}: VerifyQualityDialogProps) {
  const [selectedQuality, setSelectedQuality] = useState<QualityScore>(1);
  const isEdit = variant === "edit";
  const buttonLabels = isEdit ? EDIT_BUTTON_LABELS : VERIFY_BUTTON_LABELS;

  useEffect(() => {
    if (open) {
      setSelectedQuality(initialQuality);
    }
  }, [open, initialQuality]);

  const handleVerify = () => {
    if (loading) return;
    onConfirm(selectedQuality);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[100]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
            "sm:max-w-md",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (loading) event.preventDefault();
          }}
        >
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Update quality score"
              : `Verify submission${submissionCount > 1 ? "s" : ""}`}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? submissionCount > 1
                ? `Choose a quality score (1–5), then click Save to update ${submissionCount} submissions.`
                : "Choose a quality score (1–5), then click Save to update this submission."
              : "Select a quality score (1–5), then click Verify to confirm."}
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Quality score"
          className="space-y-2 py-2 max-h-[50vh] overflow-y-auto"
        >
          {QUALITY_OPTIONS.map((option) => {
            const isSelected = selectedQuality === option.value;
            const inputId = `verify-quality-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer rounded-md border bg-background px-4 py-3 transition-colors",
                  "hover:bg-muted/50",
                  loading && "pointer-events-none opacity-50",
                  isSelected
                    ? "border-[#7F39EC] ring-1 ring-[#7F39EC]"
                    : "border-input",
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="verify-quality-score"
                  value={option.value}
                  checked={isSelected}
                  disabled={loading}
                  className="sr-only"
                  onChange={() => setSelectedQuality(option.value)}
                />
                <div>
                  <div className="font-semibold">{option.value}</div>
                  <div className="text-sm text-muted-foreground">
                    {option.description}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full bg-[#7F39EC] hover:bg-[#6B2FD4] text-white"
            onClick={handleVerify}
            disabled={loading}
          >
            {loading
              ? isEdit
                ? "Saving…"
                : "Verifying…"
              : buttonLabels[selectedQuality]}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

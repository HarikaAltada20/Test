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
  { value: 1, description: "Meets brief, acceptable (default)" },
  { value: 2, description: "Strong — good hook, edit, creativity" },
  { value: 3, description: "Exceptional — best-in-class reel" },
];

const VERIFY_BUTTON_LABELS: Record<QualityScore, string> = {
  1: "Verify — Acceptable (1)",
  2: "Verify — Strong (2)",
  3: "Verify — Exceptional (3)",
};

type VerifyQualityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionCount?: number;
  onConfirm: (qualityScore: QualityScore) => void;
  loading?: boolean;
};

export function VerifyQualityDialog({
  open,
  onOpenChange,
  submissionCount = 1,
  onConfirm,
  loading = false,
}: VerifyQualityDialogProps) {
  const [selectedQuality, setSelectedQuality] = useState<QualityScore>(1);

  useEffect(() => {
    if (open) {
      setSelectedQuality(1);
    }
  }, [open]);

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
            Verify submission{submissionCount > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Select a quality score (1–3), then click Verify to confirm.
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Quality score"
          className="space-y-2 py-2"
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
            {loading ? "Verifying…" : VERIFY_BUTTON_LABELS[selectedQuality]}
          </Button>
          <Button
            type="button"
            variant="ghost"
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

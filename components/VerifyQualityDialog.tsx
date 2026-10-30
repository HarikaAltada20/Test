"use client";

import { CheckCircle2, Check, Star, X } from "lucide-react";
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
            "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-3 rounded-2xl border p-4 shadow-2xl duration-200",
            "border-[#e5e5e5] bg-white text-slate-900 dark:border-white/10 dark:bg-[#111113] dark:text-white",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "sm:max-w-md",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (loading) event.preventDefault();
          }}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute -top-1 -right-1 p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100">
                <Star className="h-6 w-6" />
              </div>
              <div className="min-w-0 pr-6">
                <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {isEdit
                    ? "Update quality score"
                    : `Verify submission${submissionCount > 1 ? "s" : ""}`}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isEdit
                    ? submissionCount > 1
                      ? `Choose a quality score (1–5), then click Save to update ${submissionCount} submissions.`
                      : "Choose a quality score (1–5), then click Save to update this submission."
                    : "Rate the content quality before verifying. Higher scores influence rankings and bonuses."}
                </DialogDescription>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="Quality score"
              className="mt-5 space-y-2.5 max-h-[50vh] overflow-y-auto"
            >
              {QUALITY_OPTIONS.map((option) => {
                const isSelected = selectedQuality === option.value;
                const inputId = `verify-quality-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={inputId}
                    className={cn(
                      "flex items-center gap-3.5 cursor-pointer rounded-2xl border p-3.5 transition-all",
                      loading && "pointer-events-none opacity-50",
                      isSelected
                        ? "border-2 border-black bg-slate-50/60 dark:border-white dark:bg-white/[0.04] shadow-sm"
                        : "border-slate-200/90 bg-white hover:bg-slate-50/60 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5",
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
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors",
                        isSelected
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
                      )}
                    >
                      {option.value}
                    </span>
                    <span className="flex-1 min-w-0 text-[13px] sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      {option.description}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-black dark:text-white" />
                    )}
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 h-11 font-semibold text-sm text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                className="rounded-xl bg-[#0a0a0a] hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 px-5 py-2.5 h-11 font-semibold text-sm shadow-sm gap-2 transition-colors"
              >
                <Check className="h-4 w-4" />
                {loading
                  ? isEdit
                    ? "Saving…"
                    : "Verifying…"
                  : isEdit
                    ? `Save with score ${selectedQuality}`
                    : `Verify with score ${selectedQuality}`}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

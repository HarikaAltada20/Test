"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QualityScore } from "@/lib/quality-score";

const QUALITY_OPTIONS: {
  value: QualityScore;
  label: string;
  description: string;
}[] = [
  { value: 1, label: "1 — Acceptable", description: "Meets brief, acceptable (default)" },
  { value: 2, label: "2 — Strong", description: "Good hook, edit, and creativity" },
  { value: 3, label: "3 — Exceptional", description: "Best-in-class reel" },
];

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verify submission{submissionCount > 1 ? "s" : ""}</DialogTitle>
          <DialogDescription>
            Rate content quality (1–3). Default is 1 if you confirm without changing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {QUALITY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              disabled={loading}
              className={cn(
                "h-auto w-full justify-start whitespace-normal px-4 py-3 text-left",
                option.value === 1 && "border-[#7F39EC]",
              )}
              onClick={() => onConfirm(option.value)}
            >
              <div>
                <div className="font-semibold">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(1)} disabled={loading}>
            Verify with default (1)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

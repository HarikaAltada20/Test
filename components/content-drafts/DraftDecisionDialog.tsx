"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DRAFT_REJECTION_PRESETS,
  DRAFT_REVISION_PRESETS,
  MAX_DRAFT_REASON_LENGTH,
} from "@/lib/content-drafts";

export type DecisionKind = "request_revision" | "reject";

type Props = {
  /** Open when set. */
  kind: DecisionKind | null;
  /** The draft is approved: this withdraws the approval. */
  revoking: boolean;
  /** e.g. "@vish's draft". */
  name: string;
  busy: boolean;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

const outlineDark = "text-gray-900 dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

/** Reason box for "Request revision" and "Reject" (a reason is required for both). */
export function DraftDecisionDialog({ kind, revoking, name, busy, isDark, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const open = kind !== null;
  const presets = kind === "reject" ? DRAFT_REJECTION_PRESETS : DRAFT_REVISION_PRESETS;
  const trimmed = reason.trim();

  useEffect(() => {
    if (open) {
      setReason("");
      setPreset(null);
    }
  }, [open, kind]);

  const choose = (value: string) => {
    // Replace an untouched preset; keep anything the reviewer typed.
    setReason((prev) => {
      const text = prev.trim();
      if (!text || (preset !== null && text === preset)) return value;
      return text.startsWith(value) ? text : `${value}. ${text}`;
    });
    setPreset(value);
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  };

  const title =
    kind === "reject"
      ? revoking
        ? "Withdraw approval and reject?"
        : "Reject this draft?"
      : revoking
        ? "Withdraw approval and ask for changes?"
        : "Ask for changes?";

  const description =
    kind === "reject"
      ? `This closes ${name}. The creator can start a new draft${revoking ? " and can no longer post this one" : ""}.`
      : `${revoking ? "The creator can no longer post this version. " : ""}They upload a new version in the same draft and you review it again.`;

  return (
    <Dialog isdark={isDark} open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className={cn("sm:max-w-lg", isDark ? "dark text-white" : "text-gray-900")}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="dark:text-gray-400">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div role="group" aria-label="Quick reasons" className="flex flex-wrap gap-2">
            {presets.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={preset === value}
                onClick={() => choose(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] dark:focus-visible:ring-white",
                  preset === value
                    ? "border-[#0a0a0a] bg-[#0a0a0a] text-white dark:border-white dark:bg-white dark:text-[#0a0a0a]"
                    : "border-[#e5e5e5] text-[#404040] hover:bg-[#fafafa] dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="draft-decision-reason">
              {kind === "reject" ? "Reason" : "What should change?"}
            </Label>
            <Textarea
              id="draft-decision-reason"
              ref={textRef}
              rows={4}
              maxLength={MAX_DRAFT_REASON_LENGTH}
              className="dark:border-white/15 dark:bg-white/5 dark:text-white"
              placeholder={
                kind === "reject"
                  ? "Tell the creator why, so their next draft fits."
                  : "Be specific, e.g. “Show the product in the first 3 seconds and say the discount code.”"
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>The creator sees this in the draft and in their notification.</span>
              <span>
                {reason.length}/{MAX_DRAFT_REASON_LENGTH}
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className={outlineDark} onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={kind === "reject" ? "destructive" : "default"}
            className={kind === "reject" ? undefined : "bg-amber-600 text-white hover:bg-amber-700"}
            disabled={busy || !trimmed}
            onClick={() => onConfirm(trimmed)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {kind === "reject" ? "Reject draft" : "Request revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
import { MAX_REJECTION_REASON_LENGTH, REJECTION_REASON_PRESETS } from "@/lib/campaign-access";

type Props = {
  /** Number of applications being rejected; the dialog is open when this is above 0. */
  count: number;
  /** Creator name for a single rejection, e.g. "@vish". */
  name?: string;
  busy: boolean;
  isDark: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

const outlineDark = "text-gray-900 dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

export function RejectApplicationsDialog({ count, name, busy, isDark, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const open = count > 0;

  useEffect(() => {
    if (open) {
      setReason("");
      setPreset(null);
    }
  }, [open]);

  const choose = (value: string) => {
    setPreset(value);
    if (value === "Other") {
      setReason("");
      textRef.current?.focus();
    } else {
      setReason(value);
    }
  };

  const trimmed = reason.trim();

  return (
    <Dialog isdark={isDark} open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className={cn("sm:max-w-lg", isDark ? "dark text-white" : "text-gray-900")}>
        <DialogHeader>
          <DialogTitle>
            {count > 1 ? `Reject ${count} applications?` : `Reject ${name ?? "this application"}?`}
          </DialogTitle>
          <DialogDescription>
            {count > 1 ? "Each creator" : "The creator"} gets a notification. You can approve them
            later if you change your mind.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div role="group" aria-label="Quick reasons" className="flex flex-wrap gap-2">
            {[...REJECTION_REASON_PRESETS, "Other"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={preset === value}
                onClick={() => choose(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                  preset === value
                    ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                    : "border-gray-200 text-gray-700 hover:border-[#7F39EC]/60 dark:border-white/15 dark:text-gray-200",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea
              id="reject-reason"
              ref={textRef}
              rows={3}
              maxLength={MAX_REJECTION_REASON_LENGTH}
              className="dark:border-white/15 dark:bg-white/5 dark:text-white"
              placeholder="Tell the creator why, so they know what to improve."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-right text-xs text-gray-400 dark:text-gray-500">
              {reason.length}/{MAX_REJECTION_REASON_LENGTH}
            </p>
          </div>
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
            <span className="font-medium">The creator will see:</span> “Not selected this time”
            {trimmed ? <> with “{trimmed}”</> : " with no reason"}.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className={outlineDark} onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(trimmed)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {count > 1 ? `Reject ${count}` : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  submitting?: boolean;
  initialName?: string;
  title?: string;
  submitLabel?: string;
};

export function CreateScheduleModal({
  open,
  onClose,
  onSubmit,
  submitting = false,
  initialName = "",
  title = "Create Schedule",
  submitLabel = "Create",
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md bg-white gap-0 p-0 overflow-hidden">
        <DialogHeader className="pt-2 pb-4 border-b border-gray-100">
          <DialogTitle className="text-lg font-bold text-gray-900">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-5 space-y-2">
          <Label className="text-sm font-medium text-gray-700">
            Schedule Name
          </Label>
          <Input
            placeholder="e.g., Morning Window"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
            className="border-gray-200"
            autoFocus
          />
        </div>

        <DialogFooter className="pb-2 pt-2">
          <Button
            variant="outline"
            className="border-[#662EBD] text-[#662EBD] hover:bg-purple-50 hover:text-[#662EBD]"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#662EBD] hover:bg-[#5524a8] text-white"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

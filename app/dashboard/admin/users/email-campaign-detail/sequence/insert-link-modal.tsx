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
  isOpen: boolean;
  onClose: () => void;
  onInsert: (url: string, text?: string) => void;
  defaultText?: string;
};

export function InsertLinkModal({
  isOpen,
  onClose,
  onInsert,
  defaultText = "",
}: Props) {
  const [url, setUrl] = useState("https://");
  const [text, setText] = useState("");

  useEffect(() => {
    if (isOpen) {
      setUrl("https://");
      setText(defaultText);
    }
  }, [isOpen, defaultText]);

  const trimmedUrl = url.trim();
  const canInsert = trimmedUrl.length > 0 && trimmedUrl !== "https://";

  const handleInsert = () => {
    if (!canInsert) return;
    onInsert(trimmedUrl, text.trim() || undefined);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-white gap-0 p-0 overflow-hidden">
        <DialogHeader className="border-b border-gray-100">
          <DialogTitle className="text-lg font-bold text-gray-900">
            Insert Link
          </DialogTitle>
        </DialogHeader>

        <div className="py-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-normal text-gray-500">URL</Label>
            <Input
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canInsert && handleInsert()}
              className="border-gray-200"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal text-gray-500">
              Text (optional)
            </Label>
            <Input
              placeholder="Link text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canInsert && handleInsert()}
              className="border-gray-200"
            />
          </div>
        </div>

        <DialogFooter className="pb-3 pt-2">
          <Button
            variant="outline"
            className="border-[#662EBD] text-[#662EBD] hover:bg-purple-50 hover:text-[#662EBD]"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#662EBD] hover:bg-[#5524a8] text-white"
            onClick={handleInsert}
            disabled={!canInsert}
          >
            Insert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

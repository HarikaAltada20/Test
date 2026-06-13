"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SequenceStep } from "@/lib/admin-email/sequence-types";
import { useSequence } from "./sequence-context";
import { EmailRichTextEditor } from "./email-rich-text-editor";
import { Braces, Mail } from "lucide-react";

type Props = {
  step: SequenceStep;
  onSave: (step: SequenceStep) => Promise<void>;
  onClose: () => void;
  projectId?: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export function SequenceStepEditor({
  step,
  onSave,
  onClose,
  onDirtyChange,
}: Props) {
  const { state } = useSequence();
  const [draft, setDraft] = useState(step);
  const [saving, setSaving] = useState(false);

  const activeVariant = state.selectedVariantId
    ? draft.variants.find((v) => v.id === state.selectedVariantId)
    : draft.variants.find((v) => v.is_active) ?? draft.variants[0] ?? null;

  useEffect(() => {
    setDraft(step);
  }, [step]);

  const subject = activeVariant ? activeVariant.subject : draft.subject;
  const body = activeVariant ? activeVariant.body : draft.body;

  const setSubject = (value: string) => {
    onDirtyChange?.(true);
    if (activeVariant) {
      setDraft({
        ...draft,
        variants: draft.variants.map((v) =>
          v.id === activeVariant.id ? { ...v, subject: value } : v,
        ),
      });
    } else {
      setDraft({ ...draft, subject: value });
    }
  };

  const setBody = (value: string) => {
    onDirtyChange?.(true);
    if (activeVariant) {
      setDraft({
        ...draft,
        variants: draft.variants.map((v) =>
          v.id === activeVariant.id ? { ...v, body: value } : v,
        ),
      });
    } else {
      setDraft({ ...draft, body: value });
    }
  };

  const handleSave = async (andClose = false) => {
    setSaving(true);
    try {
      await onSave(draft);
      onDirtyChange?.(false);
      if (andClose) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm h-full flex flex-col">
      <div className="p-5 space-y-4 flex-1 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Mail className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-gray-900">Step {draft.stepNumber}</p>
              <p className="text-sm text-gray-500">
                {draft.variants.length} variant
                {draft.variants.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-gray-800 font-medium flex items-center gap-1">
              Subject <Braces className="h-3.5 w-3.5 text-gray-400" />
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-[#8B5CF6]">
                  <Braces className="h-3.5 w-3.5 mr-1" />
                  Variables
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {["{full_name}", "{email}", "{username}", "{user_type}"].map(
                  (tag) => (
                    <DropdownMenuItem
                      key={tag}
                      onClick={() => setSubject(subject + tag)}
                    >
                      {tag}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject..."
            className="bg-white border-gray-300 h-11"
          />
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <Label className="text-gray-800 font-medium">Email Body</Label>
          <EmailRichTextEditor
            value={body}
            onChange={setBody}
            onSave={() => handleSave(false)}
            saving={saving}
          />
        </div>
      </div>
    </div>
  );
}

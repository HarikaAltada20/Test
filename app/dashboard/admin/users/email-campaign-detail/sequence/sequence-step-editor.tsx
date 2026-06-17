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
import {
  BULK_EMAIL_MERGE_VARIABLES,
  mergeTag,
} from "@/lib/admin-notifications/template";
import type { SequenceStep } from "@/lib/admin-email/sequence-types";
import { useSequence } from "./sequence-context";
import { EmailRichTextEditor } from "./email-rich-text-editor";
import { EmailTemplatePickerModal } from "./email-template-picker-modal";
import {
  Braces,
  Eye,
  LayoutGrid,
  Mail,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  step: SequenceStep;
  onSave: (step: SequenceStep) => Promise<void>;
  onClose: () => void;
  projectId?: string;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
};

export function SequenceStepEditor({
  step,
  onSave,
  onClose,
  onDirtyChange,
  readOnly = false,
}: Props) {
  const { state, actions } = useSequence();
  const { toast } = useToast();
  const [draft, setDraft] = useState(step);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const activeVariant = state.selectedVariantId
    ? draft.variants.find((v) => v.id === state.selectedVariantId)
    : draft.variants.find((v) => v.is_active) ?? draft.variants[0] ?? null;

  useEffect(() => {
    setDraft(step);
    onDirtyChange?.(false);
  }, [step, onDirtyChange]);

  const subject = activeVariant ? activeVariant.subject : draft.subject;
  const body = activeVariant ? activeVariant.body : draft.body;

  const setSubject = (value: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const applyTemplate = (tplSubject: string, tplBody: string) => {
    if (readOnly) return;
    // Apply subject + body in ONE setDraft call to avoid the second update
    // overwriting the first when both read from the same stale `draft` snapshot.
    setDraft((prev) => {
      if (activeVariant) {
        return {
          ...prev,
          variants: prev.variants.map((v) =>
            v.id === activeVariant.id
              ? { ...v, subject: tplSubject, body: tplBody }
              : v,
          ),
        };
      }
      return { ...prev, subject: tplSubject, body: tplBody };
    });
    onDirtyChange?.(true);
    toast({ title: "Template inserted" });
  };


  const handleSaveAsTemplate = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subject.trim().slice(0, 80),
          subject: subject.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Save failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Saved as template" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        variant: "destructive",
      });
      return;
    }
    if (!body.trim()) {
      toast({
        title: "Email body required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const toSave: SequenceStep = {
        ...draft,
        subject,
        body,
        variants: activeVariant
          ? draft.variants.map((v) =>
              v.id === activeVariant.id ? { ...v, subject, body } : v,
            )
          : draft.variants,
      };
      await onSave(toSave);
      onDirtyChange?.(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const previewBody = body.replace(/\{([^}]+)\}/g, (match) => {
    const content = match.slice(1, -1);
    const options = content.split("|").map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) return match;
    return options[Math.floor(Math.random() * options.length)];
  });

  return (
    <>
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
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowPreview(true)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              {!readOnly && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTemplates(true)}
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Templates
                  </Button>
                </>
              )}
            </div>
          </div>

          {draft.variants.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {draft.variants.map((variant, index) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => actions.setSelectedVariant(variant.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    activeVariant?.id === variant.id
                      ? "bg-purple-100 border-purple-300 text-purple-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {variant.name || `Variant ${String.fromCharCode(65 + index)}`}
                  {!variant.is_active && (
                    <span className="ml-1 text-xs text-gray-400">(off)</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-gray-800 font-medium flex items-center gap-1">
                Subject <Braces className="h-3.5 w-3.5 text-gray-400" />
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[#8B5CF6]"
                    disabled={readOnly}
                  >
                    <Braces className="h-3.5 w-3.5 mr-1" />
                    Variables
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {BULK_EMAIL_MERGE_VARIABLES.map((v) => (
                    <DropdownMenuItem
                      key={v.key}
                      onClick={() => setSubject(subject + mergeTag(v.key))}
                    >
                      {mergeTag(v.key)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="bg-white border-gray-300 h-11"
              readOnly={readOnly}
            />
          </div>

          <div className="space-y-2 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between">
              <Label className="text-gray-800 font-medium">Email Body</Label>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-[#8B5CF6]"
                  disabled={savingTemplate || !subject.trim() || !body.trim()}
                  onClick={handleSaveAsTemplate}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {savingTemplate ? "Saving..." : "Save as template"}
                </Button>
              )}
            </div>
            <EmailRichTextEditor
              value={body}
              onChange={setBody}
              onSave={() => handleSave()}
              saving={saving}
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>

      <EmailTemplatePickerModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onInsert={applyTemplate}
      />

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              Preview — {activeVariant?.name || "Variant A"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-b pb-3">
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium">{subject || "No subject"}</p>
            </div>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: previewBody || "" }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

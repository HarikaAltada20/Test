"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SequenceStep } from "@/lib/admin-email/sequence-types";
import { useSequence } from "./sequence-context";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ChevronDown,
  Code,
  Eye,
  Image,
  Italic,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Paperclip,
  Sparkles,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [renderedView, setRenderedView] = useState(false);
  const [fontFamily, setFontFamily] = useState("sans-serif");
  const [fontSize, setFontSize] = useState("14");

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

  const wrapSelection = (prefix: string, suffix: string) => {
    const el = document.getElementById(
      "sequence-email-body",
    ) as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = body.slice(start, end);
    const next =
      body.slice(0, start) + prefix + selected + suffix + body.slice(end);
    setBody(next);
  };

  const insertAtCursor = (text: string) => {
    const el = document.getElementById(
      "sequence-email-body",
    ) as HTMLTextAreaElement | null;
    if (!el) {
      setBody(body + text);
      return;
    }
    const start = el.selectionStart;
    const next = body.slice(0, start) + text + body.slice(start);
    setBody(next);
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

  const previewHtml = body.includes("<")
    ? body
    : `<p>${body.replace(/\n/g, "<br/>")}</p>`;

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
          <Button
            variant="outline"
            size="sm"
            className="border-gray-300 text-gray-700 shrink-0"
            onClick={() => setRenderedView((v) => !v)}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Preview
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-800 font-medium flex items-center gap-1">
            Subject <Braces className="h-3.5 w-3.5 text-gray-400" />
          </Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject..."
            className="bg-white border-gray-300 h-11"
          />
        </div>

        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between">
            <Label className="text-gray-800 font-medium">Email Body</Label>
            <button
              type="button"
              onClick={() => setRenderedView((v) => !v)}
              className="text-sm text-[#8B5CF6] hover:underline"
            >
              {renderedView ? "Edit view" : "Rendered view"}
            </button>
          </div>

          <div className="rounded-lg border border-gray-300 overflow-hidden flex flex-col flex-1 min-h-[320px]">
            {renderedView ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
                  Preview
                </div>
                <div
                  className="flex-1 overflow-y-auto p-4 text-sm text-gray-800 prose prose-sm max-w-none"
                  style={{ fontFamily, fontSize: `${fontSize}px` }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            ) : (
              <Textarea
                id="sequence-email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email content..."
                className="border-0 rounded-none resize-none focus-visible:ring-0 flex-1 min-h-[220px] text-sm"
                style={{ fontFamily, fontSize: `${fontSize}px` }}
              />
            )}

            <div className="border-t border-gray-200 bg-white px-2 py-2 flex flex-wrap items-center gap-0.5">
              <ToolbarBtn
                icon={<Bold className="h-4 w-4" />}
                onClick={() => wrapSelection("<b>", "</b>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<Italic className="h-4 w-4" />}
                onClick={() => wrapSelection("<i>", "</i>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<Underline className="h-4 w-4" />}
                onClick={() => wrapSelection("<u>", "</u>")}
                disabled={renderedView}
              />

              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="h-8 w-[90px] text-xs border-0 shadow-none">
                  <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans-serif">Font</SelectItem>
                  <SelectItem value="Georgia, serif">Serif</SelectItem>
                  <SelectItem value="monospace">Mono</SelectItem>
                </SelectContent>
              </Select>

              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger className="h-8 w-[72px] text-xs border-0 shadow-none">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {["12", "14", "16", "18", "20"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="w-px h-5 bg-gray-200 mx-1" />

              <ToolbarBtn
                icon={<AlignLeft className="h-4 w-4" />}
                onClick={() => wrapSelection('<div style="text-align:left">', "</div>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<AlignCenter className="h-4 w-4" />}
                onClick={() => wrapSelection('<div style="text-align:center">', "</div>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<AlignRight className="h-4 w-4" />}
                onClick={() => wrapSelection('<div style="text-align:right">', "</div>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<AlignJustify className="h-4 w-4" />}
                onClick={() => wrapSelection('<div style="text-align:justify">', "</div>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<List className="h-4 w-4" />}
                onClick={() => wrapSelection("<ul><li>", "</li></ul>")}
                disabled={renderedView}
              />
              <ToolbarBtn
                icon={<ListOrdered className="h-4 w-4" />}
                onClick={() => wrapSelection("<ol><li>", "</li></ol>")}
                disabled={renderedView}
              />

              <div className="w-px h-5 bg-gray-200 mx-1" />

              <ToolbarBtn icon={<LayoutGrid className="h-4 w-4" />} disabled />
              <ToolbarBtn
                icon={<Braces className="h-4 w-4" />}
                onClick={() => insertAtCursor("{full_name}")}
                disabled={renderedView}
              />
              <ToolbarBtn icon={<Sparkles className="h-4 w-4" />} disabled />
              <ToolbarBtn icon={<Paperclip className="h-4 w-4" />} disabled />
              <ToolbarBtn
                icon={<Link2 className="h-4 w-4" />}
                onClick={() => wrapSelection('<a href="https://">', "</a>")}
                disabled={renderedView}
              />
              <ToolbarBtn icon={<Image className="h-4 w-4" />} disabled />
              <ToolbarBtn
                icon={<Code className="h-4 w-4" />}
                onClick={() => setRenderedView(false)}
              />

              <div className="ml-auto flex items-center">
                <Button
                  className="bg-[#8B5CF6] hover:bg-[#7C3AED] h-8 rounded-r-none px-4"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="bg-[#8B5CF6] hover:bg-[#7C3AED] h-8 rounded-l-none border-l border-[#7C3AED] px-2"
                      disabled={saving}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSave(false)}>
                      Save
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSave(true)}>
                      Save and close
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({
  icon,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-8 rounded flex items-center justify-center text-gray-600",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100",
      )}
    >
      {icon}
    </button>
  );
}

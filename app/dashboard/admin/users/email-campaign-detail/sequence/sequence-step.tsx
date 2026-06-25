"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SequenceStep } from "@/lib/admin-email/sequence-types";
import {
  ChevronDown,
  Clock,
  Loader2,
  Plus,
  Send,
  Settings,
  Trash2,
} from "lucide-react";

type Props = {
  step: SequenceStep;
  displayNumber: number;
  onUpdate: (step: SequenceStep) => void;
  onDelete: (stepId: string) => void;
  onAddVariant: (stepId: string) => void;
  onSelectStep: (stepId: string) => void;
  onSelectVariant: (stepId: string, variantId: string) => void;
  onToggleVariant: (variantId: string, isActive: boolean) => void;
  onDeleteVariant: (variantId: string) => void;
  isSelected: boolean;
  isDeleting: boolean;
  isLastStep: boolean;
  readOnly?: boolean;
};

function variantSubjectPreview(v: { subject: string; body: string }) {
  const text = v.subject?.trim() || v.body?.replace(/<[^>]+>/g, "").trim();
  return text || "No subject";
}

export function SequenceStepComponent({
  step,
  displayNumber,
  onUpdate,
  onDelete,
  onAddVariant,
  onSelectStep,
  onSelectVariant,
  onToggleVariant,
  onDeleteVariant,
  isSelected,
  isDeleting,
  isLastStep,
  readOnly = false,
}: Props) {
  const expanded = step.isExpanded !== false;
  const [editingDelay, setEditingDelay] = useState(false);
  const variantCount = step.variants.length;

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-white overflow-hidden transition-all",
        isSelected
          ? "border-[#8B5CF6] shadow-sm"
          : "border-gray-200",
      )}
    >
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onUpdate({ ...step, isExpanded: !expanded })}
          className="text-gray-500 hover:text-gray-800 p-0.5"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelectStep(step.id)}
          className="flex-1 text-left font-semibold text-sm text-gray-900 hover:text-[#8B5CF6]"
        >
          Step {displayNumber}
        </button>
        <button
          type="button"
          onClick={() => !readOnly && onDelete(step.id)}
          disabled={isDeleting || readOnly}
          className="text-red-500 hover:text-red-600 p-1 disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-2">
          {isLastStep ? (
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Final step — no delay needed
            </p>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {editingDelay ? (
                <div className="flex items-center gap-2 flex-1">
                  <span>Send next message in</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-7 w-14 text-xs px-2"
                    value={step.delayDays}
                    onChange={(e) =>
                      onUpdate({
                        ...step,
                        delayDays: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    onBlur={() => setEditingDelay(false)}
                    autoFocus
                  />
                  <span>Days</span>
                </div>
              ) : (
                <>
                  <span>
                    Send next message in {step.delayDays} Days
                  </span>
                  <button
                    type="button"
                    onClick={() => !readOnly && setEditingDelay(true)}
                    disabled={readOnly}
                    className="text-gray-400 hover:text-[#8B5CF6] ml-auto disabled:opacity-40"
                  >
                    <Settings className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">
              {variantCount} variant{variantCount !== 1 ? "s" : ""}
            </p>

            {variantCount === 0 ? (
              <p className="text-xs text-gray-400 italic py-1">0 variants</p>
            ) : (
              <div className="space-y-2">
                {step.variants.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="text-left flex-1 min-w-0"
                        onClick={() => onSelectVariant(step.id, v.id)}
                      >
                        <p className="text-sm text-gray-800 truncate">
                          {variantSubjectPreview(v)}
                        </p>
                      </button>
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <Switch
                          checked={v.is_active}
                          onCheckedChange={(checked) =>
                            onToggleVariant(v.id, checked)
                          }
                          disabled={readOnly}
                          className="data-[state=checked]:bg-[#8B5CF6]"
                        />
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 disabled:opacity-40"
                          onClick={() => !readOnly && onDeleteVariant(v.id)}
                          disabled={readOnly}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs text-[#8B5CF6] border-[#8B5CF6]/40 hover:bg-purple-50"
            onClick={() => onAddVariant(step.id)}
            disabled={readOnly}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Variant
          </Button>
        </div>
      )}
    </div>
  );
}

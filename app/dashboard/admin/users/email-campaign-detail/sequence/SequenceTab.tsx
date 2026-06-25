"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SequenceStepComponent } from "./sequence-step";
import { SequenceStepEditor } from "./sequence-step-editor";
import { Plus, Mail, RefreshCw } from "lucide-react";
import { EmailFormPanelSkeleton } from "../../EmailSkeletons";
import type { SequenceStep, SequenceVariant } from "@/lib/admin-email/sequence-types";
import { useSequence } from "./sequence-context";
import { useToast } from "@/hooks/use-toast";

type CampaignInfo = {
  id: string;
  projectId: string;
  name: string;
  status?: string;
};

type Props = {
  campaign: CampaignInfo;
  readOnly?: boolean;
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
  onSaved?: () => void;
};

export function SequenceTab({
  campaign,
  readOnly = false,
  onUnsavedChangesChange,
  onSaved,
}: Props) {
  const campaignId = campaign.id;
  const { state, actions } = useSequence();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [draftSteps, setDraftSteps] = useState<SequenceStep[]>([]);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const justSavedRef = useRef(false);
  const [pendingSelection, setPendingSelection] = useState<{
    stepId: string | null;
    variantId: string | null;
    editing: boolean;
  } | null>(null);

  const scheduleSelection = (
    stepId: string | null,
    variantId: string | null,
    editing: boolean,
  ) => {
    setPendingSelection({ stepId, variantId, editing });
  };

  useEffect(() => {
    if (!pendingSelection) return;
    actions.setSelectedStep(pendingSelection.stepId);
    actions.setSelectedVariant(pendingSelection.variantId);
    actions.setEditing(pendingSelection.editing);
    setPendingSelection(null);
  }, [pendingSelection, actions]);

  const showSuccess = (msg: string) => toast({ title: msg });
  const showError = (msg: string) =>
    toast({ title: "Error", description: msg, variant: "destructive" });

  useEffect(() => {
    if (!campaignId) return;
    loadSequence();
  }, [campaignId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  const loadSequence = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaignId}/sequence`);
      const data = await res.json();
      await actions.loadSequences(campaignId);
      if (res.ok && !(data.steps?.length)) {
        initializeDefaultSequence();
      }
    } catch {
      initializeDefaultSequence();
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setDraftSteps([]);
    await actions.loadSequences(campaignId, true);
  };

  const initializeDefaultSequence = () => {
    const defaultStep: SequenceStep = {
      id: `step-${Date.now()}`,
      stepNumber: 1,
      subject: "",
      body: "",
      delayDays: 0,
      variants: [],
      isExpanded: true,
    };
    setDraftSteps([defaultStep]);
    scheduleSelection(defaultStep.id, null, true);
  };

  const handleAddStep = () => {
    if (readOnly) return;
    const run = () => {
      const newStepNumber =
        (state.currentSequence ? state.steps.length : 0) +
        draftSteps.length +
        1;
      const newStep: SequenceStep = {
        id: `step-${Date.now()}`,
        stepNumber: newStepNumber,
        subject: "",
        body: "",
        delayDays: 2,
        variants: [],
        isExpanded: true,
      };
      setDraftSteps((prev) => [...prev, newStep]);
      scheduleSelection(null, null, false);
      setHasUnsavedChanges(false);
    };

    if (hasUnsavedChanges) {
      setPendingAction(run);
      setShowUnsavedChangesDialog(true);
      return;
    }
    run();
  };

  const handleUpdateStep = async (updatedStep: SequenceStep) => {
    if (
      updatedStep.id.startsWith("step-") ||
      draftSteps.some((s) => s.id === updatedStep.id)
    ) {
      setDraftSteps((prev) =>
        prev.map((s) => (s.id === updatedStep.id ? updatedStep : s)),
      );
      return;
    }
    actions.updateStepLocal(updatedStep.id, {
      isExpanded: updatedStep.isExpanded,
      delayDays: updatedStep.delayDays,
      subject: updatedStep.subject,
      body: updatedStep.body,
    });
    try {
      await actions.updateStep(updatedStep.id, {
        step_number: updatedStep.stepNumber,
        subject: updatedStep.subject,
        body: updatedStep.body,
        delay_days: updatedStep.delayDays,
      });
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Failed to update step");
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (readOnly) return;
    setDeletingStepId(stepId);
    try {
      if (stepId.startsWith("step-") || draftSteps.some((s) => s.id === stepId)) {
        setDraftSteps((prev) => prev.filter((s) => s.id !== stepId));
        if (state.selectedStepId === stepId) {
          scheduleSelection(null, null, false);
        }
        showSuccess("Draft step removed");
        return;
      }
      await actions.deleteStep(stepId);
      showSuccess("Step deleted successfully!");
      await actions.loadSequences(campaignId, true);
    } catch {
      showError("Failed to delete step. Please try again.");
    } finally {
      setDeletingStepId(null);
    }
  };

  const handleAddVariantInternal = (stepId: string) => {
    const draftStep = draftSteps.find((s) => s.id === stepId);
    if (draftStep) {
      const variantNumber = draftStep.variants.length + 1;
      const letter = String.fromCharCode(64 + variantNumber);
      const newVariantId = `temp-variant-${Date.now()}`;
      setDraftSteps((prev) =>
        prev.map((s) => {
          if (s.id !== stepId) return s;
          const newVariant: SequenceVariant = {
            id: newVariantId,
            name: `Variant ${letter}`,
            subject: "",
            body: "",
            is_active: true,
            variant_letter: letter,
          };
          return {
            ...s,
            isExpanded: true,
            variants: [...s.variants, newVariant],
          };
        }),
      );
      scheduleSelection(stepId, newVariantId, true);
      showSuccess(`Variant ${letter} added successfully!`);
      return;
    }

    const step = state.steps.find((s) => s.id === stepId);
    if (!step) return;
    const variantNumber = step.variants.length + 1;
    const letter = String.fromCharCode(64 + variantNumber);
    const newVariantId = `temp-variant-${Date.now()}`;
    const newVariant: SequenceVariant = {
      id: newVariantId,
      name: `Variant ${letter}`,
      subject: "",
      body: "",
      is_active: true,
      variant_letter: letter,
    };
    actions.updateStepLocal(stepId, {
      isExpanded: true,
      variants: [...step.variants, newVariant],
    });
    scheduleSelection(stepId, newVariantId, true);
  };

  const handleAddVariant = (stepId: string) => {
    if (readOnly) return;
    if (
      hasUnsavedChanges &&
      state.selectedStepId &&
      state.selectedStepId !== stepId
    ) {
      setPendingAction(() => () => {
        handleAddVariantInternal(stepId);
        setHasUnsavedChanges(false);
      });
      setShowUnsavedChangesDialog(true);
      return;
    }
    handleAddVariantInternal(stepId);
  };

  const handleSelectStep = (stepId: string) => {
    const step = [...state.steps, ...draftSteps].find((s) => s.id === stepId);
    const defaultVariant =
      step?.variants.find((v) => v.is_active) ?? step?.variants[0];
    const run = () => {
      scheduleSelection(stepId, defaultVariant?.id ?? null, true);
      setHasUnsavedChanges(false);
    };
    if (!readOnly && hasUnsavedChanges) {
      setPendingAction(run);
      setShowUnsavedChangesDialog(true);
      return;
    }
    run();
  };

  const handleSelectVariant = (stepId: string, variantId: string) => {
    const run = () => {
      scheduleSelection(stepId, variantId, true);
      setHasUnsavedChanges(false);
    };
    if (!readOnly && hasUnsavedChanges) {
      setPendingAction(run);
      setShowUnsavedChangesDialog(true);
      return;
    }
    run();
  };

  const handleSaveStep = async (updatedStep: SequenceStep) => {
    try {
      if (!state.currentSequence) {
        const mergedDraftSteps = draftSteps.map((s) =>
          s.id === updatedStep.id ? updatedStep : s,
        );
        const payloadSteps = mergedDraftSteps.map((s) => {
          const hasManualContent =
            (s.subject && s.subject.trim().length > 0) ||
            (s.body && s.body.trim().length > 0);
          const variants =
            s.variants && s.variants.length > 0
              ? s.variants.map((v) => ({
                  variant_name: v.name,
                  subject: v.subject,
                  body: v.body,
                  variant_letter: v.variant_letter || "A",
                }))
              : hasManualContent
                ? [
                    {
                      variant_name: "Variant A",
                      subject: s.subject || "",
                      body: s.body || "",
                      variant_letter: "A",
                    },
                  ]
                : [];
          return {
            step_number: s.stepNumber,
            subject: s.subject,
            body: s.body,
            delay_days: s.delayDays,
            variants,
          };
        });

        await actions.createSequence({
          campaign_id: campaignId,
          project_id: campaign.projectId,
          name: `${campaign.name} - Email Sequence`,
          description: "Email sequence for campaign",
          steps: payloadSteps,
        });
        setDraftSteps([]);
        showSuccess("Email sequence created successfully!");
        setHasUnsavedChanges(false);
        justSavedRef.current = true;
        await actions.loadSequences(campaignId, true);
      } else {
        const isDraftStep = updatedStep.id.startsWith("step-");
        if (isDraftStep) {
          const newStepNumber = state.steps.length + 1;
          const addRes = await actions.addStep(state.currentSequence.id, {
            step_number: newStepNumber,
            subject: updatedStep.subject,
            body: updatedStep.body,
            delay_days: updatedStep.delayDays,
            variants: [],
          });
          const stepIdToUse = addRes?.step_id;
          if (stepIdToUse) {
            const variantsToCreate =
              updatedStep.variants?.length > 0
                ? updatedStep.variants
                : (updatedStep.subject?.trim() || updatedStep.body?.trim())
                  ? [
                      {
                        id: "temp-variant-A",
                        name: "Variant A",
                        subject: updatedStep.subject || "",
                        body: updatedStep.body || "",
                        variant_letter: "A",
                        is_active: true,
                      } as SequenceVariant,
                    ]
                  : [];
            for (const variant of variantsToCreate) {
              await actions.addVariant(stepIdToUse, {
                variant_name: variant.name,
                subject: variant.subject,
                body: variant.body,
                variant_letter: variant.variant_letter || "A",
              });
            }
          }
          setDraftSteps((prev) => prev.filter((s) => s.id !== updatedStep.id));
          showSuccess(`Step ${newStepNumber} added successfully!`);
          setHasUnsavedChanges(false);
          justSavedRef.current = true;
          await actions.loadSequences(campaignId, true);
        } else {
          await actions.updateStep(updatedStep.id, {
            step_number: updatedStep.stepNumber,
            subject: updatedStep.subject,
            body: updatedStep.body,
            delay_days: updatedStep.delayDays,
          });
          const originalStep = state.steps.find((s) => s.id === updatedStep.id);
          if (originalStep) {
            for (const variant of updatedStep.variants) {
              if (variant.id.startsWith("temp-variant-")) {
                await actions.addVariant(updatedStep.id, {
                  variant_name: variant.name,
                  subject: variant.subject,
                  body: variant.body,
                  variant_letter: variant.variant_letter,
                });
              } else {
                await actions.updateVariant(variant.id, {
                  name: variant.name,
                  subject: variant.subject,
                  body: variant.body,
                  is_active: variant.is_active,
                });
              }
            }
            showSuccess(`Step ${updatedStep.stepNumber} updated successfully!`);
            setHasUnsavedChanges(false);
            justSavedRef.current = true;
            await actions.loadSequences(campaignId, true);
          }
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save step.";
      showError(message);
    } finally {
      scheduleSelection(null, null, false);
      setHasUnsavedChanges(false);
      setTimeout(() => {
        justSavedRef.current = false;
      }, 100);
      if (justSavedRef.current) {
        onSaved?.();
      }
    }
  };

  const handleCloseEditor = () => {
    if (justSavedRef.current) {
      justSavedRef.current = false;
      scheduleSelection(null, null, false);
      setHasUnsavedChanges(false);
      return;
    }
    if (hasUnsavedChanges) {
      setPendingAction(() => () => {
        scheduleSelection(null, null, false);
        setHasUnsavedChanges(false);
      });
      setShowUnsavedChangesDialog(true);
      return;
    }
    scheduleSelection(null, null, false);
  };

  const handleConfirmDiscard = () => {
    pendingAction?.();
    setPendingAction(null);
    setShowUnsavedChangesDialog(false);
    setHasUnsavedChanges(false);
  };

  const handleCancelDiscard = () => {
    setPendingAction(null);
    setShowUnsavedChangesDialog(false);
  };

  const handleToggleVariant = async (variantId: string, isActive: boolean) => {
    if (variantId.startsWith("temp-variant-")) {
      const step = [...state.steps, ...draftSteps].find((s) =>
        s.variants.some((v) => v.id === variantId),
      );
      if (step) {
        const updated = {
          ...step,
          variants: step.variants.map((v) =>
            v.id === variantId ? { ...v, is_active: isActive } : v,
          ),
        };
        if (draftSteps.some((s) => s.id === step.id)) {
          setDraftSteps((prev) =>
            prev.map((s) => (s.id === step.id ? updated : s)),
          );
        } else {
          actions.updateStepLocal(step.id, { variants: updated.variants });
        }
      }
      return;
    }
    showSuccess(`${isActive ? "Enabling" : "Disabling"} variant...`);
    try {
      await actions.toggleVariant(variantId, isActive);
      showSuccess(`Variant ${isActive ? "enabled" : "disabled"} successfully!`);
      await actions.loadSequences(campaignId, true);
    } catch {
      showError("Failed to toggle variant.");
      await actions.loadSequences(campaignId, true);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (variantId.startsWith("temp-variant-")) {
      const inDraft = draftSteps.find((s) =>
        s.variants.some((v) => v.id === variantId),
      );
      if (inDraft) {
        setDraftSteps((prev) =>
          prev.map((s) => ({
            ...s,
            variants: s.variants.filter((v) => v.id !== variantId),
          })),
        );
        showSuccess("Variant deleted successfully!");
        return;
      }
      const step = state.steps.find((s) =>
        s.variants.some((v) => v.id === variantId),
      );
      if (step) {
        actions.updateStepLocal(step.id, {
          variants: step.variants.filter((v) => v.id !== variantId),
        });
        showSuccess("Variant deleted successfully!");
      }
      return;
    }
    try {
      await actions.deleteVariant(variantId);
      showSuccess("Variant deleted successfully!");
      await actions.loadSequences(campaignId, true);
    } catch {
      showError("Failed to delete variant.");
    }
  };

  const stepsToShow =
    state.steps.length > 0 ? [...state.steps, ...draftSteps] : draftSteps;
  const selectedStep = stepsToShow.find(
    (step) => step.id === state.selectedStepId,
  );

  const isLoading =
    loading || state.isLoading || state.isLoadingSequence;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Email Sequence</h2>
          <p className="text-sm text-gray-600">
            Create and manage your email sequence steps
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRefresh}
              className="text-gray-700 border-gray-200 hover:bg-gray-50"
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              onClick={handleAddStep}
              className="bg-[#8B5CF6] hover:bg-[#7C3AED]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Step
            </Button>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900">
          This campaign has already sent (or is sending). Sequence steps are view-only.
        </div>
      )}

      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{state.error}</p>
        </div>
      )}

      {isLoading && <EmailFormPanelSkeleton />}

      {!isLoading && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-[30%] space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Mail className="w-4 h-4" />
              Sequence Steps ({stepsToShow.length})
            </div>

            {stepsToShow.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No steps created yet</p>
                <p className="text-sm">Click &quot;Add Step&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stepsToShow.map((step, index) => (
                  <div key={step.id} className="relative">
                    <SequenceStepComponent
                      step={step}
                      displayNumber={index + 1}
                      onUpdate={handleUpdateStep}
                      onDelete={handleDeleteStep}
                      onAddVariant={handleAddVariant}
                      onSelectStep={handleSelectStep}
                      onSelectVariant={handleSelectVariant}
                      onToggleVariant={handleToggleVariant}
                      onDeleteVariant={handleDeleteVariant}
                      isSelected={state.selectedStepId === step.id}
                      isDeleting={deletingStepId === step.id}
                      isLastStep={index === stepsToShow.length - 1}
                      readOnly={readOnly}
                    />
                    {index === stepsToShow.length - 1 && !readOnly && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleAddStep}
                          className="w-full flex items-center gap-2 text-[#8B5CF6] border-[#8B5CF6]/50 hover:bg-purple-50 h-9"
                        >
                          <Plus className="w-4 h-4" />
                          Add Step
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[400px]">
            {state.isEditing && selectedStep ? (
              <SequenceStepEditor
                step={selectedStep}
                onSave={handleSaveStep}
                onClose={handleCloseEditor}
                projectId={campaign.projectId}
                onDirtyChange={setHasUnsavedChanges}
                readOnly={readOnly}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500 rounded-xl border border-dashed border-gray-200 bg-white">
                <div className="text-center">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium mb-2">
                    {readOnly ? "Select a step to view" : "Select a step to edit"}
                  </p>
                  <p className="text-sm">
                    {readOnly
                      ? "Choose a step from the left sidebar to review its content"
                      : "Choose a step from the left sidebar to start editing"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoading && stepsToShow.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Sequence Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Steps:</span>
              <span className="ml-2 font-medium">{stepsToShow.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Variants:</span>
              <span className="ml-2 font-medium">
                {stepsToShow.reduce((sum, s) => sum + s.variants.length, 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Active Variants:</span>
              <span className="ml-2 font-medium">
                {stepsToShow.reduce(
                  (sum, s) =>
                    sum + s.variants.filter((v) => v.is_active).length,
                  0,
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {showUnsavedChangesDialog && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">
                Unsaved Changes
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                You have unsaved changes that will be lost.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-700">
                Are you sure you don&apos;t want to save? All unsaved
                modifications will be discarded.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleCancelDiscard}>
                  Continue Editing
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleConfirmDiscard}
                >
                  Discard Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

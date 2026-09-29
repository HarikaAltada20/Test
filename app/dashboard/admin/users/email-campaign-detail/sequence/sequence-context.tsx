"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";
import type {
  EmailSequence,
  SequenceStep,
  SequenceVariant,
} from "@/lib/admin-email/sequence-types";

type State = {
  sequences: EmailSequence[];
  currentSequence: EmailSequence | null;
  steps: SequenceStep[];
  selectedStepId: string | null;
  selectedVariantId: string | null;
  isEditing: boolean;
  isLoading: boolean;
  isLoadingSequence: boolean;
  error: string | null;
};

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_LOADING_SEQUENCE"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | {
      type: "SET_SEQUENCE";
      payload: {
        sequence: EmailSequence | null;
        steps: SequenceStep[];
      };
    }
  | { type: "SET_SELECTED_STEP"; payload: string | null }
  | { type: "SET_SELECTED_VARIANT"; payload: string | null }
  | { type: "SET_EDITING"; payload: boolean }
  | { type: "UPDATE_STEP_LOCAL"; payload: { stepId: string; patch: Partial<SequenceStep> } }
  | { type: "REORDER_STEPS"; payload: SequenceStep[] };

const initialState: State = {
  sequences: [],
  currentSequence: null,
  steps: [],
  selectedStepId: null,
  selectedVariantId: null,
  isEditing: false,
  isLoading: false,
  isLoadingSequence: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_LOADING_SEQUENCE":
      return { ...state, isLoadingSequence: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SEQUENCE": {
      const { sequence, steps } = action.payload;
      return {
        ...state,
        currentSequence: sequence,
        steps,
        sequences: sequence ? [sequence] : [],
        error: null,
      };
    }
    case "SET_SELECTED_STEP":
      return { ...state, selectedStepId: action.payload };
    case "SET_SELECTED_VARIANT":
      return { ...state, selectedVariantId: action.payload };
    case "SET_EDITING":
      return { ...state, isEditing: action.payload };
    case "UPDATE_STEP_LOCAL": {
      const steps = state.steps.map((s) =>
        s.id === action.payload.stepId
          ? { ...s, ...action.payload.patch }
          : s,
      );
      return { ...state, steps };
    }
    case "REORDER_STEPS":
      return { ...state, steps: action.payload };
    default:
      return state;
  }
}

type SequenceActions = {
  loadSequences: (campaignId: string, force?: boolean) => Promise<void>;
  createSequence: (input: {
    campaign_id: string;
    project_id: string;
    name: string;
    description?: string;
    steps: Array<{
      step_number: number;
      subject: string;
      body: string;
      delay_days: number;
      variants?: Array<{
        variant_name: string;
        subject: string;
        body: string;
        variant_letter: string;
      }>;
    }>;
  }) => Promise<EmailSequence | null>;
  addStep: (
    sequenceId: string,
    input: {
      step_number: number;
      subject: string;
      body: string;
      delay_days: number;
      variants?: unknown[];
    },
  ) => Promise<{ step_id: string } | null>;
  updateStep: (
    stepId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  deleteStep: (stepId: string) => Promise<void>;
  addVariant: (
    stepId: string,
    input: {
      variant_name: string;
      subject: string;
      body: string;
      variant_letter: string;
    },
    _tempId?: string,
  ) => Promise<void>;
  updateVariant: (
    variantId: string,
    patch: Partial<SequenceVariant>,
  ) => Promise<void>;
  deleteVariant: (variantId: string) => Promise<void>;
  toggleVariant: (variantId: string, isActive: boolean) => Promise<void>;
  setSelectedStep: (id: string | null) => void;
  setSelectedVariant: (id: string | null) => void;
  setEditing: (v: boolean) => void;
  updateStepLocal: (stepId: string, patch: Partial<SequenceStep>) => void;
  reorderSteps: (steps: SequenceStep[]) => void;
};

const SequenceContext = createContext<{
  state: State;
  actions: SequenceActions;
  campaignId: string;
} | null>(null);

export function SequenceProvider({
  campaignId,
  children,
}: {
  campaignId: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const loadSequences = useCallback(
    async (cid: string, _force?: boolean) => {
      dispatch({ type: "SET_LOADING_SEQUENCE", payload: true });
      try {
        const res = await fetch(`/api/admin/email-campaigns/${cid}/sequence`);
        const data = await res.json();
        if (!res.ok) {
          dispatch({ type: "SET_ERROR", payload: data.error ?? "Load failed" });
          return;
        }
        dispatch({
          type: "SET_SEQUENCE",
          payload: {
            sequence: data.sequence ?? null,
            steps: data.steps ?? [],
          },
        });
      } catch {
        dispatch({ type: "SET_ERROR", payload: "Failed to load sequence" });
      } finally {
        dispatch({ type: "SET_LOADING_SEQUENCE", payload: false });
      }
    },
    [],
  );

  const actions = useMemo<SequenceActions>(
    () => ({
      loadSequences,
      createSequence: async (input) => {
        dispatch({ type: "SET_LOADING", payload: true });
        try {
          const res = await fetch(
            `/api/admin/email-campaigns/${input.campaign_id}/sequence`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: input.name,
                description: input.description,
                steps: input.steps,
              }),
            },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Create failed");
          await loadSequences(input.campaign_id, true);
          return state.currentSequence;
        } finally {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      },
      addStep: async (_sequenceId, input) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/steps`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Add step failed");
        return data;
      },
      updateStep: async (stepId, patch) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/steps/${stepId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Update failed");
        }
      },
      deleteStep: async (stepId) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/steps/${stepId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Delete failed");
        }
      },
      addVariant: async (stepId, input) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/steps/${stepId}/variants`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Add variant failed");
        }
      },
      updateVariant: async (variantId, patch) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/variants/${variantId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              variant_name: patch.name,
              subject: patch.subject,
              body: patch.body,
              is_active: patch.is_active,
            }),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Update variant failed");
        }
      },
      deleteVariant: async (variantId) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/variants/${variantId}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Delete variant failed");
        }
      },
      toggleVariant: async (variantId, isActive) => {
        const res = await fetch(
          `/api/admin/email-campaigns/${campaignId}/sequence/variants/${variantId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_active: isActive }),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Toggle failed");
        }
      },
      setSelectedStep: (id) =>
        dispatch({ type: "SET_SELECTED_STEP", payload: id }),
      setSelectedVariant: (id) =>
        dispatch({ type: "SET_SELECTED_VARIANT", payload: id }),
      setEditing: (v) => dispatch({ type: "SET_EDITING", payload: v }),
      updateStepLocal: (stepId, patch) =>
        dispatch({ type: "UPDATE_STEP_LOCAL", payload: { stepId, patch } }),
      reorderSteps: (steps) =>
        dispatch({ type: "REORDER_STEPS", payload: steps }),
    }),
    [campaignId, loadSequences, state.currentSequence],
  );

  return (
    <SequenceContext.Provider value={{ state, actions, campaignId }}>
      {children}
    </SequenceContext.Provider>
  );
}

export function useSequence() {
  const ctx = useContext(SequenceContext);
  if (!ctx) throw new Error("useSequence must be used within SequenceProvider");
  return ctx;
}

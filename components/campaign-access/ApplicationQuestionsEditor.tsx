"use client";

import { useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Info,
  Link2,
  ListChecks,
  Plus,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  APPLICATION_QUESTION_KINDS,
  APPLICATION_QUESTION_KIND_LABELS,
  MAX_APPLICATION_QUESTIONS,
  MAX_CHOICE_OPTIONS,
  MAX_CHOICE_OPTION_LENGTH,
  MAX_QUESTION_PROMPT_LENGTH,
  applicationQuestionTemplates,
  questionFieldErrors,
  type ApplicationQuestion,
  type ApplicationQuestionKind,
} from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";

type Props = {
  questions: ApplicationQuestion[];
  onChange: (questions: ApplicationQuestion[]) => void;
  disabled?: boolean;
  /** Hide the built-in heading when the editor sits under its own step title. */
  showHeading?: boolean;
  /** Campaign end date, for the "Can you post by…" template. */
  endDate?: string | null;
  /** Shows a note that edits don't change answers already submitted. */
  hasApplications?: boolean;
};

const KIND_ICONS: Record<ApplicationQuestionKind, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  url: Link2,
  single_choice: ListChecks,
  yes_no: ToggleLeft,
};

const fieldClass = "bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const errorClass = "border-red-500 focus-visible:ring-red-500 dark:border-red-500";
const COLLAPSE_AFTER = 3;

let keySeq = 0;
const newKey = () => `q-${++keySeq}`;

/** Greyed sketch of how the question looks to creators. */
function AnswerSketch({ question }: { question: ApplicationQuestion }) {
  const box = "rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-400 dark:border-white/10 dark:bg-white/5 dark:text-gray-500";
  let body;
  switch (question.kind) {
    case "long_text":
      body = <div className={cn(box, "h-10")}>Creator&apos;s answer…</div>;
      break;
    case "url":
      body = (
        <div className={cn(box, "flex items-center gap-1")}>
          <Link2 className="h-3 w-3" /> https://
        </div>
      );
      break;
    case "single_choice":
      body = (
        <div className="space-y-1">
          {(question.options ?? []).filter((o) => o.trim()).slice(0, 3).map((o, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="h-2.5 w-2.5 rounded-full border border-gray-300 dark:border-white/30" />
              <span className="truncate">{o}</span>
            </div>
          ))}
          {(question.options ?? []).filter((o) => o.trim()).length === 0 && (
            <div className="text-[11px] text-gray-400 dark:text-gray-500">Choices appear here</div>
          )}
        </div>
      );
      break;
    case "yes_no":
      body = (
        <div className="flex gap-1.5">
          {["Yes", "No"].map((v) => (
            <span key={v} className={cn(box, "px-3")}>
              {v}
            </span>
          ))}
        </div>
      );
      break;
    default:
      body = <div className={box}>Creator&apos;s answer…</div>;
  }
  return (
    <div
      aria-hidden="true"
      className="rounded-md border border-dashed border-gray-200 p-2 opacity-80 dark:border-white/10"
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        Creators see
      </p>
      <p className="mb-1.5 truncate text-xs font-medium text-gray-600 dark:text-gray-300">
        {question.prompt.trim() || "Your question"}
        {question.required && <span className="text-red-400"> *</span>}
      </p>
      {body}
    </div>
  );
}

export function ApplicationQuestionsEditor({
  questions,
  onChange,
  disabled,
  showHeading = true,
  endDate,
  hasApplications,
}: Props) {
  const isDark = useDashboardDark();
  // Stable keys for unsaved questions, kept in step with every add, remove and move below.
  const keys = useRef<string[]>([]);
  if (keys.current.length !== questions.length) {
    keys.current = questions.map((q) => q.id ?? newKey());
  }
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [armed, setArmed] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const collapsible = questions.length > COLLAPSE_AFTER;
  const atLimit = questions.length >= MAX_APPLICATION_QUESTIONS;
  const templates = applicationQuestionTemplates(endDate);

  const touch = (key: string) => setTouched((prev) => new Set(prev).add(key));
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const update = (index: number, patch: Partial<ApplicationQuestion>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= questions.length || from === to) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const k = [...keys.current];
    const [key] = k.splice(from, 1);
    k.splice(to, 0, key);
    keys.current = k;
    onChange(next);
  };

  const remove = (index: number) => {
    keys.current = keys.current.filter((_, i) => i !== index);
    onChange(questions.filter((_, i) => i !== index));
  };

  const add = (question: ApplicationQuestion) => {
    if (atLimit) return;
    const key = newKey();
    keys.current = [...keys.current, key];
    setExpanded((prev) => new Set(prev).add(key));
    onChange([...questions, question]);
  };

  const setKind = (index: number, kind: ApplicationQuestionKind) =>
    update(index, {
      kind,
      options: kind === "single_choice" ? questions[index].options ?? ["", ""] : null,
    });

  const setOption = (qIndex: number, oIndex: number, value: string) => {
    const options = [...(questions[qIndex].options ?? [])];
    options[oIndex] = value;
    update(qIndex, { options });
  };

  const removeOption = (qIndex: number, oIndex: number) =>
    update(qIndex, {
      options: (questions[qIndex].options ?? []).filter((_, i) => i !== oIndex),
    });

  const existingPrompts = new Set(questions.map((q) => q.prompt.trim().toLowerCase()));

  return (
    <div
      className={cn(
        "space-y-3",
        showHeading && "rounded-lg border border-gray-200 p-4 dark:border-white/10",
        isDark && "dark",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        {showHeading ? (
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Application questions</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Optional. Creators answer these when they apply.
            </p>
          </div>
        ) : (
          <span />
        )}
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400" aria-live="polite">
          {questions.length} of {MAX_APPLICATION_QUESTIONS} questions
        </p>
      </div>

      {hasApplications && (
        <p className="flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Editing questions doesn&apos;t change answers already submitted.
        </p>
      )}

      <ol className="space-y-3">
        {questions.map((q, i) => {
          const key = keys.current[i];
          const errs = questionFieldErrors(q);
          const promptError = touched.has(`${key}:prompt`) ? errs.prompt : null;
          const optionsError = touched.has(`${key}:options`) ? errs.options : null;
          const hasError = !!(errs.prompt || errs.options || errs.optionErrors.some(Boolean));
          const isOpen = !collapsible || expanded.has(key);
          const KindIcon = KIND_ICONS[q.kind];
          const promptId = `question-${key}-prompt`;
          return (
            <li
              key={key}
              draggable={!disabled && armed === key}
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setArmed(null);
                setDragFrom(null);
                setDragOver(null);
              }}
              className={cn(
                "rounded-lg border bg-gray-50/60 transition-colors dark:bg-white/5",
                hasError && touched.has(`${key}:prompt`)
                  ? "border-red-200 dark:border-red-500/40"
                  : "border-gray-200 dark:border-white/10",
                dragOver === i && dragFrom !== i && "border-[#7F39EC] ring-2 ring-[#7F39EC]/30",
                dragFrom === i && "opacity-50",
              )}
            >
              <div className="flex items-center gap-1.5 p-2">
                <button
                  type="button"
                  aria-label={`Drag to reorder question ${i + 1}. Use the arrow buttons to move it with the keyboard.`}
                  title="Drag to reorder"
                  disabled={disabled}
                  onMouseDown={() => setArmed(key)}
                  onMouseUp={() => setArmed(null)}
                  className="cursor-grab rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-gray-200"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500" aria-hidden="true">
                  {i + 1}.
                </span>
                {collapsible ? (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`question-${key}-body`}
                    onClick={() => toggleExpanded(key)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    )}
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        q.prompt.trim() ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-gray-500",
                      )}
                    >
                      {q.prompt.trim() || "Untitled question"}
                    </span>
                  </button>
                ) : (
                  <span className="flex-1" />
                )}
                {!isOpen && (
                  <span className="hidden items-center gap-1.5 sm:flex">
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {APPLICATION_QUESTION_KIND_LABELS[q.kind]}
                    </span>
                    {q.required && (
                      <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-[#4A00BE] dark:bg-[#2B1159] dark:text-purple-200">
                        Required
                      </span>
                    )}
                    {hasError && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        Needs a fix
                      </span>
                    )}
                  </span>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 dark:text-gray-300 dark:hover:bg-white/10"
                  aria-label={`Move question ${i + 1} up`}
                  disabled={disabled || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 dark:text-gray-300 dark:hover:bg-white/10"
                  aria-label={`Move question ${i + 1} down`}
                  disabled={disabled || i === questions.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 dark:hover:bg-red-500/10"
                  aria-label={`Remove question ${i + 1}`}
                  disabled={disabled}
                  onClick={() => remove(i)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>

              {isOpen && (
                <div id={`question-${key}-body`} className="space-y-3 border-t border-gray-200 p-3 dark:border-white/10">
                  <div className="space-y-1">
                    <label htmlFor={promptId} className="sr-only">
                      Question {i + 1}
                    </label>
                    <Input
                      id={promptId}
                      className={cn(fieldClass, promptError && errorClass)}
                      placeholder="Question, e.g. Why are you a good fit?"
                      maxLength={MAX_QUESTION_PROMPT_LENGTH + 20}
                      value={q.prompt}
                      disabled={disabled}
                      aria-invalid={!!promptError}
                      aria-describedby={promptError ? `${promptId}-error` : undefined}
                      onChange={(e) => update(i, { prompt: e.target.value })}
                      onBlur={() => touch(`${key}:prompt`)}
                    />
                    {(promptError || (errs.prompt && q.prompt.trim())) && (
                      <p id={`${promptId}-error`} className="text-xs text-red-600 dark:text-red-400">
                        {promptError ?? errs.prompt}
                      </p>
                    )}
                  </div>

                  <RadioGroupPrimitive.Root
                    value={q.kind}
                    onValueChange={(v) => setKind(i, v as ApplicationQuestionKind)}
                    disabled={disabled}
                    aria-label={`Answer type for question ${i + 1}`}
                    className="flex flex-wrap gap-1.5"
                  >
                    {APPLICATION_QUESTION_KINDS.map((kind) => {
                      const Icon = KIND_ICONS[kind];
                      return (
                        <RadioGroupPrimitive.Item
                          key={kind}
                          value={kind}
                          className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:border-[#7F39EC]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] data-[state=checked]:border-[#7F39EC] data-[state=checked]:bg-[#7F39EC] data-[state=checked]:text-white dark:border-white/15 dark:bg-transparent dark:text-gray-200"
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {APPLICATION_QUESTION_KIND_LABELS[kind]}
                        </RadioGroupPrimitive.Item>
                      );
                    })}
                  </RadioGroupPrimitive.Root>

                  {q.kind === "single_choice" && (
                    <div className="space-y-2">
                      {(q.options ?? []).map((opt, oi) => {
                        const optError = errs.optionErrors[oi];
                        const optId = `question-${key}-option-${oi}`;
                        return (
                          <div key={oi} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Input
                                id={optId}
                                className={cn(fieldClass, optError && errorClass)}
                                placeholder={`Choice ${oi + 1}`}
                                aria-label={`Question ${i + 1}, choice ${oi + 1}`}
                                aria-invalid={!!optError}
                                aria-describedby={optError ? `${optId}-error` : undefined}
                                maxLength={MAX_CHOICE_OPTION_LENGTH + 20}
                                value={opt}
                                disabled={disabled}
                                onChange={(e) => setOption(i, oi, e.target.value)}
                                onBlur={() => touch(`${key}:options`)}
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={`Remove choice ${oi + 1}`}
                                className="dark:text-gray-300 dark:hover:bg-white/10"
                                disabled={disabled || (q.options ?? []).length <= 2}
                                onClick={() => removeOption(i, oi)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {optError && (
                              <p id={`${optId}-error`} className="text-xs text-red-600 dark:text-red-400">
                                {optError}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {optionsError && (
                        <p className="text-xs text-red-600 dark:text-red-400">{optionsError}</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={outlineDark}
                        disabled={disabled || (q.options ?? []).length >= MAX_CHOICE_OPTIONS}
                        onClick={() => update(i, { options: [...(q.options ?? []), ""] })}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add choice
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                      <Switch
                        variant="theme-aware"
                        theme={isDark ? "dark" : "light"}
                        checked={q.required}
                        disabled={disabled}
                        onCheckedChange={(v) => update(i, { required: v })}
                      />
                      Required
                    </label>
                    <div className="sm:w-56">
                      <AnswerSketch question={q} />
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={outlineDark}
          disabled={disabled || atLimit}
          onClick={() => add({ prompt: "", kind: "short_text", options: null, required: true })}
        >
          <Plus className="mr-1 h-4 w-4" /> Add question
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-[#7F39EC] hover:text-[#4A00BE] dark:text-purple-300 dark:hover:bg-white/10"
              disabled={disabled || atLimit}
            >
              <Sparkles className="mr-1 h-4 w-4" /> Add common questions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={cn(isDark && "border-white/10 bg-[#07031D] text-white")}>
            <DropdownMenuLabel className="text-xs">Starter questions</DropdownMenuLabel>
            {templates.map(({ label, ...question }) => {
              const used = existingPrompts.has(question.prompt.toLowerCase());
              return (
                <DropdownMenuItem key={label} disabled={used} onSelect={() => add(question)}>
                  {label}
                  {used && <span className="ml-auto pl-3 text-xs text-gray-400">Added</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {atLimit && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            You&apos;ve reached the {MAX_APPLICATION_QUESTIONS}-question limit. Remove one to add another.
          </p>
        )}
      </div>
    </div>
  );
}

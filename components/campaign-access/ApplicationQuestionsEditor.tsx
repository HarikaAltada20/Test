"use client";

import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPLICATION_QUESTION_KINDS,
  APPLICATION_QUESTION_KIND_LABELS,
  MAX_APPLICATION_QUESTIONS,
  MAX_CHOICE_OPTIONS,
  MAX_CHOICE_OPTION_LENGTH,
  MAX_QUESTION_PROMPT_LENGTH,
  type ApplicationQuestion,
  type ApplicationQuestionKind,
} from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";

const fieldClass = "bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";

type Props = {
  questions: ApplicationQuestion[];
  onChange: (questions: ApplicationQuestion[]) => void;
  disabled?: boolean;
};

export function ApplicationQuestionsEditor({ questions, onChange, disabled }: Props) {
  const isDark = useDashboardDark();
  const update = (index: number, patch: Partial<ApplicationQuestion>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
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

  return (
    <div className={cn("space-y-3 rounded-lg border border-gray-200 p-4 dark:border-white/10", isDark && "dark")}>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Application questions</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Optional. Creators answer these when they apply. Up to {MAX_APPLICATION_QUESTIONS}{" "}
          questions.
        </p>
      </div>

      {questions.map((q, i) => (
        <div
          key={q.id ?? `new-${i}`}
          className="space-y-3 rounded-md border border-gray-100 bg-gray-50/60 p-3 dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex items-start gap-2">
            <span className="mt-2 text-xs font-semibold text-gray-400 dark:text-gray-500" aria-hidden="true">
              {i + 1}.
            </span>
            <Input
              className={cn("flex-1", fieldClass)}
              placeholder="Question"
              aria-label={`Question ${i + 1}`}
              maxLength={MAX_QUESTION_PROMPT_LENGTH}
              value={q.prompt}
              disabled={disabled}
              onChange={(e) => update(i, { prompt: e.target.value })}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move question ${i + 1} up`}
              className="dark:text-gray-300 dark:hover:bg-white/10"
              disabled={disabled || i === 0}
              onClick={() => move(i, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Move question ${i + 1} down`}
              className="dark:text-gray-300 dark:hover:bg-white/10"
              disabled={disabled || i === questions.length - 1}
              onClick={() => move(i, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove question ${i + 1}`}
              className="dark:hover:bg-red-500/10"
              disabled={disabled}
              onClick={() => onChange(questions.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 pl-5">
            <div className="w-48">
              <Select
                value={q.kind}
                disabled={disabled}
                onValueChange={(v) => setKind(i, v as ApplicationQuestionKind)}
              >
                <SelectTrigger
                  className={isDark ? undefined : "bg-white"}
                  isDark={isDark}
                  aria-label={`Answer type for question ${i + 1}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  {APPLICATION_QUESTION_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind} isDark={isDark}>
                      {APPLICATION_QUESTION_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <Switch
                variant="theme-aware"
                theme={isDark ? "dark" : "light"}
                checked={q.required}
                disabled={disabled}
                onCheckedChange={(v) => update(i, { required: v })}
              />
              Required
            </label>
          </div>

          {q.kind === "single_choice" && (
            <div className="space-y-2 pl-5">
              {(q.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input
                    className={fieldClass}
                    placeholder={`Choice ${oi + 1}`}
                    aria-label={`Question ${i + 1}, choice ${oi + 1}`}
                    maxLength={MAX_CHOICE_OPTION_LENGTH}
                    value={opt}
                    disabled={disabled}
                    onChange={(e) => setOption(i, oi, e.target.value)}
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
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
                disabled={disabled || (q.options ?? []).length >= MAX_CHOICE_OPTIONS}
                onClick={() => update(i, { options: [...(q.options ?? []), ""] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add choice
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
        disabled={disabled || questions.length >= MAX_APPLICATION_QUESTIONS}
        onClick={() =>
          onChange([...questions, { prompt: "", kind: "short_text", options: null, required: true }])
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Add question
      </Button>
    </div>
  );
}

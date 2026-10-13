"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CircleCheck, Clock, Loader2, PauseCircle, Trophy, UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { resolveContestPoolBudgetCents } from "@/lib/video-platform-campaigns";
import {
  ANSWER_MAX_LENGTH,
  APPLICATION_RESULT_MESSAGES,
  validateApplicationAnswers,
  type ApplicationQuestion,
  type ContestPreview,
} from "@/lib/campaign-access";
import { applicationsApi } from "./api";
import { AccessModeBadge } from "./AccessBadge";
import { RelativeTime } from "./RelativeTime";

const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";

type Props = {
  preview: ContestPreview;
  /** Called after apply/withdraw or approval so the page can reload. */
  onChanged: () => void;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

function QuestionField({
  question,
  value,
  error,
  onChange,
  disabled,
}: {
  question: ApplicationQuestion & { id: string };
  value: string;
  error?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = `apply-q-${question.id}`;
  const label = (
    <Label htmlFor={id} className="font-medium text-gray-900 dark:text-gray-100">
      {question.prompt}
      {question.required ? (
        <span className="text-red-500" aria-hidden="true"> *</span>
      ) : (
        <span className="text-xs font-normal text-gray-400 dark:text-gray-500"> (optional)</span>
      )}
    </Label>
  );

  let field: ReactNode;
  switch (question.kind) {
    case "long_text":
      field = (
        <Textarea
          id={id}
          rows={4}
          maxLength={ANSWER_MAX_LENGTH.long_text}
          className={fieldClass}
          required={question.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "single_choice":
    case "yes_no": {
      const options =
        question.kind === "yes_no"
          ? [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]
          : (question.options ?? []).map((o) => ({ value: o, label: o }));
      field = (
        <RadioGroup
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          aria-label={question.prompt}
          aria-invalid={!!error}
          className="gap-2"
        >
          {options.map((o, i) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
              <RadioGroupItem id={`${id}-${i}`} value={o.value} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      );
      break;
    }
    default:
      field = (
        <Input
          id={id}
          type={question.kind === "url" ? "url" : "text"}
          placeholder={question.kind === "url" ? "https://" : undefined}
          maxLength={ANSWER_MAX_LENGTH[question.kind]}
          className={fieldClass}
          required={question.required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className="space-y-2">
      {label}
      {field}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function RestrictedCampaignPreview({ preview, onChanged }: Props) {
  const router = useRouter();
  const isDark = useDashboardDark();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const app = preview.my_application;
  const prizeCents = resolveContestPoolBudgetCents(
    preview.contest_type,
    preview.contest_based_details,
    preview.platform,
  );
  const start = formatDate(preview.start_date);
  const end = formatDate(preview.end_date);
  const canApply =
    !preview.has_ended &&
    preview.applications_open &&
    (!app || app.status === "withdrawn");

  const submit = async () => {
    const found = validateApplicationAnswers(preview.questions, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const res = await applicationsApi.apply(preview.id, answers);
      if (res.result === "submitted") {
        toast({ title: APPLICATION_RESULT_MESSAGES.submitted });
        onChanged();
        return;
      }
      if (res.result === "invalid_answers" && res.questionId) {
        setErrors({ [res.questionId]: "Please check this answer" });
      }
      toast({
        title: res.error || APPLICATION_RESULT_MESSAGES[res.result],
        variant: "destructive",
      });
      if (res.result === "already_member" || res.result === "already_applied") onChanged();
    } catch (e: unknown) {
      toast({
        title: "Could not send your application",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      const res = await applicationsApi.withdraw(preview.id);
      toast({ title: res.message });
      onChanged();
    } catch (e: unknown) {
      toast({
        title: "Could not withdraw",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  let statusBox: ReactNode = null;
  if (app?.status === "pending") {
    statusBox = (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
          <Clock className="h-4 w-4" aria-hidden="true" /> Application under review
        </p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/90">
          <RelativeTime value={app.created_at} prefix="Sent" />. You&apos;ll get a notification
          when the brand decides.
        </p>
        <Button
          className="mt-3 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-500/15"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={withdraw}
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Withdraw application
        </Button>
      </div>
    );
  } else if (app?.status === "rejected") {
    statusBox = (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
        <p className="flex items-center gap-2 font-medium text-red-800 dark:text-red-200">
          <XCircle className="h-4 w-4" aria-hidden="true" /> Not selected this time
        </p>
        {app.rejection_reason && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-700 dark:text-red-300">
            {app.rejection_reason}
          </p>
        )}
      </div>
    );
  } else if (app?.status === "approved" && !preview.has_access) {
    statusBox = (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
        <p className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
          <UserX className="h-4 w-4" aria-hidden="true" /> Your access was removed
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The brand removed you from this campaign. Contact them if you think this was a mistake.
        </p>
      </div>
    );
  } else if (app?.status === "approved" || preview.has_access) {
    statusBox = (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <p className="flex items-center gap-2 font-medium text-green-800 dark:text-emerald-200">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> You&apos;re approved.
        </p>
        <Button className="mt-3" size="sm" onClick={onChanged}>
          Open the campaign
        </Button>
      </div>
    );
  } else if (preview.has_ended) {
    statusBox = (
      <p className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" /> This campaign has ended.
      </p>
    );
  } else if (!preview.applications_open) {
    statusBox = (
      <p className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
        <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> This campaign isn&apos;t
        accepting applications right now.
      </p>
    );
  }

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6 px-4 py-8", isDark && "dark")}>
      <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm dark:border-white/10 dark:bg-[#170337]">
        <div className="flex h-56 items-center justify-center bg-gray-50 dark:bg-white/5">
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnail_url}
              alt={preview.title ?? "Campaign thumbnail"}
              className="h-full w-full object-contain"
            />
          ) : (
            <Trophy className="h-14 w-14 text-gray-300 dark:text-white/20" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-4 p-6">
          <div>
            <AccessModeBadge mode="restricted" label="Restricted · apply to join" />
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {preview.title || "Untitled campaign"}
            </h1>
            {preview.brand_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">by {preview.brand_name}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
            {preview.platform && <span className="capitalize">{preview.platform}</span>}
            {(start || end) && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {start ?? "?"} – {end ?? "?"}
              </span>
            )}
            {prizeCents > 0 && (
              <span className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
                <Trophy className="h-4 w-4" /> {formatCurrencyFromCents(prizeCents)}
              </span>
            )}
          </div>

          {preview.preview_description && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
              {preview.preview_description}
            </p>
          )}
        </div>
      </div>

      {statusBox}

      {canApply && (
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#170337]">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Apply to this campaign
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The brand reviews every application. You&apos;ll see the full brief once you&apos;re
              approved.
            </p>
          </div>
          {preview.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id] ?? ""}
              error={errors[q.id]}
              disabled={busy}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            />
          ))}
          <div className="flex gap-3">
            <Button
              className="bg-[#4A00BE] text-white hover:bg-[#4A00BE]/90"
              disabled={busy}
              onClick={submit}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send application
            </Button>
            <Button
              variant="outline"
              className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
              onClick={() => router.push("/dashboard/opportunities")}
            >
              Browse campaigns
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

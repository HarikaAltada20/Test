"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock,
  Hourglass,
  Info,
  Loader2,
  PartyPopper,
  PauseCircle,
  Pencil,
  Send,
  Sparkles,
  Trophy,
  UserX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { resolveCampaignPrizeCents } from "@/lib/campaign-prize";
import {
  ANSWER_MAX_LENGTH,
  APPLICATION_RESULT_MESSAGES,
  applicationDraftKey,
  countAnsweredQuestions,
  daysUntil,
  parseApplicationDraft,
  validateApplicationAnswer,
  validateApplicationAnswers,
  type ApplicationQuestion,
  type ContestPreview,
} from "@/lib/campaign-access";
import { applicationsApi } from "./api";
import { AccessModeBadge } from "./AccessBadge";
import { AnswersList, LinkChip } from "./ApplicationAnswers";
import { NotifyWhenReopenButton } from "./NotifyWhenReopenButton";
import { RelativeTime } from "./RelativeTime";

type Props = {
  preview: ContestPreview;
  /** Called after apply/withdraw or approval so the page can reload. */
  onChanged: () => void;
  /** Brand-side preview from the campaign editor: nothing is sent or saved. */
  previewMode?: boolean;
  accent?: "purple" | "ink";
};

const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const cardClass =
  "rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/10 dark:bg-[#170337]";

const HOW_IT_WORKS: { icon: typeof Send; title: string; text: string }[] = [
  { icon: Send, title: "Apply", text: "Answer the brand's questions." },
  { icon: Hourglass, title: "Brand reviews", text: "They pick who joins." },
  { icon: Bell, title: "Get notified", text: "You hear back either way." },
  { icon: Sparkles, title: "Create", text: "See the full brief and submit." },
];

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Reads and writes the creator's unsent answers; storage can be unavailable, so every access is guarded. */
function readDraft(contestId: string, questions: ContestPreview["questions"]) {
  try {
    return parseApplicationDraft(window.localStorage.getItem(applicationDraftKey(contestId)), questions);
  } catch {
    return {};
  }
}

function writeDraft(contestId: string, answers: Record<string, string>) {
  try {
    const key = applicationDraftKey(contestId);
    if (Object.values(answers).some((v) => v.trim())) {
      window.localStorage.setItem(key, JSON.stringify(answers));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Drafts are a convenience; the form still works without storage.
  }
}

function QuestionField({
  question,
  value,
  error,
  onChange,
  onBlur,
  disabled,
  ink,
}: {
  question: ApplicationQuestion & { id: string };
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  ink?: boolean;
}) {
  const id = `apply-q-${question.id}`;
  const errorId = `${id}-error`;
  const max = ANSWER_MAX_LENGTH[question.kind];
  const showCounter = question.kind === "short_text" || question.kind === "long_text";
  const nearLimit = value.length >= max * 0.9;
  const describedBy = [error ? errorId : null, showCounter ? `${id}-count` : null]
    .filter(Boolean)
    .join(" ") || undefined;

  const label = (
    <Label htmlFor={id} className="font-medium text-gray-900 dark:text-gray-100">
      {question.prompt}
      {question.required ? (
        <>
          <span className="text-red-500" aria-hidden="true">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
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
          maxLength={max}
          className={cn(fieldClass, error && "border-red-500 dark:border-red-500")}
          required={question.required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
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
          onValueChange={(v) => {
            onChange(v);
            onBlur();
          }}
          disabled={disabled}
          aria-label={question.prompt}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="gap-2"
        >
          {options.map((o, i) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-800 dark:border-white/10 dark:text-gray-200",
                ink
                  ? "has-[[data-state=checked]]:border-[#1a1a1a] has-[[data-state=checked]]:bg-[#f6f6f7] dark:has-[[data-state=checked]]:bg-white/10"
                  : "has-[[data-state=checked]]:border-[#7F39EC] has-[[data-state=checked]]:bg-purple-50/60 dark:has-[[data-state=checked]]:bg-[#7F39EC]/15",
              )}
            >
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
          inputMode={question.kind === "url" ? "url" : undefined}
          placeholder={question.kind === "url" ? "https://" : undefined}
          maxLength={max}
          className={cn(fieldClass, error && "border-red-500 dark:border-red-500")}
          required={question.required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      );
  }

  const validLink = question.kind === "url" && !error && /^https?:\/\/\S+$/i.test(value.trim());

  return (
    <div className="space-y-2">
      {label}
      {field}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {error && (
            <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          {validLink && <LinkChip url={value.trim()} />}
        </div>
        {showCounter && (
          <p
            id={`${id}-count`}
            className={cn(
              "shrink-0 text-xs",
              nearLimit ? "text-amber-600 dark:text-amber-400" : "text-gray-400 dark:text-gray-500",
            )}
          >
            {value.length}/{max}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusBox({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "amber" | "red" | "gray" | "green";
  icon: typeof Clock;
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
    gray: "border-gray-200 bg-gray-50 text-gray-800 dark:border-white/10 dark:bg-white/5 dark:text-gray-100",
    green: "border-green-200 bg-green-50 text-green-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  };
  return (
    <div role="status" className={cn("rounded-2xl border p-5", tones[tone])}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" /> {title}
      </p>
      {children && <div className="mt-2 space-y-3 text-sm opacity-90">{children}</div>}
    </div>
  );
}

export function RestrictedCampaignPreview({ preview, onChanged, previewMode, accent = "purple" }: Props) {
  const router = useRouter();
  const isDark = useDashboardDark();
  const ink = accent === "ink";
  const primaryBtn = ink
    ? "bg-[#1a1a1a] text-white hover:bg-black"
    : "bg-[#4A00BE] text-white hover:bg-[#4A00BE]/90";
  const accentIcon = ink ? "text-[#1a1a1a] dark:text-white" : "text-[#7F39EC] dark:text-purple-300";
  const accentChip = ink
    ? "bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white"
    : "bg-purple-50 text-[#7F39EC] dark:bg-[#7F39EC]/20 dark:text-purple-200";
  const accentBar = ink ? "bg-[#1a1a1a]" : "bg-[#7F39EC]";
  const inkOutline =
    "border border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f3f3f5] dark:border-white/40 dark:bg-transparent dark:text-white dark:hover:bg-white/10";
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [justSubmittedAt, setJustSubmittedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const app = preview.my_application;
  const prizeCents = resolveCampaignPrizeCents(
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
  const daysLeft = canApply ? daysUntil(preview.end_date) : null;
  const questions = preview.questions;
  const answered = countAnsweredQuestions(questions, answers);

  // Restore unsent answers once per campaign.
  useEffect(() => {
    if (!canApply || previewMode) return;
    const draft = readDraft(preview.id, questions);
    if (Object.keys(draft).length > 0) {
      setAnswers(draft);
      setDraftRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.id]);

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [id]: value };
      if (!previewMode) writeDraft(preview.id, next);
      return next;
    });
    if (touched.has(id)) {
      const q = questions.find((x) => x.id === id);
      if (q) {
        const err = validateApplicationAnswer(q, value);
        setErrors((prev) => {
          const next = { ...prev };
          if (err) next[id] = err;
          else delete next[id];
          return next;
        });
      }
    }
  };

  const touch = (id: string) => {
    setTouched((prev) => new Set(prev).add(id));
    const q = questions.find((x) => x.id === id);
    if (!q) return;
    const err = validateApplicationAnswer(q, answers[id]);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[id] = err;
      else delete next[id];
      return next;
    });
  };

  const goToReview = () => {
    const found = validateApplicationAnswers(questions, answers);
    setErrors(found);
    setTouched(new Set(questions.map((q) => q.id)));
    if (Object.keys(found).length > 0) {
      const first = questions.find((q) => found[q.id]);
      if (first) document.getElementById(`apply-q-${first.id}`)?.focus();
      return;
    }
    setReviewing(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async () => {
    if (previewMode) {
      toast({ title: "This is a preview", description: "Nothing was sent." });
      return;
    }
    const found = validateApplicationAnswers(questions, answers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setReviewing(false);
      return;
    }

    setBusy(true);
    try {
      const res = await applicationsApi.apply(preview.id, answers);
      if (res.result === "submitted") {
        writeDraft(preview.id, {});
        setJustSubmittedAt(new Date().toISOString());
        toast({ title: APPLICATION_RESULT_MESSAGES.submitted });
        onChanged();
        return;
      }
      if (res.result === "invalid_answers" && res.questionId) {
        setErrors({ [res.questionId]: "Please check this answer" });
        setReviewing(false);
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
      setConfirmWithdraw(false);
      setJustSubmittedAt(null);
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

  const browse = () => {
    if (!previewMode) router.push("/dashboard/opportunities");
  };

  let statusBox: ReactNode = null;
  if (app?.status === "pending") {
    statusBox = justSubmittedAt ? (
      <StatusBox tone="green" icon={PartyPopper} title="Application sent">
        <p>
          We&apos;ll notify you when the brand decides. Sent{" "}
          <RelativeTime value={justSubmittedAt} />.
        </p>
        <Button size="sm" variant="outline" className={ink ? inkOutline : outlineDark} onClick={browse}>
          Browse other campaigns
        </Button>
      </StatusBox>
    ) : (
      <StatusBox tone="amber" icon={Clock} title="Application under review">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li className="flex items-center gap-1.5">
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
            <RelativeTime value={app.created_at} prefix="Applied" />
          </li>
          <li aria-hidden="true">·</li>
          <li className="flex items-center gap-1.5">
            <Hourglass className="h-4 w-4" aria-hidden="true" /> Under review
          </li>
        </ol>
        <p>You&apos;ll get a notification when the brand decides.</p>
        <button
          type="button"
          className={cn(
            "rounded-sm text-sm font-medium underline underline-offset-4 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2",
            ink ? "focus-visible:ring-[#1a1a1a]" : "focus-visible:ring-[#7F39EC]",
          )}
          disabled={busy}
          onClick={() => setConfirmWithdraw(true)}
        >
          Withdraw application
        </button>
      </StatusBox>
    );
  } else if (app?.status === "rejected") {
    statusBox = (
      <StatusBox tone="red" icon={XCircle} title="Not selected this time">
        {app.rejection_reason ? (
          <blockquote className="whitespace-pre-wrap border-l-2 border-red-300 pl-3 italic dark:border-red-400/50">
            {app.rejection_reason}
          </blockquote>
        ) : (
          <p>The brand didn&apos;t give a reason.</p>
        )}
        <Button size="sm" variant="outline" className={ink ? inkOutline : outlineDark} onClick={browse}>
          Find similar campaigns
        </Button>
      </StatusBox>
    );
  } else if (app?.status === "approved" && !preview.has_access) {
    statusBox = (
      <StatusBox tone="gray" icon={UserX} title="Your access was removed">
        <p>
          The brand approved your application, then removed you from this campaign. Contact them if
          you think this was a mistake.
        </p>
      </StatusBox>
    );
  } else if (app?.status === "approved" || preview.has_access) {
    statusBox = (
      <StatusBox tone="green" icon={CircleCheck} title="You're approved!">
        <p>You can now see the full brief and submit your content.</p>
        <Button className={ink ? primaryBtn : "bg-[#7F39EC] text-white hover:bg-[#7F39EC]/90"} onClick={onChanged}>
          Open the campaign
        </Button>
      </StatusBox>
    );
  } else if (preview.has_ended) {
    statusBox = (
      <StatusBox tone="gray" icon={CalendarDays} title="This campaign has ended">
        <p>Applications are closed.</p>
        <Button size="sm" variant="outline" className={ink ? inkOutline : outlineDark} onClick={browse}>
          Browse open campaigns
        </Button>
      </StatusBox>
    );
  } else if (!preview.applications_open) {
    statusBox = (
      <StatusBox tone="gray" icon={PauseCircle} title="Applications are paused">
        <p>
          The brand isn&apos;t accepting applications right now.
          {previewMode ? " Check back later." : " We can tell you when they reopen."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!previewMode && <NotifyWhenReopenButton contestId={preview.id} />}
          <Button size="sm" variant="outline" className={ink ? inkOutline : outlineDark} onClick={browse}>
            Browse open campaigns
          </Button>
        </div>
      </StatusBox>
    );
  }

  const facts: { icon: typeof Trophy; text: ReactNode; strong?: boolean }[] = [];
  if (prizeCents > 0) facts.push({ icon: Trophy, text: formatCurrencyFromCents(prizeCents), strong: true });
  if (start || end) facts.push({ icon: CalendarDays, text: `${start ?? "?"} – ${end ?? "?"}` });
  if (preview.platform) facts.push({ icon: Sparkles, text: <span className="capitalize">{preview.platform}</span> });
  if (daysLeft !== null)
    facts.push({ icon: Hourglass, text: `${daysLeft} day${daysLeft === 1 ? "" : "s"} left to apply` });

  return (
    <div className={cn("mx-auto max-w-3xl space-y-6 px-0 py-4 sm:px-4 sm:py-8", isDark && "dark")}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-[#170337]",
          ink ? "border-[#e6e6ea] dark:border-white/10" : "border-purple-100 dark:border-white/10",
        )}
      >
        <div
          className={cn(
            "relative flex h-56 items-center justify-center sm:h-72",
            ink
              ? "bg-gradient-to-br from-[#1a1a1a]/80 to-[#3a3a42]"
              : "bg-gradient-to-br from-[#7F39EC]/20 to-[#4A00BE]/30",
          )}
        >
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Trophy className="h-14 w-14 text-white/60" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 sm:p-6">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    aria-label="Restricted, apply to join. The brand reviews applications; you'll see the full brief once approved."
                  >
                    <AccessModeBadge
                      mode="restricted"
                      label="Restricted · apply to join"
                      className={
                        ink
                          ? "border-white/30 bg-[#1a1a1a] text-white dark:border-white/30 dark:bg-white/15 dark:text-white"
                          : undefined
                      }
                    />
                    <Info className="h-4 w-4 text-white/80" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                <TooltipContent className="max-w-64 border-gray-200 bg-white text-xs text-gray-900">
                  The brand reviews applications. You&apos;ll see the full brief once approved.
                </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </TooltipProvider>
            <h1 className="text-2xl font-bold text-white drop-shadow sm:text-3xl">
              {preview.title || "Untitled campaign"}
            </h1>
            {preview.brand_name && <p className="text-sm text-white/85">by {preview.brand_name}</p>}
          </div>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {facts.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {facts.map((f, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 dark:border-white/10 dark:text-gray-200",
                    f.strong && "font-semibold text-gray-900 dark:text-white",
                  )}
                >
                  <f.icon className={cn("h-4 w-4", accentIcon)} aria-hidden="true" />
                  {f.text}
                </li>
              ))}
            </ul>
          )}
          {preview.preview_description && (
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
              {preview.preview_description}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="how-it-works" className="space-y-3">
        <h2 id="how-it-works" className="text-sm font-semibold text-gray-900 dark:text-white">
          How it works
        </h2>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/5"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    accentChip,
                  )}
                >
                  <step.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </span>
              </span>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {statusBox}

      {canApply && !justSubmittedAt && (
        <div ref={formRef} className={cn("space-y-5", cardClass)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                <ClipboardList className="h-5 w-5" aria-hidden="true" />
                {reviewing ? "Check your answers" : "Apply to this campaign"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {reviewing
                  ? "This is what the brand will see. You can't edit it after sending."
                  : "The brand reviews every application. You'll see the full brief once you're approved."}
              </p>
            </div>
            {questions.length > 0 && !reviewing && (
              <p
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200"
                aria-live="polite"
              >
                {answered} of {questions.length} answered
              </p>
            )}
          </div>

          {questions.length > 0 && !reviewing && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
              role="progressbar"
              aria-label="Questions answered"
              aria-valuemin={0}
              aria-valuemax={questions.length}
              aria-valuenow={answered}
            >
              <div
                className={cn("h-full rounded-full transition-all", accentBar)}
                style={{ width: `${(answered / questions.length) * 100}%` }}
              />
            </div>
          )}

          {draftRestored && !reviewing && (
            <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> We restored the answers you
              started earlier.
            </p>
          )}

          {reviewing ? (
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-white/5">
              <AnswersList
                answers={questions.map((q) => ({
                  question_id: q.id,
                  prompt: q.prompt,
                  kind: q.kind,
                  answer: answers[q.id] ?? "",
                }))}
              />
            </div>
          ) : (
            questions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id] ?? ""}
                error={touched.has(q.id) ? errors[q.id] : undefined}
                disabled={busy}
                onChange={(v) => setAnswer(q.id, v)}
                onBlur={() => touch(q.id)}
                ink={ink}
              />
            ))
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            {reviewing ? (
              <>
                <Button variant="outline" className={ink ? inkOutline : outlineDark} disabled={busy} onClick={() => setReviewing(false)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit answers
                </Button>
                <Button
                  className={primaryBtn}
                  disabled={busy}
                  onClick={submit}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send application
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" className={ink ? inkOutline : outlineDark} onClick={browse}>
                  Browse campaigns
                </Button>
                <Button
                  className={primaryBtn}
                  disabled={busy}
                  onClick={questions.length > 0 ? goToReview : submit}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {questions.length > 0 ? "Review application" : "Send application"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmWithdraw} onOpenChange={(o) => !o && setConfirmWithdraw(false)}>
        <AlertDialogContent className={cn(isDark ? "dark border-white/10 bg-[#06021D] text-white" : "text-gray-900")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
            <AlertDialogDescription>
              The brand won&apos;t see it anymore. You can apply again while applications are open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark} disabled={busy}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                withdraw();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

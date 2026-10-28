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

const fieldClass =
  "h-11 rounded-2xl border-[#e6e6ea] bg-white text-[15px] shadow-[inset_0_1px_0_rgba(26,26,26,0.02)] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:shadow-none";
const outlineDark =
  "rounded-full border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7] dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const cardClass =
  "rounded-[28px] border border-[#ececef] bg-white p-6 sm:p-8 lg:p-10 dark:border-white/10 dark:bg-[#161616]";
const btnRow =
  "inline-flex !h-10 !w-auto shrink-0 items-center justify-center !gap-1.5 rounded-full px-5 text-[15px] font-medium";
/** Neutral accents — avoid creator-role orange CSS vars on this surface. */
const inkAccent = "text-[#1a1a1a] dark:text-white";
const inkSoft = "bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/10 dark:text-white";
const inkBar = "bg-[#1a1a1a] dark:bg-white";
const radioItemClass = "border-[#1a1a1a] text-[#1a1a1a] dark:border-white dark:text-white";
const radioIndicatorClass = "text-[#1a1a1a] dark:text-white";

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
}: {
  question: ApplicationQuestion & { id: string };
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  disabled?: boolean;
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
    <Label htmlFor={id} className="text-[15px] font-semibold text-[#1a1a1a] dark:text-gray-100">
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
        <span className="text-xs font-normal text-[#8d8d95] dark:text-gray-500"> (optional)</span>
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
          className={cn(
            "min-h-[120px] rounded-2xl border-[#e6e6ea] bg-white text-[15px] shadow-[inset_0_1px_0_rgba(26,26,26,0.02)] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:shadow-none",
            error && "border-red-500 dark:border-red-500",
          )}
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
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2"
        >
          {options.map((o, i) => (
            <label
              key={o.value}
              className="flex w-fit cursor-pointer items-center gap-2 text-sm text-[#1a1a1a] dark:text-gray-200"
            >
              <RadioGroupItem
                id={`${id}-${i}`}
                value={o.value}
                className={radioItemClass}
                indicatorClassName={radioIndicatorClass}
              />
              <span className="leading-snug">{o.label}</span>
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
    amber: {
      box: "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50",
      bar: "bg-amber-500",
      icon: "text-amber-600 dark:text-amber-300",
    },
    red: {
      box: "border-red-200/80 bg-red-50 text-red-950 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-50",
      bar: "bg-red-500",
      icon: "text-red-600 dark:text-red-300",
    },
    gray: {
      box: "border-[#ececef] bg-[#fafafa] text-[#1a1a1a] dark:border-white/10 dark:bg-white/5 dark:text-gray-100",
      bar: "bg-[#a1a1aa]",
      icon: "text-[#55555E] dark:text-gray-300",
    },
    green: {
      box: "border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-50",
      bar: "bg-emerald-500",
      icon: "text-emerald-600 dark:text-emerald-300",
    },
  };
  const t = tones[tone];
  return (
    <div role="status" className={cn("relative overflow-hidden rounded-3xl border p-5 sm:p-6", t.box)}>
      <div className={cn("absolute inset-y-0 left-0 w-1", t.bar)} aria-hidden="true" />
      <p className="flex items-center gap-2 pl-2 text-[17px] font-semibold tracking-tight">
        <Icon className={cn("h-5 w-5 shrink-0", t.icon)} aria-hidden="true" /> {title}
      </p>
      {children && <div className="mt-3 space-y-3 pl-2 text-sm opacity-90">{children}</div>}
    </div>
  );
}

export function RestrictedCampaignPreview({ preview, onChanged, previewMode, accent: _accent = "purple" }: Props) {
  const router = useRouter();
  const isDark = useDashboardDark();
  // Keep CTAs ink/neutral so creator-role orange tokens don't flood this page.
  void _accent;
  const primaryBtn = cn(
    btnRow,
    "bg-[#1a1a1a] text-white hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90",
  );
  const accentIcon = inkAccent;
  const accentChip = inkSoft;
  const accentBar = inkBar;
  const secondaryBtn = cn(btnRow, outlineDark);
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
        <Button size="sm" variant="outline" className={secondaryBtn} onClick={browse}>
          Browse other campaigns
        </Button>
      </StatusBox>
    ) : (
      <StatusBox tone="amber" icon={Clock} title="Application under review">
        <ol className="grid gap-2 sm:grid-cols-2">
          <li className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2 dark:border-amber-500/20 dark:bg-black/20">
            <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <RelativeTime value={app.created_at} prefix="Applied" />
          </li>
          <li className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-white/70 px-3 py-2 dark:border-amber-500/20 dark:bg-black/20">
            <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" /> Under review
          </li>
        </ol>
        <p>You&apos;ll get a notification when the brand decides.</p>
        <button
          type="button"
          className={cn(
            "rounded-sm text-sm font-medium underline underline-offset-4 opacity-80 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-[#1a1a1a] dark:focus-visible:ring-white",
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
        <Button size="sm" variant="outline" className={secondaryBtn} onClick={browse}>
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
        <Button className={primaryBtn} onClick={onChanged}>
          Open the campaign
        </Button>
      </StatusBox>
    );
  } else if (preview.has_ended) {
    statusBox = (
      <StatusBox tone="gray" icon={CalendarDays} title="This campaign has ended">
        <p>Applications are closed.</p>
        <Button size="sm" variant="outline" className={secondaryBtn} onClick={browse}>
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
          <Button size="sm" variant="outline" className={secondaryBtn} onClick={browse}>
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
    <div className={cn("mx-auto w-full max-w-7xl space-y-8 px-0 py-2 sm:py-6", isDark && "dark")}>
      <div
        className={cn(
          "overflow-hidden rounded-[28px] border bg-white shadow-[0_12px_40px_-28px_rgba(26,26,26,0.35)] dark:bg-[#161616] dark:shadow-none",
          "border-[#ececef] dark:border-white/10",
        )}
      >
        <div className="relative aspect-[21/9] min-h-[160px] w-full bg-[#f3f3f5] dark:bg-[#0e0e0e] sm:min-h-[220px]">
          {preview.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#ececef] to-[#d9d9de] dark:from-[#1a1a1a] dark:to-[#2a2a2e]">
              <Trophy className="h-14 w-14 text-[#a1a1aa] dark:text-white/35" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-5 p-6 sm:p-8 lg:p-10">
          <div className="space-y-3">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex w-fit items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1a1a]/30"
                    aria-label="Restricted, apply to join. The brand reviews applications; you'll see the full brief once approved."
                  >
                    <AccessModeBadge
                      mode="restricted"
                      label="Restricted · apply to join"
                      className="border-[#ececef] bg-[#f3f3f5] text-[#1a1a1a] dark:border-white/15 dark:bg-white/10 dark:text-white"
                    />
                    <Info className="h-4 w-4 text-[#8d8d95]" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipPortal>
                <TooltipContent className="max-w-64 border-gray-200 bg-white text-xs text-gray-900">
                  The brand reviews applications. You&apos;ll see the full brief once approved.
                </TooltipContent>
                </TooltipPortal>
              </Tooltip>
            </TooltipProvider>
            <h1 className="max-w-4xl text-[28px] font-bold leading-tight tracking-tight text-[#1a1a1a] dark:text-white sm:text-[36px]">
              {preview.title || "Untitled campaign"}
            </h1>
            {preview.brand_name && (
              <p className="text-[15px] text-[#55555E] dark:text-gray-300">by {preview.brand_name}</p>
            )}
          </div>
          {facts.length > 0 && (
            <ul className="flex flex-wrap gap-2.5">
              {facts.map((f, i) => (
                <li
                  key={i}
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-full border border-[#ececef] bg-[#fafafa] px-3.5 py-1.5 text-sm text-[#55555E] dark:border-white/10 dark:bg-white/5 dark:text-gray-200",
                    f.strong && "font-semibold text-[#1a1a1a] dark:text-white",
                  )}
                >
                  <f.icon className={cn("h-4 w-4", accentIcon)} aria-hidden="true" />
                  {f.text}
                </li>
              ))}
            </ul>
          )}
          {preview.preview_description && (
            <p className="max-w-4xl whitespace-pre-wrap text-[15px] leading-7 text-[#55555E] dark:text-gray-300">
              {preview.preview_description}
            </p>
          )}
        </div>
      </div>

      <section aria-labelledby="how-it-works" className="space-y-4">
        <h2 id="how-it-works" className="text-[17px] font-semibold tracking-tight text-[#1a1a1a] dark:text-white">
          How it works
        </h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-[#ececef] bg-white p-4 sm:p-5 dark:border-white/10 dark:bg-[#161616]"
            >
              <span className="flex items-center gap-2.5 text-[15px] font-semibold text-[#1a1a1a] dark:text-white">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
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
              <p className="mt-2.5 text-sm leading-relaxed text-[#8d8d95] dark:text-gray-400">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {statusBox}

      {canApply && !justSubmittedAt && (
        <div ref={formRef} className={cn("space-y-0", cardClass)}>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ececef] pb-5 dark:border-white/10">
            <div className="max-w-3xl space-y-1">
              <h2 className="flex items-center gap-2.5 text-[20px] font-bold tracking-tight text-[#1a1a1a] dark:text-white">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", accentChip)}>
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                </span>
                {reviewing ? "Check your answers" : "Apply to this campaign"}
              </h2>
              <p className="text-sm text-[#8d8d95] dark:text-gray-400">
                {reviewing
                  ? "This is what the brand will see. You can't edit it after sending."
                  : "The brand reviews every application. You'll see the full brief once you're approved."}
              </p>
            </div>
            {questions.length > 0 && !reviewing && (
              <p
                className="inline-flex w-fit rounded-full border border-[#ececef] bg-[#fafafa] px-3 py-1 text-xs font-medium text-[#55555E] dark:border-white/10 dark:bg-white/10 dark:text-gray-200"
                aria-live="polite"
              >
                {answered} of {questions.length} answered
              </p>
            )}
          </div>

          <div className="space-y-6 pt-6">
            {questions.length > 0 && !reviewing && (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[#f3f3f5] dark:bg-white/10"
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
              <p className="flex items-center gap-2 text-xs text-[#8d8d95] dark:text-gray-400">
                <Info className="h-3.5 w-3.5" aria-hidden="true" /> We restored the answers you
                started earlier.
              </p>
            )}

            {reviewing ? (
              <div className="w-fit max-w-full rounded-2xl border border-[#ececef] bg-[#fafafa] p-5 dark:border-white/10 dark:bg-white/5">
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
              <div className="space-y-6">
                {questions.map((q) => (
                  <QuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id] ?? ""}
                    error={touched.has(q.id) ? errors[q.id] : undefined}
                    disabled={busy}
                    onChange={(v) => setAnswer(q.id, v)}
                    onBlur={() => touch(q.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-start gap-2.5 border-t border-[#ececef] pt-6 dark:border-white/10">
            {reviewing ? (
              <>
                <Button
                  variant="outline"
                  className={secondaryBtn}
                  disabled={busy}
                  onClick={() => setReviewing(false)}
                >
                  <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Edit answers
                </Button>
                <Button className={primaryBtn} disabled={busy} onClick={submit}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  Send application
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  className={secondaryBtn}
                  onClick={browse}
                >
                  Browse campaigns
                </Button>
                <Button
                  className={primaryBtn}
                  disabled={busy}
                  onClick={questions.length > 0 ? goToReview : submit}
                >
                  {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}
                  {questions.length > 0 ? "Review application" : "Send application"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmWithdraw} onOpenChange={(o) => !o && setConfirmWithdraw(false)}>
        <AlertDialogContent className={cn(isDark ? "dark border-white/10 bg-[#161616] text-white" : "text-gray-900")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
            <AlertDialogDescription>
              The brand won&apos;t see it anymore. You can apply again while applications are open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn(btnRow, outlineDark)} disabled={busy}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(btnRow, "bg-red-600 text-white hover:bg-red-700")}
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                withdraw();
              }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

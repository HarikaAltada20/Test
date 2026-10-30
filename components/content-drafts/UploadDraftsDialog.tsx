"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CircleCheck,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import {
  DRAFT_FILE_ACCEPT,
  MAX_DRAFTS_PER_UPLOAD,
  MAX_DRAFT_CAPTION_LENGTH,
  MAX_DRAFT_FILE_BYTES,
  MAX_DRAFT_DURATION_SEC,
  MAX_DRAFT_NOTE_LENGTH,
  MAX_DRAFT_TITLE_LENGTH,
  draftSendResultMessage,
  formatBytes,
  formatDuration,
  parseHashtags,
  titleFromFileName,
  validateDraftFields,
  validateDraftFile,
  type DraftFieldErrors,
} from "@/lib/content-drafts";
import { DraftUploadError, readVideoDetails, type VideoDetails } from "@/lib/content-draft-upload";
import { newId, sendDraft } from "./send-draft";

type CardStatus = "empty" | "reading" | "ready" | "uploading" | "saving" | "sent" | "error";

type Card = {
  key: string;
  draftId: string;
  versionId: string;
  file: File | null;
  details: VideoDetails | null;
  posterUrl: string | null;
  fileError: string | null;
  title: string;
  caption: string;
  hashtags: string;
  note: string;
  errors: DraftFieldErrors;
  status: CardStatus;
  progress: number;
  message: string | null;
};

export type RevisionTarget = {
  draftId: string;
  title: string;
  caption: string | null;
  hashtags: string[];
  nextVersionNo: number;
  feedback: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  campaignTitle?: string | null;
  /** New drafts, or one revision of an existing draft. */
  revision?: RevisionTarget | null;
  /** Drafts the creator can still have open (null = no limit). */
  slotsLeft?: number | null;
  maxOpen?: number | null;
  openCount?: number;
  isDark: boolean;
  /** Called after at least one draft or revision was sent. */
  onSent: (sentCount: number) => void;
};

const UPLOAD_CONCURRENCY = 2;
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const fieldDark = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";

function emptyCard(revision?: RevisionTarget | null): Card {
  return {
    key: newId(),
    draftId: revision?.draftId ?? newId(),
    versionId: newId(),
    file: null,
    details: null,
    posterUrl: null,
    fileError: null,
    title: revision?.title ?? "",
    caption: revision?.caption ?? "",
    hashtags: revision?.hashtags.map((t) => `#${t}`).join(" ") ?? "",
    note: "",
    errors: {},
    status: "empty",
    progress: 0,
    message: null,
  };
}

const busyStatuses: CardStatus[] = ["reading", "uploading", "saving"];

export function UploadDraftsDialog({
  open,
  onOpenChange,
  contestId,
  campaignTitle,
  revision = null,
  slotsLeft = null,
  maxOpen = null,
  openCount = 0,
  isDark,
  onSent,
}: Props) {
  const isRevision = !!revision;
  const [cards, setCards] = useState<Card[]>(() => [emptyCard(revision)]);
  const [running, setRunning] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const capacity = isRevision
    ? 1
    : Math.max(1, Math.min(MAX_DRAFTS_PER_UPLOAD, slotsLeft ?? MAX_DRAFTS_PER_UPLOAD));

  // Fresh form each time it opens; release preview images when it closes.
  useEffect(() => {
    if (open) {
      setCards([emptyCard(revision)]);
      setRunning(false);
    }
    return () => {
      cardsRef.current.forEach((c) => c.posterUrl && URL.revokeObjectURL(c.posterUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = useCallback((key: string, patch: Partial<Card> | ((c: Card) => Partial<Card>)) => {
    setCards((prev) =>
      prev.map((c) => (c.key === key ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)),
    );
  }, []);

  const attachFile = useCallback(
    async (key: string, file: File) => {
      const quickError = validateDraftFile(file);
      update(key, (c) => {
        if (c.posterUrl) URL.revokeObjectURL(c.posterUrl);
        return {
          file,
          details: null,
          posterUrl: null,
          // A different file must never reuse an earlier upload's name.
          versionId: newId(),
          fileError: quickError,
          status: quickError ? "error" : "reading",
          message: null,
          progress: 0,
          title: c.title || (isRevision ? c.title : titleFromFileName(file.name)),
        };
      });
      if (quickError) return;
      const details = await readVideoDetails(file);
      const durationError = validateDraftFile(file, details.durationSec);
      update(key, (c) => {
        if (c.file !== file) return {};
        return {
          details,
          posterUrl: details.poster ? URL.createObjectURL(details.poster) : null,
          fileError: durationError,
          status: durationError ? "error" : "ready",
        };
      });
    },
    [update, isRevision],
  );

  /** Files picked or dropped on a card: the first fills it, the rest get new cards. */
  const addFiles = (key: string, files: File[]) => {
    if (files.length === 0) return;
    const [first, ...rest] = files;
    attachFile(key, first);
    if (isRevision || rest.length === 0) return;
    const room = Math.max(0, capacity - cardsRef.current.length);
    const extra = rest.slice(0, room).map(() => emptyCard());
    setCards((prev) => [...prev, ...extra]);
    extra.forEach((card, i) => attachFile(card.key, rest[i]));
  };

  const removeCard = (key: string) => {
    setCards((prev) => {
      const card = prev.find((c) => c.key === key);
      if (card?.posterUrl) URL.revokeObjectURL(card.posterUrl);
      const next = prev.filter((c) => c.key !== key);
      return next.length ? next : [emptyCard(revision)];
    });
  };

  const pending = cards.filter((c) => c.status !== "sent");
  const sentCount = cards.filter((c) => c.status === "sent").length;
  const anyBusy = cards.some((c) => busyStatuses.includes(c.status));
  const allSent = cards.length > 0 && pending.length === 0;

  const submit = async () => {
    // Validate everything first so problems show at once.
    let valid = true;
    const checked = cardsRef.current.map((c) => {
      if (c.status === "sent") return c;
      const tags = parseHashtags(c.hashtags);
      const errors = validateDraftFields({ title: c.title, caption: c.caption, hashtags: tags, note: c.note });
      const fileError = c.file ? c.fileError ?? validateDraftFile(c.file, c.details?.durationSec) : "Choose a video.";
      if (Object.keys(errors).length || fileError) valid = false;
      return { ...c, errors, fileError };
    });
    setCards(checked);
    if (!valid) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    let sentNow = 0;
    const queue = checked.filter((c) => c.status !== "sent");

    const runOne = async (card: Card) => {
      update(card.key, { status: "uploading", progress: 0, message: null });
      try {
        const result = await sendDraft({
          mode: isRevision ? "revise" : "create",
          contestId,
          draftId: card.draftId,
          versionId: card.versionId,
          file: card.file!,
          details: card.details,
          fields: {
            title: card.title,
            caption: card.caption,
            hashtags: parseHashtags(card.hashtags),
            note: card.note,
          },
          signal: controller.signal,
          onProgress: (done, total) => update(card.key, { progress: total ? done / total : 0 }),
          onSaving: () => update(card.key, { status: "saving", progress: 1 }),
        });
        if (result.result === "submitted") {
          sentNow++;
          update(card.key, { status: "sent", message: null });
        } else {
          update(card.key, { status: "error", message: draftSendResultMessage(result.result, result.detail) });
        }
      } catch (err) {
        const message =
          err instanceof DraftUploadError || err instanceof Error
            ? err.message
            : "Upload failed. Try again.";
        update(card.key, { status: "error", message });
      }
    };

    const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, async () => {
      while (queue.length && !controller.signal.aborted) {
        await runOne(queue.shift()!);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    abortRef.current = null;
    if (sentNow > 0) onSent(sentNow);
  };

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (running) setConfirmClose(true);
    else onOpenChange(false);
  };

  const remainingHint = useMemo(() => {
    if (isRevision || maxOpen == null) return null;
    return `You can have ${maxOpen} drafts in review at a time (${openCount} open now).`;
  }, [isRevision, maxOpen, openCount]);

  return (
    <>
      <Dialog isdark={isDark} open={open} onOpenChange={requestClose}>
        <DialogContent
          className={cn(
            "flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-2xl",
            isDark ? "dark text-white" : "text-gray-900",
          )}
          onInteractOutside={(e) => running && e.preventDefault()}
        >
          <DialogHeader className="border-b border-gray-200 p-5 pr-12 dark:border-white/10">
            <DialogTitle>
              {isRevision ? `Upload revision (v${revision!.nextVersionNo})` : "Upload drafts for review"}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {isRevision
                ? "Upload the changed video. The brand reviews it in the same draft."
                : `The brand${campaignTitle ? ` of ${campaignTitle}` : ""} reviews each video before you post it. Don't post until it's approved.`}
            </DialogDescription>
            {revision?.feedback && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-medium">Requested changes:</span> {revision.feedback}
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {cards.map((card, index) => (
              <DraftCardForm
                key={card.key}
                card={card}
                index={index}
                showIndex={!isRevision}
                canRemove={!isRevision && cards.length > 1 && card.status !== "sent" && !busyStatuses.includes(card.status)}
                multiple={!isRevision && index === cards.length - 1 && cards.length < capacity}
                locked={running || card.status === "sent"}
                onFiles={(files) => addFiles(card.key, files)}
                onChange={(patch) => update(card.key, patch)}
                onRemove={() => removeCard(card.key)}
              />
            ))}

            {!isRevision && !allSent && (
              <div className="flex flex-col items-start gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={outlineDark}
                  disabled={running || cards.length >= capacity}
                  onClick={() => setCards((prev) => [...prev, emptyCard()])}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add another draft
                </Button>
                {remainingHint && <p className="text-xs text-gray-500 dark:text-gray-400">{remainingHint}</p>}
                {cards.length >= capacity && slotsLeft !== null && slotsLeft < MAX_DRAFTS_PER_UPLOAD && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    That&apos;s all the free slots you have right now.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 border-t border-gray-200 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              MP4, MOV or WebM · up to {formatBytes(MAX_DRAFT_FILE_BYTES)} and{" "}
              {formatDuration(MAX_DRAFT_DURATION_SEC)} each
            </p>
            {allSent ? (
              <Button onClick={() => onOpenChange(false)} className="bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200">
                Done
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className={outlineDark} onClick={() => requestClose(false)}>
                  {running ? "Stop" : "Cancel"}
                </Button>
                <Button
                  onClick={submit}
                  disabled={running || anyBusy}
                  className="bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200"
                >
                  {running ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {isRevision
                    ? "Send revision"
                    : sentCount > 0
                      ? "Retry the rest"
                      : pending.length > 1
                        ? `Submit ${pending.length} for review`
                        : "Submit for review"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#111113] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop uploading?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              Videos that haven&apos;t finished won&apos;t be sent. Drafts already sent stay in review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark}>Keep uploading</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                abortRef.current?.abort();
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Stop and close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type CardProps = {
  card: Card;
  index: number;
  showIndex: boolean;
  canRemove: boolean;
  /** Allow picking several files (fills new cards). */
  multiple: boolean;
  locked: boolean;
  onFiles: (files: File[]) => void;
  onChange: (patch: Partial<Card>) => void;
  onRemove: () => void;
};

function DraftCardForm({ card, index, showIndex, canRemove, multiple, locked, onFiles, onChange, onRemove }: CardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const id = card.key;
  const tags = parseHashtags(card.hashtags);
  const disabled = locked || card.status === "reading";

  return (
    <section
      aria-label={showIndex ? `Draft ${index + 1}` : "Revision"}
      className={cn(
        "rounded-lg border p-4",
        card.status === "sent"
          ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/5"
          : card.status === "error"
            ? "border-red-200 dark:border-red-500/40"
            : "border-gray-200 dark:border-white/10",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {showIndex ? `Draft ${index + 1}` : "New version"}
        </h3>
        {canRemove && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:bg-white/10"
            onClick={onRemove}
            aria-label={`Remove draft ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Video */}
        <div className="sm:w-36 sm:shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept={DRAFT_FILE_ACCEPT}
            multiple={multiple}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              onFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              if (disabled) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!disabled) onFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className={cn(
              "relative flex aspect-[9/16] w-28 flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 border-dashed text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] dark:focus-visible:ring-white sm:w-36",
              dragging
                ? "border-[#0a0a0a] bg-[#fafafa] dark:border-white dark:bg-white/10"
                : "border-[#e5e5e5] bg-[#fafafa] hover:border-[#0a0a0a]/50 dark:border-white/15 dark:bg-white/5 dark:hover:border-white/40",
              disabled && "cursor-default",
            )}
            aria-label={card.file ? `Change video (${card.file.name})` : "Choose a video"}
          >
            {card.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : card.file ? (
              <Film className="h-6 w-6 text-gray-400" aria-hidden="true" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-[#0a0a0a] dark:text-white" aria-hidden="true" />
                <span className="px-2 font-medium text-gray-700 dark:text-gray-200">
                  {multiple ? "Choose videos" : "Choose a video"}
                </span>
                <span className="px-2 text-gray-500 dark:text-gray-400">or drop here</span>
              </>
            )}
            {card.status === "reading" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-label="Reading video" />
              </span>
            )}
          </button>
          {card.file && (
            <p className="mt-1.5 w-28 truncate text-xs text-gray-500 dark:text-gray-400 sm:w-36" title={card.file.name}>
              {[formatBytes(card.file.size), formatDuration(card.details?.durationSec)].filter(Boolean).join(" · ")}
            </p>
          )}
          {card.fileError && (
            <p role="alert" className="mt-1 w-28 text-xs text-red-600 dark:text-red-400 sm:w-36">
              {card.fileError}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
              value={card.title}
              maxLength={MAX_DRAFT_TITLE_LENGTH}
              disabled={locked}
              placeholder="What's this video?"
              aria-invalid={!!card.errors.title}
              onChange={(e) => onChange({ title: e.target.value, errors: { ...card.errors, title: undefined } })}
              className={fieldDark}
            />
            {card.errors.title && <p className="text-xs text-red-600 dark:text-red-400">{card.errors.title}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-caption`}>Caption</Label>
            <Textarea
              id={`${id}-caption`}
              rows={2}
              value={card.caption}
              maxLength={MAX_DRAFT_CAPTION_LENGTH}
              disabled={locked}
              placeholder="The caption you plan to post"
              onChange={(e) => onChange({ caption: e.target.value })}
              className={fieldDark}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-tags`}>Hashtags</Label>
            <Input
              id={`${id}-tags`}
              value={card.hashtags}
              disabled={locked}
              placeholder="#brand #campaign"
              aria-invalid={!!card.errors.hashtags}
              aria-describedby={tags.length ? `${id}-tags-preview` : undefined}
              onChange={(e) => onChange({ hashtags: e.target.value, errors: { ...card.errors, hashtags: undefined } })}
              className={fieldDark}
            />
            {tags.length > 0 && (
              <div id={`${id}-tags-preview`} className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t.toLowerCase()}
                    className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#404040] dark:bg-white/10 dark:text-neutral-200"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            {card.errors.hashtags && <p className="text-xs text-red-600 dark:text-red-400">{card.errors.hashtags}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-note`}>
              {showIndex ? "Note to the brand (optional)" : "What did you change? (optional)"}
            </Label>
            <Textarea
              id={`${id}-note`}
              rows={2}
              value={card.note}
              maxLength={MAX_DRAFT_NOTE_LENGTH}
              disabled={locked}
              onChange={(e) => onChange({ note: e.target.value })}
              className={fieldDark}
            />
          </div>
        </div>
      </div>

      {(card.status === "uploading" || card.status === "saving") && (
        <div className="mt-3 space-y-1" aria-live="polite">
          <div
            className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(card.progress * 100)}
            aria-label="Upload progress"
          >
            <div
              className="h-full rounded-full bg-[#0a0a0a] dark:bg-white transition-[width] duration-300"
              style={{ width: `${Math.max(2, Math.round(card.progress * 100))}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {card.status === "saving" ? "Sending for review…" : `Uploading… ${Math.round(card.progress * 100)}%`}
          </p>
        </div>
      )}
      {card.status === "sent" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CircleCheck className="h-4 w-4" aria-hidden="true" /> Sent for review
        </p>
      )}
      {card.status === "error" && card.message && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {card.message}
            {!locked && card.file && !card.fileError && (
              <span className="ml-1 inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Submit again to retry.
              </span>
            )}
          </span>
        </p>
      )}
    </section>
  );
}

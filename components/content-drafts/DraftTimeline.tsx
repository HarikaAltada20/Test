"use client";

import { useState } from "react";
import {
  CircleCheck,
  CircleX,
  Clock,
  Link2,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";
import {
  DRAFT_EVENT_LABELS,
  MAX_DRAFT_COMMENT_LENGTH,
  type DraftEvent,
  type DraftEventKind,
} from "@/lib/content-drafts";

const EVENT_ICONS: Record<DraftEventKind, { icon: LucideIcon; tone: string }> = {
  submitted: { icon: Upload, tone: "text-[#7F39EC] bg-purple-50 dark:bg-[#7F39EC]/20 dark:text-purple-200" },
  revised: { icon: Upload, tone: "text-[#7F39EC] bg-purple-50 dark:bg-[#7F39EC]/20 dark:text-purple-200" },
  approved: { icon: CircleCheck, tone: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300" },
  revision_requested: { icon: RotateCcw, tone: "text-amber-700 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-300" },
  rejected: { icon: CircleX, tone: "text-red-700 bg-red-50 dark:bg-red-500/15 dark:text-red-300" },
  approval_revoked: { icon: CircleX, tone: "text-red-700 bg-red-50 dark:bg-red-500/15 dark:text-red-300" },
  withdrawn: { icon: Undo2, tone: "text-gray-600 bg-gray-100 dark:bg-white/10 dark:text-gray-300" },
  expired: { icon: Clock, tone: "text-gray-600 bg-gray-100 dark:bg-white/10 dark:text-gray-300" },
  posted: { icon: Send, tone: "text-slate-700 bg-slate-100 dark:bg-white/10 dark:text-slate-200" },
  comment: { icon: MessageSquare, tone: "text-gray-600 bg-gray-100 dark:bg-white/10 dark:text-gray-300" },
};

function actorLabel(e: DraftEvent): string {
  if (e.actor_role === "system") return "";
  if (e.is_me) return "You";
  if (e.actor_role === "creator") return e.actor_name ? `@${e.actor_name}` : "The creator";
  return e.actor_name || (e.actor_role === "admin" ? "Game of Creators team" : "The brand");
}

function eventSentence(e: DraftEvent): string {
  if (e.kind === "approval_revoked") {
    const to = (e.meta as { to?: string } | null)?.to;
    return to === "rejected" ? "withdrew the approval and rejected the draft" : "withdrew the approval and asked for changes";
  }
  if (e.kind === "approved" && e.version_no) return `approved v${e.version_no}`;
  if ((e.kind === "submitted" || e.kind === "revised") && e.version_no) {
    return e.kind === "submitted" ? `sent v${e.version_no} for review` : `uploaded v${e.version_no}`;
  }
  if (e.kind === "posted") {
    const platform = (e.meta as { platform?: string } | null)?.platform;
    return platform ? `submitted the ${platform} post` : DRAFT_EVENT_LABELS.posted;
  }
  return DRAFT_EVENT_LABELS[e.kind];
}

type Props = {
  events: DraftEvent[];
  canComment: boolean;
  onComment?: (body: string) => Promise<boolean>;
  /** Placeholder for the message box, e.g. "Message the brand". */
  placeholder?: string;
};

/** The draft's history and conversation, oldest first, with a message box. */
export function DraftTimeline({ events, canComment, onComment, placeholder = "Write a message" }: Props) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = body.trim();

  const send = async () => {
    if (!onComment || !trimmed || sending) return;
    setSending(true);
    try {
      if (await onComment(trimmed)) setBody("");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="draft-timeline-heading" className="space-y-3">
      <h3
        id="draft-timeline-heading"
        className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
      >
        History and messages
      </h3>
      <ol className="space-y-3">
        {events.map((e) => {
          if (e.kind === "comment") {
            return (
              <li key={e.id} className={cn("flex", e.is_me ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    e.is_me
                      ? "rounded-br-sm bg-[#7F39EC] text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-gray-100",
                  )}
                >
                  {!e.is_me && (
                    <p className="mb-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {actorLabel(e)}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{e.body}</p>
                  <p className={cn("mt-1 text-[11px]", e.is_me ? "text-white/70" : "text-gray-500 dark:text-gray-400")}>
                    <RelativeTime value={e.created_at} />
                  </p>
                </div>
              </li>
            );
          }
          const { icon: Icon, tone } = EVENT_ICONS[e.kind];
          const who = actorLabel(e);
          const postLink = e.kind === "posted" ? (e.meta as { content_link?: string } | null)?.content_link : null;
          return (
            <li key={e.id} className="flex gap-3">
              <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", tone)}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-gray-900 dark:text-gray-100">
                  {who && <span className="font-medium">{who} </span>}
                  {who ? eventSentence(e) : eventSentence(e).replace(/^./, (c) => c.toUpperCase())}
                  <span className="text-gray-500 dark:text-gray-400">
                    {" · "}
                    <RelativeTime value={e.created_at} />
                  </span>
                </p>
                {e.body && (
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-gray-50 px-3 py-2 text-gray-700 dark:bg-white/5 dark:text-gray-200">
                    {e.body}
                  </p>
                )}
                {postLink && /^https?:\/\//i.test(postLink) && (
                  <a
                    href={postLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-sm text-xs font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
                  >
                    <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{postLink}</span>
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {canComment && onComment && (
        <div className="space-y-2">
          <label htmlFor="draft-comment" className="sr-only">
            {placeholder}
          </label>
          <Textarea
            id="draft-comment"
            rows={2}
            maxLength={MAX_DRAFT_COMMENT_LENGTH}
            placeholder={placeholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            className="dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {body.length > MAX_DRAFT_COMMENT_LENGTH - 200 ? `${body.length}/${MAX_DRAFT_COMMENT_LENGTH}` : ""}
            </span>
            <Button size="sm" onClick={send} disabled={!trimmed || sending} className="bg-[#7F39EC] hover:bg-[#7F39EC]/90">
              {sending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

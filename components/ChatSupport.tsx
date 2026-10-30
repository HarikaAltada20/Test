"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  ExternalLink,
  MessageCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SUPPORT_DISABLED_MESSAGE } from "@/lib/constants/support";
import {
  formatSenderRoleLabel,
  isCustomerSupportMessage,
} from "@/lib/support/sender-role";
import { dispatchNotificationsChanged } from "@/lib/user-notifications/events";

type View = "compose" | "inbox" | "thread";

type Thread = {
  id: string;
  status: string;
  subject: string | null;
  last_message_at: string;
  created_at: string;
};

const CLOSED_THREAD_NOTICE =
  "This query has been closed by support. Close this window and click Chat with us to submit a new query.";

type Message = {
  id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

interface ChatProps {
  onClose: () => void;
  email: string;
  userType?: "creator" | "advertiser" | "admin";
  initialThreadId?: string | null;
  supportChatEnabled?: boolean;
}

const ChatSupport: React.FC<ChatProps> = ({
  onClose,
  userType,
  initialThreadId,
  supportChatEnabled = true,
}) => {
  const [view, setView] = useState<View>(initialThreadId ? "thread" : "compose");
  const [composer, setComposer] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId ?? null,
  );
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(!!initialThreadId);
  const sendInFlightRef = useRef(false);
  const { toast } = useToast();

  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") return dataMode;
    if (document.documentElement.classList.contains("dark")) return "dark";
    return "light";
  };

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);

  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };
    setMode(readMode());
    const observer = new MutationObserver(() => setMode(readMode()));
    const dataModeTarget = document.querySelector("[data-mode]");
    if (dataModeTarget) {
      observer.observe(dataModeTarget, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";

  const loadThreads = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/support/threads");
      const data = await res.json();
      if (res.ok) {
        setThreads(data.threads ?? []);
      }
    } finally {
      setFetching(false);
    }
  }, []);

  const loadThreadDetail = useCallback(async (threadId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/support/threads/${threadId}`);
      const data = await res.json();
      if (res.ok) {
        setActiveThread(data.thread ?? null);
        setMessages(data.messages ?? []);
      }
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (!supportChatEnabled) return;
    loadThreads();
  }, [supportChatEnabled, loadThreads]);

  useEffect(() => {
    if (initialThreadId) {
      setSelectedThreadId(initialThreadId);
      setView("thread");
    }
  }, [initialThreadId]);

  useEffect(() => {
    if (view === "thread" && selectedThreadId && supportChatEnabled) {
      loadThreadDetail(selectedThreadId);
    }
  }, [view, selectedThreadId, supportChatEnabled, loadThreadDetail]);

  // Refresh thread + notification badge while chat is open (no global polling).
  useEffect(() => {
    if (view !== "thread" || !selectedThreadId || !supportChatEnabled) return;

    const refresh = () => {
      void loadThreadDetail(selectedThreadId).then(() =>
        dispatchNotificationsChanged(),
      );
    };

    const interval = setInterval(refresh, 25_000);
    return () => clearInterval(interval);
  }, [view, selectedThreadId, supportChatEnabled, loadThreadDetail]);

  // Brand/advertiser should never see inbox list mode.
  useEffect(() => {
    if (userType === "advertiser" && view === "inbox") {
      setView("compose");
    }
  }, [userType, view]);

  const handleBack = () => {
    if (view === "thread" || view === "inbox") {
      onClose();
    }
  };

  const canReplyInThread =
    view === "thread" &&
    selectedThreadId &&
    activeThread?.status !== "closed";

  const handleSend = async () => {
    if (!composer.trim()) {
      toast({
        title: "Missing Query",
        description: "Please enter your message before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (sendInFlightRef.current) return;

    sendInFlightRef.current = true;
    setLoading(true);
    try {
      const res = canReplyInThread
        ? await fetch(`/api/support/threads/${selectedThreadId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: composer }),
          })
        : await fetch("/api/support/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: composer }),
          });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save message");

      setComposer("");

      if (canReplyInThread && selectedThreadId) {
        await loadThreadDetail(selectedThreadId);
        void fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ support_thread_id: selectedThreadId }),
        });
        dispatchNotificationsChanged();
        toast({
          title: "Sent",
          description: "Your message was sent to support.",
        });
      } else {
        setView("compose");
        setSelectedThreadId(null);
        setActiveThread(null);
        setMessages([]);
        await loadThreads();
        dispatchNotificationsChanged();
        toast({
          title: "Success",
          description: "Your new query has been submitted successfully!",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      sendInFlightRef.current = false;
      setLoading(false);
    }
  };

  const headerTitle =
    view === "compose"
      ? "Get in touch"
      : view === "inbox" && userType === "creator"
        ? "My conversations"
        : "Support chat";

  const fieldClass = cn(
    "w-full resize-none rounded-xl border px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-[#1a1a1a]/15",
    isDark
      ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:ring-white/20"
      : "border-[#e6e6e8] bg-[#f6f6f7] text-[#1a1a1a] placeholder:text-[#8b8b93]",
  );
  const mutedClass = isDark ? "text-white/55" : "text-[#8b8b93]";
  const communityButtonClass = cn(
    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
    isDark
      ? "border-white/15 text-white hover:bg-white/10"
      : "border-[#e6e6e8] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7]",
  );

  const renderCreatorCommunityCta = () =>
    userType === "creator" ? (
      <div
        className={cn(
          "mt-3 rounded-xl border p-3",
          isDark
            ? "border-white/10 bg-white/[0.04]"
            : "border-[#e6e6e8] bg-[#f6f6f7]",
        )}
      >
        <div className="flex items-start gap-2.5">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isDark
                ? "bg-[rgb(var(--accent-rgb)/0.22)] text-[rgb(var(--accent-2-rgb))]"
                : "bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--violet-600)]",
            )}
          >
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-base leading-snug",
                isDark ? "text-white/80" : "text-[#3a3a40]",
              )}
            >
              For a faster reply, join the Game of Creators Discord and WhatsApp
              communities.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className={communityButtonClass}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Discord
              </a>
              <a
                href={SOCIAL_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className={communityButtonClass}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const renderCompose = () => (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <h3
        className={cn(
          "text-lg font-semibold",
          isDark ? "text-white" : "text-[#1a1a1a]",
        )}
      >
        Drop us a query
      </h3>
      <p className={cn("mb-4 mt-1.5 text-base leading-relaxed", mutedClass)}>
        Tell us what you need. We usually reply within 24 hours.
      </p>
      <textarea
        placeholder="Type your query"
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        className={cn(fieldClass, "min-h-[150px] flex-1")}
      />
      {renderCreatorCommunityCta()}
    </div>
  );

  const renderInbox = () => (
    <div className="flex-1 overflow-y-auto min-h-0">
      {fetching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--violet-600)]" />
        </div>
      ) : threads.length === 0 ? (
        <p
          className={cn(
            "text-sm text-center py-6",
            isDark ? "text-slate-400" : "text-gray-500",
          )}
        >
          No conversations yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedThreadId(t.id);
                  setView("thread");
                  setMessages([]);
                  setLoadingThread(true);
                }}
                className={cn(
                  "w-full rounded-xl px-3 py-2.5 text-left transition",
                  isDark ? "hover:bg-white/5" : "hover:bg-[#f6f6f7]",
                )}
              >
                <p className="truncate text-base font-medium">
                  {t.subject || "Support conversation"}
                </p>
                <p className={cn("mt-0.5 text-sm capitalize", mutedClass)}>
                  {new Date(t.last_message_at).toLocaleString()} · {t.status}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderThreadSkeleton = () => (
    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
      {[
        { align: "start" as const, width: "w-48" },
        { align: "end" as const, width: "w-56" },
        { align: "start" as const, width: "w-40" },
      ].map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex",
            item.align === "end" ? "justify-end" : "justify-start",
          )}
        >
          <div className="max-w-[85%] space-y-1.5">
            {item.align === "start" && (
              <Skeleton
                className={cn("h-2.5 w-14", isDark && "bg-slate-700")}
              />
            )}
            <Skeleton
              className={cn(
                "h-14 rounded-lg",
                item.width,
                isDark && "bg-slate-700",
              )}
            />
            <Skeleton
              className={cn("h-2 w-20", isDark && "bg-slate-700")}
            />
          </div>
        </div>
      ))}
    </div>
  );

  const renderThread = () => (
    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
      {activeThread?.status === "closed" && (
        <p
          className={cn(
            "mb-3 shrink-0 rounded-xl border px-3 py-2 text-sm",
            isDark
              ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
              : "border-amber-200 bg-amber-50 text-amber-900",
          )}
        >
          {CLOSED_THREAD_NOTICE}
        </p>
      )}
      {loadingThread && messages.length === 0 ? (
        renderThreadSkeleton()
      ) : (
      <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
        {messages.length === 0 ? (
          <p
            className={cn(
              "text-sm text-center py-6",
              isDark ? "text-slate-400" : "text-gray-500",
            )}
          >
            No messages yet.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                isCustomerSupportMessage(m.sender_role)
                  ? "justify-end"
                  : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-base",
                  isCustomerSupportMessage(m.sender_role)
                    ? "bg-[var(--accent-btn-base)] text-white"
                    : isDark
                      ? "bg-white/10 text-white"
                      : "bg-[#f3f3f5] text-[#1a1a1a]",
                )}
              >
                {!isCustomerSupportMessage(m.sender_role) && (
                  <p className="text-[10px] font-medium opacity-80 mb-1">
                    {formatSenderRoleLabel(m.sender_role)}
                  </p>
                )}
                {m.body}
                <p className="text-[10px] opacity-70 mt-1">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      )}
      {activeThread?.status !== "closed" && (
        <textarea
          placeholder="Type your reply"
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          className={cn(fieldClass, "mt-3 h-[160px] shrink-0")}
        />
      )}
    </div>
  );

  const showSubmitButton =
    view === "compose" ||
    (view === "thread" && activeThread?.status !== "closed");

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          "fixed bottom-6 right-2 z-50 flex h-[min(720px,78vh)] w-[calc(100vw-1rem)] max-w-[460px] flex-col overflow-hidden rounded-2xl border shadow-xl sm:right-6 sm:w-[460px]",
          isDark
            ? "border-white/10 bg-[#161616] text-white"
            : "border-[#e6e6e8] bg-white text-[#1a1a1a]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-b px-4 py-3.5",
            isDark ? "border-white/10" : "border-[#eeeef0]",
          )}
        >
          {view !== "compose" && supportChatEnabled ? (
            <button
              type="button"
              onClick={handleBack}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isDark ? "hover:bg-white/10" : "hover:bg-[#f6f6f7]",
              )}
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isDark
                  ? "bg-[rgb(var(--accent-rgb)/0.22)] text-[rgb(var(--accent-2-rgb))]"
                  : "bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--violet-600)]",
              )}
            >
              <MessageCircle className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{headerTitle}</h2>
            {view === "compose" ? (
              <p className={cn("truncate text-sm", mutedClass)}>
                We are here to help
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isDark ? "hover:bg-white/10" : "hover:bg-[#f6f6f7]",
            )}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {!supportChatEnabled ? (
            <p className={cn("text-sm", mutedClass)}>{SUPPORT_DISABLED_MESSAGE}</p>
          ) : (
            <>
              {view === "compose" && renderCompose()}
              {view === "inbox" && renderInbox()}
              {view === "thread" && renderThread()}

              {showSubmitButton && (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading}
                  className="goc-btn-primary mt-4 h-12 w-full shrink-0 rounded-full text-base font-semibold disabled:opacity-60"
                >
                  {loading
                    ? "Sending..."
                    : view === "thread"
                      ? "Send"
                      : "Submit"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSupport;

"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { SUPPORT_DISABLED_MESSAGE } from "@/lib/constants/support";
import {
  formatSenderRoleLabel,
  isCustomerSupportMessage,
} from "@/lib/support/sender-role";

type View = "compose" | "inbox" | "thread";

type Thread = {
  id: string;
  status: string;
  subject: string | null;
  last_message_at: string;
  created_at: string;
};

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
  const [messages, setMessages] = useState<Message[]>([]);
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
    const res = await fetch(`/api/support/threads/${threadId}`);
    const data = await res.json();
    if (res.ok) {
      setMessages(data.messages ?? []);
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

  const handleBack = () => {
    if (view === "thread" || view === "inbox") {
      setView("compose");
      setSelectedThreadId(null);
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!composer.trim()) {
      toast({
        title: "Missing Query",
        description: "Please enter your query before submitting.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (view === "thread" && selectedThreadId) {
        res = await fetch(`/api/support/threads/${selectedThreadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: composer }),
        });
      } else {
        res = await fetch("/api/support/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: composer }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save query");

      setComposer("");
      await loadThreads();

      if (view === "compose") {
        toast({
          title: "Success",
          description: "Your query has been submitted successfully!",
        });
      } else {
        const threadId = selectedThreadId || data.thread?.id;
        if (threadId) {
          setSelectedThreadId(threadId);
          await loadThreadDetail(threadId);
        }
        toast({ title: "Message sent" });
      }
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const headerTitle =
    view === "compose"
      ? "Get Touch with Us!"
      : view === "inbox"
        ? "My conversations"
        : "Support chat";

  const renderCreatorCommunityCta = () =>
    userType === "creator" ? (
      <div
        className={cn(
          "mb-4 p-3 rounded-md border",
          isDark
            ? "bg-[#C9A7FF26] border-[#C9A7FF]"
            : "bg-purple-50 border-purple-500",
        )}
      >
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "p-1.5 rounded-full border",
              isDark
                ? "bg-[#06021D] border-gray-500"
                : "bg-white border-gray-300",
            )}
          >
            <MessageCircle
              className={cn(
                "h-4 w-4",
                isDark ? "text-[#C9A7FF]" : "text-purple-600",
              )}
            />
          </div>
          <div className={cn("flex-1 text-sm", isDark ? "text-white" : "text-gray-700")}>
            For quicker responses, join our active Game of creators discord and
            WhatsApp communities.
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 text-sm"
              >
                <ExternalLink className="h-4 w-4" /> Join Discord
              </a>
              <a
                href={SOCIAL_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#25D366] text-white hover:bg-[#20BA5A] text-sm"
              >
                <ExternalLink className="h-4 w-4" /> Join WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const renderCompose = () => (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <h3 className="font-semibold mb-2 text-base sm:text-lg">Drop us a Query</h3>
      <p
        className={cn(
          "text-sm sm:text-base mb-4",
          isDark ? "text-slate-300" : "text-gray-600",
        )}
      >
        Fill in the details below and our team will get in touch with you within
        24 hours.
      </p>

      <textarea
        placeholder="Type your query here*"
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        className={cn(
          "w-full border px-3 py-2 rounded mb-3 text-sm h-[200px] resize-none focus:outline-none focus:ring-1 focus:ring-purple-500",
          isDark
            ? "bg-[#06021D] border-gray-500 text-white"
            : "bg-white border-gray-300",
        )}
      />

      {renderCreatorCommunityCta()}

    </div>
  );

  const renderInbox = () => (
    <div className="flex-1 overflow-y-auto min-h-0">
      {fetching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
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
        <ul>
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedThreadId(t.id);
                  setView("thread");
                }}
                className={cn(
                  "w-full text-left px-1 py-3 border-b transition",
                  isDark
                    ? "border-slate-700 hover:bg-slate-800/50"
                    : "border-gray-100 hover:bg-purple-50",
                )}
              >
                <p className="text-sm font-medium truncate">
                  {t.subject || "Support conversation"}
                </p>
                <p className="text-xs opacity-70 mt-0.5 capitalize">
                  {new Date(t.last_message_at).toLocaleString()} · {t.status}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderThread = () => (
    <>
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px]">
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
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  isCustomerSupportMessage(m.sender_role)
                    ? isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-purple-600 text-white"
                    : isDark
                      ? "bg-slate-800 text-slate-100"
                      : "bg-gray-100 text-gray-900",
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
      <textarea
        placeholder="Type your message..."
        value={composer}
        onChange={(e) => setComposer(e.target.value)}
        className={cn(
          "w-full border px-3 py-2 rounded text-sm h-20 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500 mt-2",
          isDark
            ? "bg-[#06021D] border-gray-500 text-white"
            : "bg-white border-gray-300",
        )}
      />
    </>
  );

  return (
    <div
      className={cn(
        "fixed inset-0 bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
        isDark ? "bg-[#100A33]" : "bg-black",
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          "fixed right-2 sm:right-6 bottom-20 w-[calc(100vw-1rem)] max-w-[380px] sm:w-[380px] max-h-[85vh] shadow-2xl rounded-lg z-50 flex flex-col overflow-hidden",
          isDark ? "bg-[#06021D]" : "bg-white",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "text-white rounded-t-lg p-4 sm:p-6 flex justify-between items-start shrink-0",
            isDark ? "bg-[#7F39EC]" : "bg-purple-500",
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {view !== "compose" && supportChatEnabled && (
              <button
                type="button"
                onClick={handleBack}
                className="text-white hover:text-gray-200 shrink-0"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
            <h2 className="text-base sm:text-xl truncate">{headerTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-gray-200 shrink-0 ml-2"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-0 overflow-hidden">
          {!supportChatEnabled ? (
            <p className={cn("text-sm", isDark ? "text-slate-300" : "text-gray-600")}>
              {SUPPORT_DISABLED_MESSAGE}
            </p>
          ) : (
            <>
              {view === "compose" && renderCompose()}
              {view === "inbox" && renderInbox()}
              {view === "thread" && renderThread()}

              {(view === "compose" || view === "thread") && (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={loading}
                  className={cn(
                    "w-full py-3 mt-2 rounded-full font-semibold text-white shrink-0",
                    isDark
                      ? "bg-[#7F39EC] hover:bg-[#6B2FD4]"
                      : "bg-gradient-to-r from-[#7F39EC] to-[#B16FF4]",
                  )}
                >
                  {loading ? "Submitting..." : "SUBMIT"}
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

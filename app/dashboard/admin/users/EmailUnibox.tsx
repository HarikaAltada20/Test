"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EmailCampaignListItem } from "@/lib/admin-email/campaign-list";
import type {
  UniboxMessage,
  UniboxThreadListItem,
} from "@/lib/admin-email/unibox";
import { useToast } from "@/hooks/use-toast";
import {
  Archive,
  Loader2,
  Mail,
  MoreVertical,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";

type Props = {
  campaigns: EmailCampaignListItem[];
  isDark?: boolean;
};

type Folder = "all" | "sent" | "replies";
type ReadFilter = "all" | "read" | "unread";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayName(email: string, name?: string | null): string {
  if (name?.trim()) return name.trim();
  return email.split("@")[0] ?? email;
}

function MessageBody({ message }: { message: UniboxMessage }) {
  if (message.bodyHtml?.trim()) {
    return (
      <div
        className="prose prose-sm max-w-none text-[15px] leading-relaxed text-gray-700 prose-p:my-3 prose-p:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
      />
    );
  }
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">
      {message.bodyText ?? message.snippet ?? ""}
    </p>
  );
}

export function EmailUnibox({ campaigns, isDark }: Props) {
  const { toast } = useToast();
  const [threads, setThreads] = useState<UniboxThreadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UniboxMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<UniboxThreadListItem | null>(
    null,
  );
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState<Folder>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [replyText, setReplyText] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncingInbound, setSyncingInbound] = useState(false);

  const syncInbound = useCallback(async (silent = false) => {
    setSyncingInbound(true);
    try {
      const res = await fetch("/api/admin/email-unibox/sync-inbound", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (!silent) {
          throw new Error(data.error ?? "Sync failed");
        }
        return;
      }
      if (!silent && (data.processed ?? 0) > 0) {
        toast({
          title: "Replies synced",
          description: `${data.processed} new reply(s) imported`,
        });
      }
    } catch (err) {
      if (!silent) {
        toast({
          title: "Sync failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setSyncingInbound(false);
    }
  }, [toast]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        folder,
        status: readFilter,
        limit: "50",
        offset: "0",
      });
      if (campaignId !== "all") params.set("campaignId", campaignId);
      if (search.trim()) params.set("search", search.trim());

      const [listRes, unreadRes] = await Promise.all([
        fetch(`/api/admin/email-unibox?${params}`),
        fetch("/api/admin/email-unibox?unreadCount=1"),
      ]);

      const listData = await listRes.json();
      const unreadData = await unreadRes.json();

      if (!listRes.ok) throw new Error(listData.error ?? "Failed to load mails");
      setThreads(listData.threads ?? []);
      setUnreadCount(unreadData.unreadCount ?? 0);
    } catch (err) {
      toast({
        title: "Failed to load Unibox",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [folder, readFilter, campaignId, search, toast]);

  const loadThreadDetail = useCallback(
    async (threadId: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/admin/email-unibox/${threadId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load thread");
        setSelectedThread(data.thread);
        setMessages(data.messages ?? []);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, isRead: true } : t)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        toast({
          title: "Failed to load message",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await syncInbound(true);
      if (!cancelled) await loadThreads();
    })();
    return () => {
      cancelled = true;
    };
  }, [syncInbound, loadThreads]);

  useEffect(() => {
    const interval = setInterval(async () => {
      await syncInbound(true);
      await loadThreads();
      if (selectedId) await loadThreadDetail(selectedId);
    }, 30000);
    return () => clearInterval(interval);
  }, [syncInbound, loadThreads, loadThreadDetail, selectedId]);

  useEffect(() => {
    if (selectedId) {
      loadThreadDetail(selectedId);
    } else {
      setSelectedThread(null);
      setMessages([]);
    }
  }, [selectedId, loadThreadDetail]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const patchThread = async (
    threadId: string,
    patch: { isRead?: boolean; isStarred?: boolean; isArchived?: boolean },
  ) => {
    const res = await fetch(`/api/admin/email-unibox/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Update failed");
    }
  };

  const handleStar = async (thread: UniboxThreadListItem) => {
    const next = !thread.isStarred;
    await patchThread(thread.id, { isStarred: next });
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, isStarred: next } : t)),
    );
    if (selectedThread?.id === thread.id) {
      setSelectedThread({ ...selectedThread, isStarred: next });
    }
  };

  const handleMarkUnread = async (thread: UniboxThreadListItem) => {
    await patchThread(thread.id, { isRead: false });
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, isRead: false } : t)),
    );
    setUnreadCount((c) => c + 1);
  };

  const handleArchive = async (threadId: string) => {
    await patchThread(threadId, { isArchived: true });
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (selectedId === threadId) setSelectedId(null);
    toast({ title: "Archived" });
  };

  const handleDelete = async (threadId: string) => {
    const res = await fetch(`/api/admin/email-unibox/${threadId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      toast({
        title: "Delete failed",
        description: data.error,
        variant: "destructive",
      });
      return;
    }
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (selectedId === threadId) setSelectedId(null);
    toast({ title: "Deleted" });
  };

  const handleSendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/admin/email-unibox/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send reply");
      setReplyText("");
      setReplyOpen(false);
      await loadThreadDetail(selectedId);
      await loadThreads();
      toast({ title: "Reply sent" });
    } catch (err) {
      toast({
        title: "Reply failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSendingReply(false);
    }
  };

  const latestMessage = messages[messages.length - 1];
  const displayMessages =
    messages.length > 0 ? messages : latestMessage ? [latestMessage] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="h-10 border-gray-200 bg-gray-50 pl-9 shadow-none focus-visible:ring-blue-500"
            placeholder="Search Mails, Campaigns and Inboxes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadThreads()}
          />
        </div>
        <Select value={readFilter} onValueChange={(v) => setReadFilter(v as ReadFilter)}>
          <SelectTrigger className="h-10 w-[140px] border-gray-200 bg-white">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className="h-10 w-[170px] border-gray-200 bg-white">
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={folder} onValueChange={(v) => setFolder(v as Folder)}>
          <SelectTrigger className="h-10 w-[120px] border-gray-200 bg-white">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="replies">Replies</SelectItem>
          </SelectContent>
        </Select>
        {unreadCount > 0 && (
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-purple-600 px-2 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
        <Button
          variant="outline"
          className="h-10 border-gray-200"
          disabled={syncingInbound}
          onClick={async () => {
            await syncInbound(false);
            await loadThreads();
            if (selectedId) await loadThreadDetail(selectedId);
          }}
        >
          {syncingInbound ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Sync Replies
        </Button>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-0 rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden min-h-[calc(100vh-280px)]",
          isDark && "border-purple-900/40 bg-[#170337]",
        )}
      >
        <div
          className={cn(
            "flex flex-col border-b lg:border-b-0 lg:border-r",
            isDark ? "border-purple-900/40" : "border-gray-200",
          )}
        >
          <div
            className={cn(
              "px-5 py-4 border-b",
              isDark ? "border-purple-900/40 text-white" : "border-gray-100 text-gray-900",
            )}
          >
            <h3 className="text-lg font-bold tracking-tight">Mails</h3>
          </div>

          {loading ? (
            <div className="flex flex-1 justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : threads.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500 px-6">
              No messages yet. Sent campaign emails and replies will appear here.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-360px)] unibox-scrollbar">
              {threads.map((thread) => {
                const isSelected = selectedId === thread.id;
                const label = displayName(
                  thread.latestFromEmail,
                  thread.latestFromName,
                );
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "relative cursor-pointer border-b px-4 py-4 transition-colors",
                      isDark ? "border-purple-900/20" : "border-gray-100",
                      isSelected
                        ? "bg-sky-50/90 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-blue-500"
                        : "hover:bg-gray-50/80",
                      !thread.isRead && !isSelected && "bg-white",
                    )}
                    onClick={() => setSelectedId(thread.id)}
                  >
                    <div className="flex items-start gap-3 pl-1">
                      <Checkbox
                        checked={checkedIds.has(thread.id)}
                        onCheckedChange={() => toggleCheck(thread.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 border-gray-300 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm text-gray-900 truncate",
                              !thread.isRead ? "font-semibold" : "font-medium",
                            )}
                          >
                            {label}
                          </span>
                          <span className="text-[11px] text-gray-500 shrink-0 whitespace-nowrap">
                            {formatDate(thread.lastMessageAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-gray-500">
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              thread.isStarred
                                ? "fill-amber-400 text-amber-500"
                                : "text-gray-400",
                            )}
                          />
                          <span className="text-xs">{thread.replyCount}</span>
                        </div>

                        <p
                          className={cn(
                            "text-sm text-gray-900 leading-snug",
                            !thread.isRead ? "font-semibold" : "font-medium",
                          )}
                        >
                          {thread.subject ?? "(No subject)"}
                        </p>

                        {thread.snippet && (
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                            {thread.snippet}
                          </p>
                        )}

                        <div className="flex items-center gap-4 pt-1">
                          <button
                            type="button"
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkUnread(thread);
                            }}
                          >
                            Mark Unread
                          </button>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(thread.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="relative flex flex-col min-h-[480px] bg-white">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a message to read</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : selectedThread ? (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">
                    {displayName(
                      selectedThread.contactEmail,
                      selectedThread.contactName,
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <p className="truncate text-sm font-medium text-gray-700">
                    {selectedThread.contactEmail}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStar(selectedThread)}>
                      {selectedThread.isStarred ? "Unstar" : "Star"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleMarkUnread(selectedThread)}
                    >
                      Mark unread
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleArchive(selectedThread.id)}
                    >
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => handleDelete(selectedThread.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="border-b border-gray-100 px-6 py-5">
                <div className="flex items-start justify-between gap-6">
                  <h3 className="text-2xl font-bold leading-tight text-gray-900">
                    {selectedThread.subject ?? "(No subject)"}
                  </h3>
                  <span className="shrink-0 text-sm text-gray-500 pt-1">
                    {formatDate(selectedThread.lastMessageAt)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() => handleStar(selectedThread)}
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        selectedThread.isStarred && "fill-amber-400 text-amber-500",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() => handleArchive(selectedThread.id)}
                  >
                    <Archive className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                    onClick={() => handleDelete(selectedThread.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() => setReplyOpen(true)}
                  >
                    <Reply className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    onClick={() => setReplyOpen(true)}
                  >
                    <ReplyAll className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 unibox-scrollbar space-y-8">
                {displayMessages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      "space-y-3",
                      index > 0 && "border-t border-gray-100 pt-6",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>
                          <span className="font-medium text-gray-800">From:</span>{" "}
                          {message.fromName
                            ? `${message.fromName} <${message.fromEmail}>`
                            : message.fromEmail}
                        </p>
                        <p>
                          <span className="font-medium text-gray-800">to:</span>{" "}
                          {message.toName
                            ? `${message.toName} <${message.toEmail}>`
                            : message.toEmail}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {message.direction === "inbound" && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700">
                            Reply
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDate(message.createdAt)}
                        </span>
                      </div>
                    </div>
                    <MessageBody message={message} />
                    {message.attachments.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {message.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm"
                          >
                            <span className="font-medium text-gray-800">
                              {att.filename}
                            </span>
                            {att.sizeBytes != null && (
                              <span className="text-xs text-gray-500">
                                {(att.sizeBytes / 1024 / 1024).toFixed(1)} MB
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {replyOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
                  <Textarea
                    className="min-h-[120px] resize-none border-gray-200 bg-white"
                    placeholder="Write your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setReplyOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={sendingReply || !replyText.trim()}
                      onClick={handleSendReply}
                    >
                      {sendingReply ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Send Reply
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}

          {!replyOpen && selectedId && (
            <Button
              className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-purple-600 shadow-xl hover:bg-purple-700 hover:shadow-2xl"
              size="icon"
              onClick={() => setReplyOpen(true)}
            >
              <Send className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>

      <style jsx global>{`
        .unibox-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .unibox-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .unibox-scrollbar::-webkit-scrollbar-thumb {
          background: #3b82f6;
          border-radius: 9999px;
        }
        .unibox-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2563eb;
        }
      `}</style>
    </div>
  );
}

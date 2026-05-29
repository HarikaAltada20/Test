"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SupportChatToggle } from "@/components/admin/SupportChatToggle";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SUPPORT_RETENTION_DAYS } from "@/lib/constants/support";
import {
  formatSenderRoleLabel,
  isSupportAdminMessage,
} from "@/lib/support/sender-role";
import { Eye, MessageSquare, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";

type Contact = {
  id: string;
  created_at: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
};

type ThreadUser = {
  id: string;
  email: string;
  username: string | null;
  support_chat_enabled?: boolean;
};

type SupportThread = {
  id: string;
  user_id: string;
  user_type: string | null;
  status: string;
  subject: string | null;
  last_message_at: string;
  created_at: string;
  users: ThreadUser | ThreadUser[] | null;
  last_message_preview?: string;
};

type SupportMessage = {
  id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

function statusBadge(status: string, isDark: boolean) {
  const colors: Record<string, string> = {
    open: isDark ? "bg-blue-900/50 text-blue-200" : "bg-blue-100 text-blue-800",
    replied: isDark ? "bg-green-900/50 text-green-200" : "bg-green-100 text-green-800",
    closed: isDark ? "bg-slate-700 text-slate-300" : "bg-gray-100 text-gray-700",
  };
  return (
    <Badge className={cn("capitalize", colors[status] || "")}>{status}</Badge>
  );
}

function resolveUser(
  users: ThreadUser | ThreadUser[] | null,
): ThreadUser | null {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

export default function SupportClient({
  initialContacts,
}: {
  initialContacts: Contact[] | null | undefined;
}) {
  const [activeTab, setActiveTab] = useState("queries");
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<SupportMessage[]>([]);
  const [detailThread, setDetailThread] = useState<SupportThread | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<
    "single" | "bulk" | "retention" | null
  >(null);
  const [retentionCount, setRetentionCount] = useState(0);
  const { toast } = useToast();

  const contacts = initialContacts || [];
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLimit, setContactsLimit] = useState(25);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        return modeElement.getAttribute("data-mode") === "dark";
      }
    }
    return false;
  });

  useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        setIsDark(modeElement.getAttribute("data-mode") === "dark");
      }
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    return () => observer.disconnect();
  }, []);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(limit),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (userTypeFilter !== "all") params.set("user_type", userTypeFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/support/threads?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load threads");
      setThreads(data.threads ?? []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Load failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, userTypeFilter, search, toast]);

  useEffect(() => {
    if (activeTab === "queries") fetchThreads();
  }, [activeTab, fetchThreads]);

  const loadDetail = async (threadId: string) => {
    const res = await fetch(`/api/admin/support/threads/${threadId}`);
    const data = await res.json();
    if (res.ok) {
      setDetailThread(data.thread);
      setDetailMessages(data.messages ?? []);
      setDetailId(threadId);
    }
  };

  const handleReply = async () => {
    if (!detailId || !replyBody.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(
        `/api/admin/support/threads/${detailId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: replyBody }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reply failed");
      setReplyBody("");
      await loadDetail(detailId);
      await fetchThreads();
      toast({ title: "Reply sent", description: "User has been notified in-app." });
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Reply failed",
        variant: "destructive",
      });
    } finally {
      setReplying(false);
    }
  };

  const runDelete = async () => {
    try {
      if (confirmDelete === "single" && detailId) {
        const res = await fetch(`/api/admin/support/threads/${detailId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error);
        }
        setDetailId(null);
      } else if (confirmDelete === "bulk") {
        const res = await fetch("/api/admin/support/threads/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thread_ids: Array.from(selected) }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setSelected(new Set());
        toast({ title: `Deleted ${d.deleted_count} thread(s)` });
      } else if (confirmDelete === "retention") {
        const res = await fetch(
          "/api/admin/support/threads/delete-before-date",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ before_days: SUPPORT_RETENTION_DAYS }),
          },
        );
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        toast({ title: `Deleted ${d.deleted_count} old thread(s)` });
      }
      setConfirmDelete(null);
      await fetchThreads();
    } catch (e: unknown) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    }
  };

  const previewRetention = async () => {
    const res = await fetch(
      `/api/admin/support/threads/delete-before-date/preview?before_days=${SUPPORT_RETENTION_DAYS}`,
    );
    const data = await res.json();
    if (res.ok) {
      setRetentionCount(data.count ?? 0);
      setConfirmDelete("retention");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const detailUser = detailThread ? resolveUser(detailThread.users) : null;

  const paginatedContacts = useMemo(() => {
    const start = (contactsPage - 1) * contactsLimit;
    return contacts.slice(start, start + contactsLimit);
  }, [contacts, contactsPage, contactsLimit]);

  const tabs = [
    { id: "queries", label: "Queries", count: total },
    { id: "contacts", label: "Contacts", count: contacts.length },
  ];

  const renderThreads = () => (
    <Card
      className={cn(
        "border shadow-sm",
        isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200",
      )}
    >
      <CardContent className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search email, username, message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("max-w-xs", isDark && "bg-[#06021D] border-slate-600")}
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="replied">Replied</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="User type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="creator">Creator</SelectItem>
              <SelectItem value="advertiser">Advertiser</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchThreads()}>
            Apply
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setConfirmDelete("bulk")}
          >
            Delete selected ({selected.size})
          </Button>
          <Button variant="outline" size="sm" onClick={previewRetention}>
            Delete older than {SUPPORT_RETENTION_DAYS} days
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-2 w-8" />
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">User Type</th>
                <th className="py-2 pr-4">Last message</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Username</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-500" />
                  </td>
                </tr>
              ) : threads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No threads found
                  </td>
                </tr>
              ) : (
                threads.map((t) => {
                  const u = resolveUser(t.users);
                  return (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 pr-2">
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleSelect(t.id)}
                        />
                      </td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(t.last_message_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{t.user_type || "-"}</td>
                      <td className="py-2 pr-4 max-w-[200px] truncate">
                        {t.last_message_preview || t.subject || "-"}
                      </td>
                      <td className="py-2 pr-4">{u?.email || "-"}</td>
                      <td className="py-2 pr-4">{u?.username || "-"}</td>
                      <td className="py-2 pr-4">{statusBadge(t.status, isDark)}</td>
                      <td className="py-2 pr-4">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View"
                            onClick={() => loadDetail(t.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reply"
                            onClick={() => loadDetail(t.id)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => {
                              setDetailId(t.id);
                              setConfirmDelete("single");
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <PaginationControls
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            hasNextPage={page < totalPages}
            hasPreviousPage={page > 1}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            isDark={isDark}
          />
        )}
      </CardContent>
    </Card>
  );

  const renderContacts = () => (
    <Card
      className={cn(
        "border shadow-sm",
        isDark ? "bg-[#06021D] border-slate-700" : "bg-white border-slate-200",
      )}
    >
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Message</th>
              </tr>
            </thead>
            <tbody>
              {paginatedContacts.length > 0 ? (
                paginatedContacts.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2 pr-4">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{c.name || "-"}</td>
                    <td className="py-2 pr-4">{c.email || "-"}</td>
                    <td className="py-2 pr-4">{c.phone || "-"}</td>
                    <td className="py-2 pr-4">{c.message || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No contacts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {contacts.length > 0 && (
          <div className="mt-6">
            <PaginationControls
              page={contactsPage}
              limit={contactsLimit}
              total={contacts.length}
              totalPages={Math.ceil(contacts.length / contactsLimit)}
              hasNextPage={
                contactsPage < Math.ceil(contacts.length / contactsLimit)
              }
              hasPreviousPage={contactsPage > 1}
              onPageChange={setContactsPage}
              onLimitChange={(l) => {
                setContactsLimit(l);
                setContactsPage(1);
              }}
              isDark={isDark}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <EnhancedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="w-full max-w-md"
        isDark={isDark}
      />
      <div className="mt-6">
        {activeTab === "queries" && renderThreads()}
        {activeTab === "contacts" && renderContacts()}
      </div>

      <Sheet open={!!detailId && !confirmDelete} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent
          side="right"
          className={cn(
            "w-full sm:max-w-lg flex flex-col",
            isDark && "bg-[#06021D] text-white border-slate-700",
          )}
        >
          <SheetHeader>
            <SheetTitle>Support thread</SheetTitle>
          </SheetHeader>
          {detailUser && (
            <div className="mt-4 space-y-2 text-sm border-b pb-4">
              <p>
                <span className="opacity-70">Email:</span> {detailUser.email}
              </p>
              <p>
                <span className="opacity-70">Username:</span>{" "}
                {detailUser.username || "—"}
              </p>
              <Link
                href={`/dashboard/admin/users`}
                className="text-purple-500 underline text-xs"
              >
                User Management
              </Link>
              <SupportChatToggle
                userId={detailUser.id}
                enabled={detailUser.support_chat_enabled !== false}
                isDark={isDark}
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-3 py-4 min-h-0">
            {detailMessages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  isSupportAdminMessage(m.sender_role)
                    ? "justify-end"
                    : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                    isSupportAdminMessage(m.sender_role)
                      ? "bg-purple-600 text-white"
                      : isDark
                        ? "bg-slate-800"
                        : "bg-gray-100",
                  )}
                >
                  <p className="text-[10px] font-medium opacity-80 mb-1 capitalize">
                    {formatSenderRoleLabel(m.sender_role)}
                  </p>
                  {m.body}
                  <p className="text-[10px] opacity-70 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-2">
            <textarea
              className={cn(
                "w-full border rounded px-3 py-2 text-sm h-24 resize-none",
                isDark && "bg-[#06021D] border-slate-600",
              )}
              placeholder="Type your reply..."
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={replying || !replyBody.trim()}
                onClick={handleReply}
              >
                {replying ? "Sending..." : "Send reply"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (detailId) {
                    fetch(`/api/admin/support/threads/${detailId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "closed" }),
                    }).then(() => {
                      toast({ title: "Thread closed" });
                      fetchThreads();
                    });
                  }
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className={isDark ? "bg-[#06021D] text-white" : ""}>
          <DialogHeader>
            <DialogTitle>Confirm delete</DialogTitle>
            <DialogDescription>
              {confirmDelete === "bulk" &&
                `Delete ${selected.size} selected thread(s)? This cannot be undone easily.`}
              {confirmDelete === "single" &&
                "Delete this thread and all messages?"}
              {confirmDelete === "retention" &&
                `Delete ${retentionCount} thread(s) older than ${SUPPORT_RETENTION_DAYS} days?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

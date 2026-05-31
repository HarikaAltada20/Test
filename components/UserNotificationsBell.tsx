"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  notification_type: string;
  title: string | null;
  message_resolved: string;
  is_read: boolean;
  created_at: string;
  support_thread_id: string | null;
};

type Props = {
  isDark?: boolean;
  /** Creator/brand: open ChatSupport thread */
  onOpenSupportThread?: (threadId: string) => void;
  /** Admin: navigate to support dashboard thread */
  onOpenAdminSupportThread?: (threadId: string) => void;
};

function isSupportNotificationType(type: string): boolean {
  return type === "support_reply" || type === "support_user_message";
}

function NotificationIcon({
  type,
  isDark,
}: {
  type: string;
  isDark: boolean;
}) {
  const isSupport = isSupportNotificationType(type);
  const Icon = isSupport ? MessageCircle : Megaphone;

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        isSupport
          ? isDark
            ? "bg-purple-500/20 text-purple-300"
            : "bg-purple-100 text-purple-600"
          : isDark
            ? "bg-slate-800 text-slate-300"
            : "bg-slate-100 text-slate-600",
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

function NotificationCard({
  notification: n,
  isDark,
  onClick,
}: {
  notification: NotificationRow;
  isDark: boolean;
  onClick: () => void;
}) {
  const isSupport = isSupportNotificationType(n.notification_type);
  const isAdminSupportMessage = n.notification_type === "support_user_message";
  const createdAt = new Date(n.created_at);
  const relativeTime = formatDistanceToNow(createdAt, { addSuffix: true });

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border p-4 text-left transition-all",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40",
        isDark
          ? "border-slate-700/80 bg-slate-900/40 hover:border-purple-500/30 hover:bg-slate-800/60"
          : "border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50/30",
        !n.is_read &&
          (isDark
            ? "border-purple-500/40 bg-purple-500/5"
            : "border-purple-200 bg-purple-50/50"),
      )}
    >
      <div className="flex gap-3">
        <NotificationIcon type={n.notification_type} isDark={isDark} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {n.title ||
                  (n.notification_type === "support_user_message"
                    ? "New support message"
                    : isSupport
                      ? "Support replied"
                      : "Notification")}
              </span>
              {!n.is_read && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-purple-600"
                  aria-label="Unread"
                />
              )}
            </div>
            <time
              dateTime={n.created_at}
              className={cn(
                "shrink-0 text-xs",
                isDark ? "text-slate-500" : "text-muted-foreground",
              )}
              title={createdAt.toLocaleString()}
            >
              {relativeTime}
            </time>
          </div>

          <div
            className={cn(
              "mt-2.5 rounded-lg px-3 py-2.5 text-sm leading-relaxed",
              isSupport
                ? isDark
                  ? "bg-slate-800/80 text-slate-200"
                  : "bg-slate-50 text-slate-700"
                : isDark
                  ? "bg-slate-800/60 text-slate-300"
                  : "bg-gray-50 text-gray-700",
            )}
          >
            <p className="line-clamp-4 whitespace-pre-wrap break-words">
              {n.message_resolved}
            </p>
          </div>

          {isSupport && n.support_thread_id && (
            <p
              className={cn(
                "mt-2.5 flex items-center gap-0.5 text-xs font-medium transition-colors",
                isDark
                  ? "text-purple-400 group-hover:text-purple-300"
                  : "text-purple-600 group-hover:text-purple-700",
              )}
            >
              {isAdminSupportMessage ? "Open in support" : "View conversation"}
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function UserNotificationsBell({
  isDark = false,
  onOpenSupportThread,
  onOpenAdminSupportThread,
}: Props) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30");
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const markRead = async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: ids }),
    });
    await fetchNotifications();
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      await markRead([n.id]);
    }
    if (!n.support_thread_id) return;

    if (n.notification_type === "support_user_message" && onOpenAdminSupportThread) {
      onOpenAdminSupportThread(n.support_thread_id);
      setOpen(false);
      return;
    }

    if (onOpenSupportThread) {
      onOpenSupportThread(n.support_thread_id);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 border border-gray-400"
        title="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className={cn(
            "w-full sm:max-w-lg flex flex-col p-0 gap-0",
            isDark && "bg-[#06021D] text-white border-slate-700",
          )}
        >
          <SheetHeader
            className={cn(
              "px-6 py-4 border-b shrink-0 space-y-0",
              isDark ? "border-slate-700" : "border-slate-200",
            )}
          >
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <p
                className={cn(
                  "text-xs mt-0.5",
                  isDark ? "text-slate-400" : "text-muted-foreground",
                )}
              >
                {unreadCount} unread
              </p>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-sm">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full",
                    isDark ? "bg-slate-800" : "bg-slate-100",
                  )}
                >
                  <Bell
                    className={cn(
                      "h-7 w-7",
                      isDark ? "text-slate-500" : "text-slate-400",
                    )}
                  />
                </div>
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p
                  className={cn(
                    "text-xs max-w-[220px]",
                    isDark ? "text-slate-500" : "text-muted-foreground",
                  )}
                >
                  New support replies and updates will show up here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3 p-4">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <NotificationCard
                      notification={n}
                      isDark={isDark}
                      onClick={() => handleClick(n)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

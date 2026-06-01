"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { getContestDashboardPath } from "@/lib/admin-notifications/template";
import {
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  Megaphone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  parseLegacySupportMessageResolved,
} from "@/lib/user-notifications/support-sender-display";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  notification_type: string;
  title: string | null;
  message_resolved: string;
  is_read: boolean;
  created_at: string;
  support_thread_id: string | null;
  contest_id: string | null;
  sender_display_name?: string | null;
  sender_avatar_url?: string | null;
  sender_role_label?: string | null;
};

function supportMessagePreview(message: string): string {
  const legacy = parseLegacySupportMessageResolved(message);
  return legacy.displayName ? legacy.preview : message;
}

function getSupportUserMessageDisplay(n: NotificationRow) {
  if (n.sender_display_name) {
    return {
      displayName: n.sender_display_name,
      roleLabel: n.sender_role_label ?? null,
      preview: supportMessagePreview(n.message_resolved),
      avatarUrl: n.sender_avatar_url ?? null,
    };
  }
  const legacy = parseLegacySupportMessageResolved(n.message_resolved);
  const title =
    n.title === "New support message" ? null : n.title;
  return {
    displayName: legacy.displayName || title || "User",
    roleLabel: legacy.roleLabel,
    preview: legacy.preview,
    avatarUrl: null,
  };
}

type Props = {
  isDark?: boolean;
  userType?: string;
  /** Creator/brand: open ChatSupport thread */
  onOpenSupportThread?: (threadId: string) => void;
  /** Admin: navigate to support dashboard thread */
  onOpenAdminSupportThread?: (threadId: string) => void;
};

function isSupportNotificationType(type: string): boolean {
  return type === "support_reply" || type === "support_user_message";
}

function isPublicAnnouncement(type: string): boolean {
  return type === "public";
}

function notificationTitle(n: NotificationRow): string {
  if (n.notification_type === "support_user_message") {
    return getSupportUserMessageDisplay(n).displayName;
  }
  if (n.notification_type === "support_reply") {
    return "Message from the support team";
  }
  if (n.title) return n.title;
  if (isPublicAnnouncement(n.notification_type)) return "Announcement";
  return "Notification";
}

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const letter = trimmed.match(/[A-Za-z0-9]/)?.[0];
  return (letter ?? trimmed[0]).toUpperCase();
}

function NotificationLead({
  notification: n,
  isDark,
}: {
  notification: NotificationRow;
  isDark: boolean;
}) {
  if (n.notification_type === "support_user_message") {
    const { displayName, avatarUrl } = getSupportUserMessageDisplay(n);
    return (
      <Avatar className="h-10 w-10 shrink-0">
        {avatarUrl ? (
          <AvatarImage
            src={avatarUrl}
            alt={displayName}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <AvatarFallback
          className={cn(
            "text-sm font-semibold",
            isDark
              ? "bg-purple-500/20 text-purple-200"
              : "bg-purple-100 text-purple-700",
          )}
        >
          {avatarInitial(displayName)}
        </AvatarFallback>
      </Avatar>
    );
  }

  return <NotificationIcon type={n.notification_type} isDark={isDark} />;
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
  const supportDisplay = isAdminSupportMessage
    ? getSupportUserMessageDisplay(n)
    : null;
  const bodyText = supportDisplay?.preview ?? n.message_resolved;
  const hasContestLink =
    isPublicAnnouncement(n.notification_type) && !!n.contest_id;
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
        <NotificationLead notification={n} isDark={isDark} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">
                  {notificationTitle(n)}
                </span>
                {!n.is_read && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-purple-600"
                    aria-label="Unread"
                  />
                )}
              </div>
              {supportDisplay?.roleLabel && (
                <p
                  className={cn(
                    "mt-0.5 truncate text-xs",
                    isDark ? "text-slate-500" : "text-muted-foreground",
                  )}
                >
                  {supportDisplay.roleLabel}
                </p>
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
              {bodyText}
            </p>
          </div>

          {hasContestLink && (
            <p
              className={cn(
                "mt-2.5 flex items-center gap-0.5 text-xs font-medium transition-colors",
                isDark
                  ? "text-purple-400 group-hover:text-purple-300"
                  : "text-purple-600 group-hover:text-purple-700",
              )}
            >
              View contest
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </p>
          )}
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
  userType = "creator",
  onOpenSupportThread,
  onOpenAdminSupportThread,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailNotification, setDetailNotification] =
    useState<NotificationRow | null>(null);

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

  const markThreadRead = async (threadId: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ support_thread_id: threadId }),
    });
    await fetchNotifications();
  };

  const handleClick = async (n: NotificationRow) => {
    if (!n.is_read) {
      if (
        n.notification_type === "support_user_message" &&
        n.support_thread_id
      ) {
        await markThreadRead(n.support_thread_id);
      } else {
        await markRead([n.id]);
      }
    }

    if (isPublicAnnouncement(n.notification_type)) {
      if (n.contest_id) {
        setOpen(false);
        router.push(getContestDashboardPath(n.contest_id, userType));
        return;
      }
      setDetailNotification(n);
      return;
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
            <SheetTitle className="pr-8">Notifications</SheetTitle>
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
                  Announcements, support replies, and platform updates will
                  appear here.
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

      <Dialog
        open={!!detailNotification}
        onOpenChange={(o) => !o && setDetailNotification(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {detailNotification
                ? notificationTitle(detailNotification)
                : "Announcement"}
            </DialogTitle>
          </DialogHeader>
          {detailNotification && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {new Date(detailNotification.created_at).toLocaleString()}
              </p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {detailNotification.message_resolved}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {detailNotification?.contest_id && (
              <Button
                onClick={() => {
                  const contestId = detailNotification.contest_id!;
                  setDetailNotification(null);
                  setOpen(false);
                  router.push(getContestDashboardPath(contestId, userType));
                }}
              >
                View contest
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDetailNotification(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

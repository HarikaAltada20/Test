"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  onOpenSupportThread?: (threadId: string) => void;
};

export function UserNotificationsBell({
  isDark = false,
  onOpenSupportThread,
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
    if (n.support_thread_id && onOpenSupportThread) {
      onOpenSupportThread(n.support_thread_id);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 border border-gray-400"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          "w-80 max-h-96 overflow-y-auto p-0",
          isDark ? "bg-[#06021D] border-slate-700 text-white" : "bg-white",
        )}
      >
        <div
          className={cn(
            "border-b px-4 py-3 font-semibold text-sm",
            isDark ? "border-slate-700" : "border-slate-200",
          )}
        >
          Notifications
        </div>
        {loading && notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No notifications</p>
        ) : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b transition hover:bg-purple-50/10",
                    isDark ? "border-slate-800" : "border-slate-100",
                    !n.is_read && "bg-purple-500/5",
                  )}
                >
                  <p className="text-sm font-medium">
                    {n.title || "Notification"}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-1 line-clamp-2",
                      isDark ? "text-slate-400" : "text-muted-foreground",
                    )}
                  >
                    {n.message_resolved}
                  </p>
                  <p className="text-[10px] mt-1 opacity-60">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

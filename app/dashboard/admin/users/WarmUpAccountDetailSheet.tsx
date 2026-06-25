"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  WarmUpDailyChartPoint,
  WarmUpWeeklySummary,
} from "@/lib/admin-email/warm-up-service";
import type {
  WarmUpAccountListItem,
  WarmUpAccountRow,
} from "@/lib/admin-email/warm-up";
import {
  Archive,
  Eye,
  Loader2,
  Send,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type WarmUpSidebarDetails = {
  account: WarmUpAccountRow;
  weeklySummary: WarmUpWeeklySummary;
  weeklyChart: WarmUpDailyChartPoint[];
  warmUpProgress: { current: number; total: number };
};

type Props = {
  accountId: string | null;
  accountPreview: WarmUpAccountListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
  isDark?: boolean;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildDefaultWeeklyChart(): WarmUpDailyChartPoint[] {
  const days: WarmUpDailyChartPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: DAY_LABELS[d.getDay()] ?? "",
      count: 0,
    });
  }
  return days;
}

function buildPreviewDetails(
  account: WarmUpAccountListItem,
): WarmUpSidebarDetails {
  return {
    account,
    weeklySummary: {
      emailsReceived: 0,
      emailsSent: 0,
      replyRate: 0,
      openRate: 0,
    },
    weeklyChart: buildDefaultWeeklyChart(),
    warmUpProgress: {
      current: account.emails_sent_today,
      total: account.daily_limit,
    },
  };
}

function SummaryStat({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
            iconBg,
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyBarChart({ data }: { data: WarmUpDailyChartPoint[] }) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const totalSent = data.reduce((sum, point) => sum + point.count, 0);
  const isEmpty = totalSent === 0;
  const max = Math.max(...data.map((point) => point.count), 1);
  const hoveredPoint = data.find((point) => point.date === hoveredDate);

  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-2 sm:gap-3 h-44">
        {data.map((point) => {
          const isHovered = hoveredDate === point.date;
          const barHeight = isEmpty
            ? "68%"
            : point.count > 0
              ? `${Math.max((point.count / max) * 100, 14)}%`
              : "12%";

          return (
            <div
              key={point.date}
              className="relative flex flex-1 flex-col items-center gap-3 min-w-0 h-full"
              onMouseEnter={() => setHoveredDate(point.date)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              {isHovered && (
                <div className="absolute bottom-[calc(100%-0.25rem)] left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md">
                  {point.count} email{point.count !== 1 ? "s" : ""} sent
                  <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              )}
              <div className="flex flex-1 w-full items-end justify-center px-0.5">
                <div
                  className={cn(
                    "w-full max-w-[46px] rounded-t-[10px] cursor-pointer transition-all",
                    isEmpty || point.count === 0
                      ? "bg-[#DDD6FE]"
                      : "bg-[#8B5CF6]",
                    isHovered &&
                      (isEmpty || point.count === 0
                        ? "bg-[#C4B5FD]"
                        : "bg-[#7C3AED]"),
                  )}
                  style={{ height: barHeight }}
                />
              </div>
              <span
                className={cn(
                  "text-xs shrink-0 transition-colors",
                  isHovered ? "text-gray-700 font-medium" : "text-gray-400",
                )}
              >
                {point.label}
              </span>
            </div>
          );
        })}
      </div>
      {hoveredPoint && (
        <p className="sr-only">
          {hoveredPoint.label}: {hoveredPoint.count} emails sent
        </p>
      )}
    </div>
  );
}

export function WarmUpAccountDetailSheet({
  accountId,
  accountPreview,
  open,
  onOpenChange,
  onUpdated,
  isDark,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<WarmUpSidebarDetails | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (!open || !accountPreview) {
      setDetails(null);
      return;
    }

    const preview = buildPreviewDetails(accountPreview);
    setDetails(preview);
    setFirstName(accountPreview.first_name ?? "");
    setLastName(accountPreview.last_name ?? "");

    if (!accountId) return;

    let cancelled = false;

    const loadDetails = () => {
      fetch(`/api/admin/warm-up/emails/${accountId}/sidebar-details`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error) return;
          setDetails(data as WarmUpSidebarDetails);
          setFirstName(data.account?.first_name ?? "");
          setLastName(data.account?.last_name ?? "");
        })
        .catch(() => {
          // Keep showing preview data on background refresh failures.
        });
    };

    loadDetails();
    const timer = window.setInterval(loadDetails, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accountId, accountPreview, open]);

  const startedLabel = useMemo(() => {
    const startDate = details?.account.start_date;
    if (!startDate) return null;
    const date = new Date(startDate);
    return `Started on ${format(date, "MMM d, yyyy")} | ${formatDistanceToNow(date)} ago`;
  }, [details?.account.start_date]);

  const profileDirty =
    details &&
    (firstName !== (details.account.first_name ?? "") ||
      lastName !== (details.account.last_name ?? ""));

  const handleUpdateProfile = async () => {
    if (!accountId || !profileDirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/warm-up/emails/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Update failed",
          description: data.error || "Could not update profile",
          variant: "destructive",
        });
        return;
      }
      setDetails((prev) =>
        prev
          ? {
              ...prev,
              account: { ...prev.account, ...data.account },
            }
          : prev,
      );
      toast({ title: "Profile updated" });
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  const progressPercent = details
    ? details.warmUpProgress.total > 0
      ? (details.warmUpProgress.current / details.warmUpProgress.total) * 100
      : 0
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-xl overflow-y-auto",
          isDark ? "bg-[#170337] text-white border-purple-900/40" : "bg-white",
        )}
      >
        {details ? (
          <div className="space-y-6 pr-6">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle
                className={cn(
                  "text-xl font-bold break-all",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                {details.account.email}
              </SheetTitle>
              {startedLabel && (
                <p className="text-sm text-muted-foreground">{startedLabel}</p>
              )}
            </SheetHeader>

            <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-gray-900">Profile</p>
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!profileDirty || saving}
                    onClick={handleUpdateProfile}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Update"
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wu-first-name">First name</Label>
                    <Input
                      id="wu-first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wu-last-name">Last name</Label>
                    <Input
                      id="wu-last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <p className="font-semibold text-gray-900 mb-3">
                Summary for past week
              </p>
              <div className="grid grid-cols-2 gap-3">
                <SummaryStat
                  label="warmup emails received"
                  value={details.weeklySummary.emailsReceived}
                  icon={<Archive className="h-5 w-5 text-blue-600" />}
                  iconBg="bg-blue-100"
                />
                <SummaryStat
                  label="warmup emails sent"
                  value={details.weeklySummary.emailsSent}
                  icon={<Send className="h-5 w-5 text-purple-600" />}
                  iconBg="bg-purple-100"
                />
                <SummaryStat
                  label="Reply Rate"
                  value={`${details.weeklySummary.replyRate}%`}
                  icon={<TrendingUp className="h-5 w-5 text-green-600" />}
                  iconBg="bg-green-100"
                />
                <SummaryStat
                  label="Open Rate"
                  value={`${details.weeklySummary.openRate}%`}
                  icon={<Eye className="h-5 w-5 text-orange-500" />}
                  iconBg="bg-orange-100"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-gray-900">Warm-Up Progress</p>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {details.warmUpProgress.current}/{details.warmUpProgress.total}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="font-semibold text-gray-900 mb-4">
                  Warmup Emails Sent
                </p>
                <WeeklyBarChart data={details.weeklyChart} />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

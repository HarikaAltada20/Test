"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eye, MessageCircle, MousePointerClick, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Detail = {
  status: string;
  progressPercent: number;
  startedAt: string | null;
  recipientCount: number;
  remainingCount: number;
  estimatedCompletionAt: string | null;
  summary: {
    openRate: number;
    openCount: number;
    clickRate: number;
    clickCount: number;
  };
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            {sub && (
              <p className="text-sm text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              iconBg,
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsTab({ detail }: { detail: Detail }) {
  const paused = detail.status === "paused";
  const active = detail.status === "active";

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Status</p>
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 capitalize">
                {detail.status}
              </Badge>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {detail.progressPercent.toFixed(0)}%
                </span>
              </div>
              <Progress value={detail.progressPercent} className="h-2" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t text-sm">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium mt-1">{formatDate(detail.startedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Paused</p>
              <p className="font-medium mt-1">{paused ? "Yes" : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className="font-medium mt-1">{detail.remainingCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Est. Completion</p>
              <p className="font-medium mt-1">
                {formatDate(detail.estimatedCompletionAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {active && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-800">
          Email sending in progress.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Sequence Started"
          value={String(detail.recipientCount)}
          icon={<Send className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-100"
        />
        <MetricCard
          label="Open Rate"
          value={`${(detail.summary.openRate * 100).toFixed(1)}% | ${detail.summary.openCount}`}
          icon={<Eye className="h-5 w-5 text-orange-500" />}
          iconBg="bg-orange-100"
        />
        <MetricCard
          label="Click Rate"
          value={`${(detail.summary.clickRate * 100).toFixed(1)}% | ${detail.summary.clickCount}`}
          icon={<MousePointerClick className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-100"
        />
        <MetricCard
          label="Reply"
          value="0.0% | 0"
          icon={<MessageCircle className="h-5 w-5 text-blue-600" />}
          iconBg="bg-blue-100"
        />
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm min-h-[200px]">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Campaign Performance</h3>
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No performance data yet
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

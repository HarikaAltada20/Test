"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Eye, Loader2, MessageCircle, MousePointerClick, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Detail = {
  status: string;
  progressPercent: number;
  startedAt: string | null;
  recipientCount: number;
  sentCount: number;
  remainingCount: number;
  estimatedCompletionAt: string | null;
  summary: {
    openRate: number;
    openCount: number;
    clickRate: number;
    clickCount: number;
    bounceRate?: number;
    bounceCount?: number;
  };
};

type VariantAnalyticsRow = {
  variantId: string;
  label: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
};

type StepAnalyticsRow = {
  stepNumber: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  replied: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  variants: VariantAnalyticsRow[];
};

type Props = {
  campaignId: string;
  detail: Detail;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function RateCell({
  value,
  tone = "green",
}: {
  value: number;
  tone?: "green" | "blue" | "muted";
}) {
  return (
    <span
      className={cn(
        "font-medium",
        tone === "green" && "text-green-600",
        tone === "blue" && "text-blue-600",
        tone === "muted" && "text-muted-foreground",
      )}
    >
      {formatRate(value)}
    </span>
  );
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

function AnalyticsTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            {columns.map((col) => (
              <th key={col} className="p-3 text-left font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

const STEP_COLUMNS = [
  "Step",
  "Sent",
  "Opened",
  "Open Rate",
  "Clicked",
  "Click Rate",
  "Bounced",
  "Replies",
  "Reply Rate",
];

const VARIANT_COLUMNS = [
  "Variant",
  "Sent",
  "Opened",
  "Open Rate",
  "Clicked",
  "Click Rate",
  "Replied",
  "Reply Rate",
];

export function AnalyticsTab({ campaignId, detail }: Props) {
  const paused = detail.status === "paused";
  const active = detail.status === "active";
  const [stepAnalytics, setStepAnalytics] = useState<StepAnalyticsRow[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingSteps(true);
    fetch(`/api/admin/email-campaigns/${campaignId}/analytics`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setStepAnalytics(data.stepAnalytics ?? []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSteps(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const hasStepData = stepAnalytics.some((s) => s.sent > 0);

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

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Step-wise Analytics</h3>

          {loadingSteps ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 w-full rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : !hasStepData ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No performance data yet
            </div>
          ) : (
            <div className="space-y-4">
              <AnalyticsTable columns={STEP_COLUMNS}>
                {stepAnalytics.map((step) => (
                  <tr key={step.stepNumber} className="border-b last:border-0">
                    <td className="p-3 font-medium">Step {step.stepNumber}</td>
                    <td className="p-3">{step.sent}</td>
                    <td className="p-3">{step.opened}</td>
                    <td className="p-3">
                      <RateCell value={step.openRate} tone="green" />
                    </td>
                    <td className="p-3">{step.clicked}</td>
                    <td className="p-3">
                      <RateCell value={step.clickRate} tone="blue" />
                    </td>
                    <td className="p-3">{step.bounced}</td>
                    <td className="p-3">{step.replied}</td>
                    <td className="p-3">
                      <RateCell value={step.replyRate} tone="muted" />
                    </td>
                  </tr>
                ))}
              </AnalyticsTable>

              {stepAnalytics.map((step) =>
                step.variants.length > 0 ? (
                  <div
                    key={`variants-${step.stepNumber}`}
                    className="rounded-lg border border-gray-100 bg-gray-50/60 p-4"
                  >
                    <p className="text-sm font-medium text-gray-700 mb-3">
                      Variant Analysis
                    </p>
                    <AnalyticsTable columns={VARIANT_COLUMNS}>
                      {step.variants.map((variant) => (
                        <tr
                          key={variant.variantId}
                          className="border-b last:border-0 bg-white"
                        >
                          <td className="p-3 font-medium">{variant.label}</td>
                          <td className="p-3">{variant.sent}</td>
                          <td className="p-3">{variant.opened}</td>
                          <td className="p-3">
                            <RateCell value={variant.openRate} tone="green" />
                          </td>
                          <td className="p-3">{variant.clicked}</td>
                          <td className="p-3">
                            <RateCell value={variant.clickRate} tone="blue" />
                          </td>
                          <td className="p-3">{variant.replied}</td>
                          <td className="p-3">
                            <RateCell value={variant.replyRate} tone="muted" />
                          </td>
                        </tr>
                      ))}
                    </AnalyticsTable>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

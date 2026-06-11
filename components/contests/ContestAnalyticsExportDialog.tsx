"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { cn } from "@/lib/utils";
import {
  CONTEST_ANALYTICS_TAB_IDS,
  contestAnalyticsTabLabel,
  downloadContestAnalyticsReport,
  type ContestAnalyticsTabId,
} from "@/lib/contest-analytics-export";
import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import type { LeaderboardExportFormat } from "@/lib/submission-leaderboard-export";
import { toast } from "sonner";
import type { BrandProfile, ReportSubmissionFilter } from "@/lib/report-export-branding";
import {
  buildReportExportBundle,
  type ReportExportContestContext,
} from "@/lib/report-export-context";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import { maybeWarnLargePdfExport } from "@/lib/report-export-guards";

const FORMAT_LABELS: Record<LeaderboardExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  pdf: "PDF (.pdf)",
};

export type ContestAnalyticsExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestTitle: string;
  tabCounts: Record<ContestAnalyticsTabId, number>;
  getSnapshotsForTabs: (
    tabs: ContestAnalyticsTabId[],
  ) => ContestAnalyticsTabSnapshot[];
  isDark?: boolean;
  brandProfile?: BrandProfile | null;
  reportContest?: ReportExportContestContext;
  reportAllSubmissions?: ContestAnalyticsExportSubmission[];
  reportSubmissions?: ContestAnalyticsExportSubmission[];
  getReportStatus?: (
    submission: ContestAnalyticsExportSubmission,
  ) => string;
  getReportExpectedCents?: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
  /** Dashboard tab selected when opening the dialog; pre-selected for export. */
  activeTab?: ContestAnalyticsTabId;
};

export function ContestAnalyticsExportDialog({
  open,
  onOpenChange,
  contestTitle,
  tabCounts,
  getSnapshotsForTabs,
  isDark = false,
  brandProfile,
  reportContest,
  reportAllSubmissions,
  reportSubmissions,
  getReportStatus,
  getReportExpectedCents,
  activeTab = "all",
}: ContestAnalyticsExportDialogProps) {
  const [selectedTab, setSelectedTab] = useState<ContestAnalyticsTabId | null>(
    null,
  );
  const [format, setFormat] = useState<LeaderboardExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedTab(activeTab);
    setFormat("xlsx");
  }, [open, activeTab]);

  const handleExport = async () => {
    if (!selectedTab) {
      toast.error("Select a tab to export");
      return;
    }

    maybeWarnLargePdfExport(
      (reportAllSubmissions ?? reportSubmissions)?.length ?? 0,
      format,
    );

    setExporting(true);
    try {
      const tabLabel = contestAnalyticsTabLabel(selectedTab);
      const snapshots = getSnapshotsForTabs([selectedTab]);

      let exportOptions: Parameters<typeof downloadContestAnalyticsReport>[3];

      const useBrandedCover =
        reportContest &&
        (reportAllSubmissions ?? reportSubmissions) &&
        getReportStatus &&
        getReportExpectedCents;

      if (useBrandedCover) {
        const coverFilter = selectedTab as ReportSubmissionFilter;
        const bundle = buildReportExportBundle({
          brandProfile,
          contest: reportContest,
          reportType: "analytics",
          submissions: reportAllSubmissions ?? reportSubmissions ?? [],
          getStatus: getReportStatus,
          getSubmissionExpectedCents: getReportExpectedCents,
          analyticsTabs: [tabLabel],
          submissionFilter: coverFilter,
          filtersApplied: tabLabel,
          exportedAt: new Date(),
        });
        exportOptions = {
          branding: bundle.branding,
          metrics: bundle.metrics,
          approvedCount: bundle.approvedCount,
          submissionFilter: coverFilter,
        };
      }

      await downloadContestAnalyticsReport(
        format,
        contestTitle,
        snapshots,
        exportOptions,
      );
      toast.success(`Analytics report downloaded (${tabLabel})`);
      onOpenChange(false);
    } catch (err) {
      console.error("[ContestAnalyticsExport]", err);
      toast.error("Failed to download analytics report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent
        className={cn(
          "sm:max-w-lg max-h-[90vh] overflow-y-auto",
          isDark
            ? "border-gray-600 bg-[#06021D] text-slate-100"
            : "border-slate-200 bg-white text-slate-900",
        )}
      >
        <DialogHeader>
          <DialogTitle
            className={cn(
              "text-lg font-semibold",
              isDark ? "text-white" : "text-slate-900",
            )}
          >
            Download analytics report
          </DialogTitle>
          <DialogDescription
            className={cn(
              "text-sm leading-relaxed",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            Exports the dashboard metrics for one tab (overview, Twitter
            campaign metrics, points statistics when applicable, views
            statistics, ROI analysis, performance summary, and top 10 views
            distribution) with a branded cover summary. Export again to download
            a different tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div
            className={cn(
              "rounded-lg border p-3",
              isDark
                ? "border-gray-600 bg-[#170337]/60"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <Label
              className={cn(
                "text-sm font-medium mb-3 block",
                isDark ? "text-slate-100" : "text-slate-800",
              )}
            >
              Analytics tab
            </Label>
            <RadioGroup
              value={selectedTab ?? undefined}
              onValueChange={(value) =>
                setSelectedTab(value as ContestAnalyticsTabId)
              }
              className="space-y-1 max-h-48 overflow-y-auto pr-1"
            >
              {CONTEST_ANALYTICS_TAB_IDS.map((tab) => {
                const count = tabCounts[tab] ?? 0;
                const id = `analytics-export-tab-${tab}`;
                return (
                  <div
                    key={tab}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-2 py-1.5",
                      isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
                    )}
                  >
                    <RadioGroupItem
                      id={id}
                      value={tab}
                      className={cn(
                        isDark && "border-gray-500 text-[#4A00BE]",
                      )}
                    />
                    <Label
                      htmlFor={id}
                      className={cn(
                        "flex-1 text-sm font-medium cursor-pointer flex items-center justify-between gap-2",
                        isDark ? "text-slate-200" : "text-slate-800",
                      )}
                    >
                      <span>{contestAnalyticsTabLabel(tab)}</span>
                      <span
                        className={cn(
                          "text-xs font-normal tabular-nums",
                          isDark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        ({count})
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div
            className={cn(
              "rounded-lg border p-3",
              isDark
                ? "border-gray-600 bg-[#170337]/60"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <Label
              className={cn(
                "text-sm font-medium mb-2 block",
                isDark ? "text-slate-100" : "text-slate-800",
              )}
            >
              File format
            </Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as LeaderboardExportFormat)}
            >
              <SelectTrigger
                isDark={isDark}
                className={cn(
                  "h-10 text-sm font-medium",
                  isDark
                    ? "border-gray-500 bg-[#07031D] text-white"
                    : "border-slate-300 bg-white text-slate-900",
                )}
              >
                <SelectValue placeholder="Choose format">
                  {FORMAT_LABELS[format]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="xlsx" isDark={isDark}>
                  <span className="inline-flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    Excel (.xlsx)
                  </span>
                </SelectItem>
                <SelectItem value="csv" isDark={isDark}>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    CSV (.csv)
                  </span>
                </SelectItem>
                <SelectItem value="pdf" isDark={isDark}>
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    PDF (.pdf)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
            className={cn(
              isDark
                ? "border-gray-600 text-slate-300 hover:bg-slate-800"
                : "",
            )}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting || !selectedTab}
            className="gap-2 bg-[#4A00BE] hover:bg-[#4A00BE]/90 text-white"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

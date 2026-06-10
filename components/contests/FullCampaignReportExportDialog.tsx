"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  getSubmissionExportColumns,
  type SubmissionExportColumnId,
} from "@/lib/submission-leaderboard-export-columns";
import {
  getCreatorExportColumns,
  type CreatorExportColumnId,
} from "@/lib/creator-leaderboard-export-columns";
import {
  buildLeaderboardExportMatrix,
  type LeaderboardExportFormat,
  type PlatformMetrics,
  type RewardExportContext,
} from "@/lib/submission-leaderboard-export";
import {
  buildCreatorLeaderboardExportMatrix,
  type CreatorExportContext,
} from "@/lib/creator-leaderboard-export";
import { downloadFullCampaignReport } from "@/lib/report-full-export";
import {
  buildReportExportBundle,
  filterSubmissionsForReportExport,
  type ReportExportContestContext,
} from "@/lib/report-export-context";
import { scopeCreatorGroupsForReportExport } from "@/lib/report-export-creator-scope";
import type {
  BrandProfile,
  ReportSubmissionFilter,
} from "@/lib/report-export-branding";
import { DEFAULT_REPORT_SUBMISSION_FILTER, formatSubmissionDataScopeLabel } from "@/lib/report-export-branding";
import type { ContestAnalyticsTabSnapshot, ContestAnalyticsSnapshotContext } from "@/lib/contest-analytics-snapshot";
import { buildContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import { toast } from "sonner";
import {
  DEFAULT_REPORT_EXPORT_SORT,
  getReportExportSortDividerLine,
  getReportExportSortLabel,
  getReportExportSortOptions,
  sortCreatorGroupsForExport,
  sortSubmissionsForExport,
  type ReportExportSortOption,
} from "@/lib/report-export-sort";

const FORMAT_LABELS: Record<LeaderboardExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  pdf: "PDF (.pdf)",
};

const SUBMISSION_FILTER_OPTIONS: ReportSubmissionFilter[] = [
  "verified_or_paid",
  "all",
  "verified",
  "paid",
];

const SUBMISSION_FILTER_LABELS: Record<ReportSubmissionFilter, string> = {
  all: "All submissions",
  verified: "Verified only",
  paid: "Paid only",
  verified_or_paid: "Verified + Paid",
  pending: "Pending only",
  rejected: "Rejected only",
  not_rejected: "Not rejected",
};

const CREATOR_NAME_COLUMN_ID = "creator_name";

function omitCreatorNameForSpreadsheetFormats(
  columns: { id: string; label: string }[],
  format: LeaderboardExportFormat,
) {
  if (format === "csv") return columns;
  return columns.filter((c) => c.id !== CREATOR_NAME_COLUMN_ID);
}

export type FullCampaignReportExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark?: boolean;
  contestTitle: string;
  submissionCount: number;
  creatorCount: number;
  submissions: Record<string, unknown>[];
  creatorGroups: Record<string, unknown>[];
  getMetrics: (submission: Record<string, unknown>) => PlatformMetrics;
  rewardContext: RewardExportContext;
  creatorExportContext: CreatorExportContext;
  submissionColumnOptions: Parameters<typeof getSubmissionExportColumns>[0];
  creatorColumnOptions: Parameters<typeof getCreatorExportColumns>[0];
  submissionDefaultColumnIds: string[];
  creatorDefaultColumnIds: string[];
  analyticsSnapshot: ContestAnalyticsTabSnapshot;
  analyticsSnapshotContext: ContestAnalyticsSnapshotContext;
  brandProfile?: BrandProfile | null;
  reportContest: ReportExportContestContext;
  reportAllSubmissions: ContestAnalyticsExportSubmission[];
  reportApprovedCount: number;
  getReportStatus: (submission: ContestAnalyticsExportSubmission) => string;
  getReportExpectedCents: (
    submission: ContestAnalyticsExportSubmission,
  ) => number;
  isTwitterTextImage?: boolean;
};

export function FullCampaignReportExportDialog({
  open,
  onOpenChange,
  isDark = false,
  contestTitle,
  submissions,
  creatorGroups,
  getMetrics,
  rewardContext,
  creatorExportContext,
  submissionColumnOptions,
  creatorColumnOptions,
  submissionDefaultColumnIds,
  creatorDefaultColumnIds,
  analyticsSnapshot,
  analyticsSnapshotContext,
  brandProfile,
  reportContest,
  reportAllSubmissions,
  reportApprovedCount,
  getReportStatus,
  getReportExpectedCents,
  isTwitterTextImage = false,
}: FullCampaignReportExportDialogProps) {
  const [format, setFormat] = useState<LeaderboardExportFormat>("xlsx");
  const [submissionFilter, setSubmissionFilter] =
    useState<ReportSubmissionFilter>(DEFAULT_REPORT_SUBMISSION_FILTER);
  const [sortOption, setSortOption] = useState<ReportExportSortOption>(
    DEFAULT_REPORT_EXPORT_SORT,
  );
  const [exporting, setExporting] = useState(false);
  const [submissionSelected, setSubmissionSelected] = useState<
    Record<string, boolean>
  >({});
  const [creatorSelected, setCreatorSelected] = useState<
    Record<string, boolean>
  >({});

  const submissionColumns = useMemo(
    () => getSubmissionExportColumns(submissionColumnOptions),
    [submissionColumnOptions],
  );
  const creatorColumns = useMemo(
    () => getCreatorExportColumns(creatorColumnOptions),
    [creatorColumnOptions],
  );

  const selectableSubmissionColumns = useMemo(
    () => omitCreatorNameForSpreadsheetFormats(submissionColumns, format),
    [submissionColumns, format],
  );
  const selectableCreatorColumns = useMemo(
    () => omitCreatorNameForSpreadsheetFormats(creatorColumns, format),
    [creatorColumns, format],
  );

  useEffect(() => {
    if (!open) return;
    setFormat("xlsx");
    setSubmissionFilter(DEFAULT_REPORT_SUBMISSION_FILTER);
    setSortOption(DEFAULT_REPORT_EXPORT_SORT);
  }, [open]);

  const sortOptions = useMemo(
    () => getReportExportSortOptions(isTwitterTextImage),
    [isTwitterTextImage],
  );

  const sortLabel = useMemo(
    () => getReportExportSortLabel(sortOption),
    [sortOption],
  );

  const scopedSubmissions = useMemo(
    () =>
      filterSubmissionsForReportExport(
        reportAllSubmissions,
        submissionFilter,
        getReportStatus,
      ),
    [reportAllSubmissions, submissionFilter, getReportStatus],
  );

  const scopedCreatorGroups = useMemo(() => {
    return scopeCreatorGroupsForReportExport(
      creatorGroups,
      scopedSubmissions as unknown as Record<string, unknown>[],
      {
        getStatus: (submission) =>
          getReportStatus(
            submission as unknown as ContestAnalyticsExportSubmission,
          ),
        getMetrics,
        getExpectedCents: (submission) =>
          getReportExpectedCents(
            submission as unknown as ContestAnalyticsExportSubmission,
          ),
      },
    );
  }, [
    creatorGroups,
    scopedSubmissions,
    getReportStatus,
    getMetrics,
    getReportExpectedCents,
  ]);

  const scopedAnalyticsSnapshot = useMemo(
    () =>
      buildContestAnalyticsTabSnapshot(
        submissionFilter,
        analyticsSnapshotContext,
      ),
    [submissionFilter, analyticsSnapshotContext],
  );

  useEffect(() => {
    if (!open) return;
    const subSel: Record<string, boolean> = {};
    const allowedSub = new Set(
      selectableSubmissionColumns.map((c) => c.id as string),
    );
    const subDefaults =
      submissionDefaultColumnIds.filter((id) => allowedSub.has(id)).length > 0
        ? submissionDefaultColumnIds.filter((id) => allowedSub.has(id))
        : selectableSubmissionColumns.map((c) => c.id as string);
    for (const id of subDefaults) subSel[id] = true;
    setSubmissionSelected(subSel);

    const crSel: Record<string, boolean> = {};
    const allowedCr = new Set(
      selectableCreatorColumns.map((c) => c.id as string),
    );
    const crDefaults =
      creatorDefaultColumnIds.filter((id) => allowedCr.has(id)).length > 0
        ? creatorDefaultColumnIds.filter((id) => allowedCr.has(id))
        : selectableCreatorColumns.map((c) => c.id as string);
    for (const id of crDefaults) crSel[id] = true;
    setCreatorSelected(crSel);
  }, [
    open,
    format,
    selectableSubmissionColumns,
    selectableCreatorColumns,
    submissionDefaultColumnIds,
    creatorDefaultColumnIds,
  ]);

  const submissionColumnIds = useMemo(
    () =>
      selectableSubmissionColumns
        .filter((c) => submissionSelected[c.id as string])
        .map((c) => c.id as SubmissionExportColumnId),
    [selectableSubmissionColumns, submissionSelected],
  );

  const creatorColumnIds = useMemo(
    () =>
      selectableCreatorColumns
        .filter((c) => creatorSelected[c.id as string])
        .map((c) => c.id as CreatorExportColumnId),
    [selectableCreatorColumns, creatorSelected],
  );

  const toggleSubmission = (id: string, checked: boolean) => {
    setSubmissionSelected((prev) => ({ ...prev, [id]: checked }));
  };

  const toggleCreator = (id: string, checked: boolean) => {
    setCreatorSelected((prev) => ({ ...prev, [id]: checked }));
  };

  const handleExport = async () => {
    if (submissionColumnIds.length === 0 || creatorColumnIds.length === 0) {
      toast.error("Select at least one column for each section");
      return;
    }

    setExporting(true);
    try {
      const sortedSubmissions = sortSubmissionsForExport(
        scopedSubmissions as unknown as Record<string, unknown>[],
        sortOption,
        { isTwitterTextImage, getMetrics },
      );
      const sortedCreatorGroups = sortCreatorGroupsForExport(
        scopedCreatorGroups as Record<string, unknown>[],
        sortOption,
      );

      const { headers: submissionHeaders, rows: submissionRows, cellLinks: submissionCellLinks } =
        buildLeaderboardExportMatrix(
          sortedSubmissions,
          submissionColumnIds,
          getMetrics,
          rewardContext,
        );
      const { headers: creatorHeaders, rows: creatorRows, cellLinks: creatorCellLinks } =
        buildCreatorLeaderboardExportMatrix(
          sortedCreatorGroups,
          creatorColumnIds,
          creatorExportContext,
        );

      const exportedAt = new Date();
      const bundle = buildReportExportBundle({
        brandProfile,
        contest: reportContest,
        reportType: "full",
        submissions: reportAllSubmissions,
        getStatus: getReportStatus,
        getSubmissionExpectedCents: getReportExpectedCents,
        submissionFilter,
        exportedAt,
        sortLabel,
      });

      const sortDividerLine = getReportExportSortDividerLine(sortOption);

      await downloadFullCampaignReport(format, {
        branding: bundle.branding,
        metrics: bundle.metrics,
        approvedCount: bundle.approvedCount,
        submissionHeaders,
        submissionRows,
        submissionCellLinks,
        creatorHeaders,
        creatorRows,
        creatorCellLinks,
        analyticsSnapshot: scopedAnalyticsSnapshot,
        submissionSortLabel: sortDividerLine,
        creatorSortLabel: sortDividerLine,
        submissionFilter,
        platform: reportContest.platform ?? undefined,
      });

      toast.success(
        `Full campaign report downloaded (${scopedSubmissions.length} submissions · ${scopedCreatorGroups.length} creators)`,
      );
      onOpenChange(false);
    } catch (err) {
      console.error("[FullCampaignReportExport]", err);
      toast.error("Failed to download full campaign report");
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
            Download full campaign report
          </DialogTitle>
          <DialogDescription
            className={cn(
              "text-sm leading-relaxed",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            Combined export with cover page, submissions, creator-wise data, and
            analytics overview. {scopedSubmissions.length} submissions ·{" "}
            {scopedCreatorGroups.length} creators ·{" "}
            {formatSubmissionDataScopeLabel(submissionFilter)}.
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
                "text-sm font-medium mb-2 block",
                isDark ? "text-slate-100" : "text-slate-800",
              )}
            >
              Submission data scope
            </Label>
            <Select
              value={submissionFilter}
              onValueChange={(value) =>
                setSubmissionFilter(value as ReportSubmissionFilter)
              }
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
                <SelectValue placeholder="Choose data scope">
                  {SUBMISSION_FILTER_LABELS[submissionFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {SUBMISSION_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option} isDark={isDark}>
                    {SUBMISSION_FILTER_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Sort order
            </Label>
            <Select
              value={sortOption}
              onValueChange={(value) =>
                setSortOption(value as ReportExportSortOption)
              }
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
                <SelectValue placeholder="Choose sort order">
                  {sortLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {sortOptions.map((option) => (
                  <SelectItem key={option} value={option} isDark={isDark}>
                    {getReportExportSortLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ColumnPickerSection
            title="Submissions columns"
            columns={selectableSubmissionColumns}
            selected={submissionSelected}
            onToggle={toggleSubmission}
            isDark={isDark}
          />
          <ColumnPickerSection
            title="Creator-wise columns"
            columns={selectableCreatorColumns}
            selected={creatorSelected}
            onToggle={toggleCreator}
            isDark={isDark}
          />

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
            disabled={
              exporting ||
              submissionColumnIds.length === 0 ||
              creatorColumnIds.length === 0
            }
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

function ColumnPickerSection({
  title,
  columns,
  selected,
  onToggle,
  isDark,
}: {
  title: string;
  columns: { id: string; label: string }[];
  selected: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  isDark: boolean;
}) {
  const selectedCount = columns.filter((c) => selected[c.id]).length;

  return (
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
        {title} ({selectedCount} selected)
      </Label>
      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
        {columns.map((col) => {
          const id = `full-export-${title}-${col.id}`;
          return (
            <div
              key={col.id}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5",
                isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
              )}
            >
              <Checkbox
                id={id}
                checked={selected[col.id] === true}
                onCheckedChange={(checked) =>
                  onToggle(col.id, checked === true)
                }
                className={cn(
                  isDark &&
                    "border-gray-500 data-[state=checked]:bg-[#4A00BE]",
                )}
              />
              <Label
                htmlFor={id}
                className={cn(
                  "flex-1 text-sm cursor-pointer",
                  isDark ? "text-slate-200" : "text-slate-800",
                )}
              >
                {col.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

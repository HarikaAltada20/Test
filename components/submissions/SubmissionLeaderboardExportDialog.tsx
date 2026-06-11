"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  buildLeaderboardExportMatrix,
  downloadLeaderboardReport,
  type LeaderboardExportFormat,
  type PlatformMetrics,
  type RewardExportContext,
} from "@/lib/submission-leaderboard-export";
import {
  getCreatorExportColumns,
  type CreatorExportColumnId,
} from "@/lib/creator-leaderboard-export-columns";
import {
  buildCreatorLeaderboardExportMatrix,
  type CreatorExportContext,
} from "@/lib/creator-leaderboard-export";
import { toast } from "sonner";
import type { AccountInsightsPreset } from "@/lib/instagram-account-insights";
import {
  INSTAGRAM_ARCHIVES_BATCH_SIZE,
  INSTAGRAM_INSIGHTS_EXPORT_PRESETS,
  type InstagramInsightsExportSelection,
} from "@/lib/instagram-analytics-export";
import type { InstagramProfileSnapshot } from "@/lib/platform-social-archive";
import type { BrandProfile, ReportSubmissionFilter } from "@/lib/report-export-branding";
import { DEFAULT_REPORT_SUBMISSION_FILTER } from "@/lib/report-export-branding";
import {
  buildReportExportBundle,
  filterSubmissionsForReportExport,
  type ReportExportContestContext,
} from "@/lib/report-export-context";
import { scopeCreatorGroupsForReportExport } from "@/lib/report-export-creator-scope";
import type { ContestAnalyticsExportSubmission } from "@/lib/contest-analytics-export";
import {
  DEFAULT_REPORT_EXPORT_SORT,
  getReportExportSortDividerLine,
  getReportExportSortLabel,
  getReportExportSortOptions,
  sortCreatorGroupsForExport,
  sortSubmissionsForExport,
  type ReportExportSortOption,
} from "@/lib/report-export-sort";
import { omitCreatorNameForSpreadsheetFormats } from "@/lib/report-export-columns";
import { maybeWarnLargePdfExport } from "@/lib/report-export-guards";

const FORMAT_LABELS: Record<LeaderboardExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  pdf: "PDF (.pdf)",
};

type SubmissionExportProps = {
  exportKind: "submission";
  rowCount: number;
  submissions: Record<string, unknown>[];
  getMetrics: (submission: Record<string, unknown>) => PlatformMetrics;
  rewardContext: RewardExportContext;
  columnOptions: Parameters<typeof getSubmissionExportColumns>[0];
};

type CreatorExportProps = {
  exportKind: "creator";
  rowCount: number;
  creatorGroups: Record<string, unknown>[];
  creatorExportContext: CreatorExportContext;
  columnOptions: Parameters<typeof getCreatorExportColumns>[0];
};

export type SubmissionLeaderboardExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark?: boolean;
  contestTitle: string;
  /** Required for live Instagram insights archive load on export (admin IG contests). */
  contestId?: string;
  viewLabel?: string;
  sortLabel?: string;
  defaultSelectedColumnIds?: string[];
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
  submissionFilter?: ReportSubmissionFilter;
  isTwitterTextImage?: boolean;
  getMetrics?: (submission: Record<string, unknown>) => PlatformMetrics;
} & (SubmissionExportProps | CreatorExportProps);

async function fetchInstagramArchivesBatch(
  contestId: string,
  creatorIds: string[],
): Promise<{
  archives: Record<string, unknown>;
  profileSummaries: Record<string, InstagramProfileSnapshot | null>;
}> {
  const res = await fetch(
    `/api/admin/contests/${contestId}/instagram-archives`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorIds }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Failed to load Instagram insights cache");
  }
  return {
    archives: (data.archives ?? {}) as Record<string, unknown>,
    profileSummaries: (data.profileSummaries ?? {}) as Record<
      string,
      InstagramProfileSnapshot | null
    >,
  };
}

/** Loads Instagram archives for export; chunks requests to match API batch size. */
async function fetchInstagramArchivesForExport(
  contestId: string,
  creatorIds: string[],
): Promise<{
  archives: Record<string, unknown>;
  profileSummaries: Record<string, InstagramProfileSnapshot | null>;
}> {
  const uniqueIds = [
    ...new Set(creatorIds.map((id) => String(id).trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) {
    return { archives: {}, profileSummaries: {} };
  }

  const archives: Record<string, unknown> = {};
  const profileSummaries: Record<string, InstagramProfileSnapshot | null> = {};

  for (let i = 0; i < uniqueIds.length; i += INSTAGRAM_ARCHIVES_BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + INSTAGRAM_ARCHIVES_BATCH_SIZE);
    const batch = await fetchInstagramArchivesBatch(contestId, chunk);
    Object.assign(archives, batch.archives);
    Object.assign(profileSummaries, batch.profileSummaries);
  }

  return { archives, profileSummaries };
}

export function SubmissionLeaderboardExportDialog(
  props: SubmissionLeaderboardExportDialogProps,
) {
  const {
    open,
    onOpenChange,
    isDark = false,
    contestTitle,
    contestId,
    viewLabel = "Normal View",
    sortLabel,
    defaultSelectedColumnIds,
    exportKind,
    rowCount,
  } = props;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [format, setFormat] = useState<LeaderboardExportFormat>("xlsx");
  const [exportSortOption, setExportSortOption] =
    useState<ReportExportSortOption>(DEFAULT_REPORT_EXPORT_SORT);
  const [exporting, setExporting] = useState(false);
  const [igInsightsPreset, setIgInsightsPreset] =
    useState<AccountInsightsPreset>("overall");
  const [igCustomSince, setIgCustomSince] = useState("");
  const [igCustomUntil, setIgCustomUntil] = useState("");

  const availableColumns = useMemo(() => {
    if (exportKind === "creator") {
      return getCreatorExportColumns(props.columnOptions);
    }
    return getSubmissionExportColumns(props.columnOptions);
  }, [exportKind, props]);

  const selectableColumns = useMemo(
    () => omitCreatorNameForSpreadsheetFormats(availableColumns, format),
    [availableColumns, format],
  );

  const defaultIds = useMemo((): string[] => {
    if (defaultSelectedColumnIds?.length) {
      const allowed = new Set<string>(
        selectableColumns.map((c) => c.id as string),
      );
      const picked = defaultSelectedColumnIds.filter((id) => allowed.has(id));
      if (picked.length > 0) return picked;
    }
    return selectableColumns.map((c) => c.id as string);
  }, [selectableColumns, defaultSelectedColumnIds]);

  useEffect(() => {
    if (!open) return;
    setExportSortOption(DEFAULT_REPORT_EXPORT_SORT);
  }, [open]);

  const exportSortOptions = useMemo(
    () => getReportExportSortOptions(props.isTwitterTextImage),
    [props.isTwitterTextImage],
  );

  const exportSortLabel = useMemo(
    () => getReportExportSortLabel(exportSortOption),
    [exportSortOption],
  );

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    for (const col of selectableColumns) {
      next[col.id] = defaultIds.includes(col.id);
    }
    setSelected(next);
  }, [open, selectableColumns, defaultIds, format]);

  const selectedColumnIds = useMemo(
    () =>
      selectableColumns
        .filter((c) => selected[c.id] !== false)
        .map((c) => c.id),
    [selectableColumns, selected],
  );

  const isInstagramContest = useMemo(() => {
    const platform = props.columnOptions.platform?.toLowerCase() ?? "";
    return platform.includes("instagram");
  }, [props.columnOptions.platform]);

  const showIgInsightsRange = useMemo(() => {
    if (exportKind !== "creator") return false;
    if (!isInstagramContest || !props.columnOptions.isAdminView) return false;
    const hasColumn = availableColumns.some((c) => c.id === "instagram_insights");
    if (!hasColumn) return false;
    return selected.instagram_insights !== false;
  }, [
    exportKind,
    isInstagramContest,
    props.columnOptions.isAdminView,
    availableColumns,
    selected,
  ]);

  const instagramInsightsSelection = useMemo(():
    | InstagramInsightsExportSelection
    | undefined => {
    if (!showIgInsightsRange) return undefined;
    if (igInsightsPreset === "custom") {
      if (!igCustomSince || !igCustomUntil) return undefined;
      const since = Math.floor(new Date(igCustomSince).getTime() / 1000);
      const until = Math.floor(new Date(igCustomUntil).getTime() / 1000);
      return { preset: "custom", customSince: since, customUntil: until };
    }
    return { preset: igInsightsPreset };
  }, [
    showIgInsightsRange,
    igInsightsPreset,
    igCustomSince,
    igCustomUntil,
  ]);

  useEffect(() => {
    if (!open) return;
    setIgInsightsPreset("overall");
    setIgCustomSince("");
    setIgCustomUntil("");
  }, [open]);

  const toggleColumn = (id: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: checked }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    for (const col of selectableColumns) next[col.id] = true;
    setSelected(next);
  };

  const handleExport = async () => {
    if (rowCount === 0) {
      toast.error(
        exportKind === "creator"
          ? "No creators to export"
          : "No submissions to export",
      );
      return;
    }
    const exportColumnIds = selectableColumns
      .filter((c) => selected[c.id] !== false)
      .map((c) => c.id);

    if (showIgInsightsRange && igInsightsPreset === "custom") {
      if (!igCustomSince || !igCustomUntil) {
        toast.error("Select both From and To dates for the custom Instagram insights range.");
        return;
      }
    }
    if (showIgInsightsRange && !instagramInsightsSelection) {
      toast.error("Complete the Instagram insights date range before exporting.");
      return;
    }

    maybeWarnLargePdfExport(rowCount, format);

    setExporting(true);
    try {
      let instagramArchiveByCreatorId: Record<string, unknown> | null = null;
      let instagramProfileByCreatorId: Record<
        string,
        InstagramProfileSnapshot | null
      > | null = null;
      if (showIgInsightsRange && contestId) {
        const creatorIds =
          exportKind === "creator"
            ? [
                ...new Set(
                  props.creatorGroups
                    .map((g) =>
                      String((g.creator as { id?: string })?.id ?? "").trim(),
                    )
                    .filter(Boolean),
                ),
              ]
            : [
                ...new Set(
                  props.submissions
                    .map((s) => {
                      const c = s.creator as { id?: string } | undefined;
                      return String(s.creator_id ?? c?.id ?? "").trim();
                    })
                    .filter(Boolean),
                ),
              ];
        const loaded = await fetchInstagramArchivesForExport(
          contestId,
          creatorIds,
        );
        instagramArchiveByCreatorId = loaded.archives;
        instagramProfileByCreatorId = loaded.profileSummaries;
      }

      let headers: string[];
      let rows: string[][];
      let cellLinks: (string | null)[][];

      if (exportKind === "creator") {
        let creatorGroupsForExport = props.creatorGroups;
        const exportFilter =
          props.submissionFilter ?? DEFAULT_REPORT_SUBMISSION_FILTER;
        if (props.getReportStatus) {
          const submissionSource = (props.reportAllSubmissions ??
            props.reportSubmissions ??
            props.submissions) as ContestAnalyticsExportSubmission[];
          const scopedSubmissions = filterSubmissionsForReportExport(
            submissionSource,
            exportFilter,
            props.getReportStatus,
          );
          creatorGroupsForExport = scopeCreatorGroupsForReportExport(
            props.creatorGroups,
            scopedSubmissions as unknown as Record<string, unknown>[],
            {
              getStatus: (submission) =>
                props.getReportStatus!(
                  submission as ContestAnalyticsExportSubmission,
                ),
              getMetrics: props.getMetrics,
              getExpectedCents: props.getReportExpectedCents
                ? (submission) =>
                    props.getReportExpectedCents!(
                      submission as ContestAnalyticsExportSubmission,
                    )
                : undefined,
            },
          );
        }

        const sortedGroups = sortCreatorGroupsForExport(
          creatorGroupsForExport,
          exportSortOption,
        );
        ({ headers, rows, cellLinks } = buildCreatorLeaderboardExportMatrix(
          sortedGroups,
          exportColumnIds as CreatorExportColumnId[],
          {
            ...props.creatorExportContext,
            instagramInsightsSelection: instagramInsightsSelection ?? null,
            instagramArchiveByCreatorId,
            instagramProfileByCreatorId,
          },
        ));
      } else {
        const exportFilter =
          props.submissionFilter ?? DEFAULT_REPORT_SUBMISSION_FILTER;
        let submissionsForExport = props.submissions;
        if (props.getReportStatus) {
          const submissionSource = (props.reportAllSubmissions ??
            props.reportSubmissions ??
            props.submissions) as ContestAnalyticsExportSubmission[];
          submissionsForExport = filterSubmissionsForReportExport(
            submissionSource,
            exportFilter,
            props.getReportStatus,
          ) as unknown as Record<string, unknown>[];
        }
        const sortedSubmissions = sortSubmissionsForExport(
          submissionsForExport,
          exportSortOption,
          {
            isTwitterTextImage: props.isTwitterTextImage,
            getMetrics: props.getMetrics,
          },
        );
        ({ headers, rows, cellLinks } = buildLeaderboardExportMatrix(
          sortedSubmissions,
          exportColumnIds as SubmissionExportColumnId[],
          props.getMetrics,
          {
            ...props.rewardContext,
            instagramInsightsSelection: instagramInsightsSelection ?? null,
            instagramArchiveByCreatorId,
            instagramProfileByCreatorId,
          },
        ));
      }

      const filePrefix =
        exportKind === "creator"
          ? "creators-leaderboard"
          : "submissions-leaderboard";

      const exportPlatform =
        exportKind === "creator"
          ? props.creatorExportContext.platform
          : props.rewardContext.platform;

      const exportOptions: Parameters<typeof downloadLeaderboardReport>[4] = {
        contestTitle: `${contestTitle} (${viewLabel})`,
        exportedAt: new Date().toLocaleString(),
        dataSheetName:
          exportKind === "creator" ? "Creator-wise" : "Submissions",
        cellLinks,
        platform: exportPlatform,
        ...(exportKind === "submission"
          ? { rewardContext: props.rewardContext }
          : {}),
      };

      const exportFilter =
        props.submissionFilter ?? DEFAULT_REPORT_SUBMISSION_FILTER;

      if (
        props.reportContest &&
        (props.reportAllSubmissions ?? props.reportSubmissions) &&
        props.getReportStatus &&
        props.getReportExpectedCents
      ) {
        const bundle = buildReportExportBundle({
          brandProfile: props.brandProfile,
          contest: props.reportContest,
          reportType: exportKind === "creator" ? "creator-wise" : "submissions",
          submissions:
            props.reportAllSubmissions ?? props.reportSubmissions ?? [],
          getStatus: props.getReportStatus,
          getSubmissionExpectedCents: props.getReportExpectedCents,
          viewLabel,
          sortLabel: exportSortLabel,
          submissionFilter: exportFilter,
          exportedAt: new Date(),
        });
        exportOptions.branding = bundle.branding;
        exportOptions.metrics = bundle.metrics;
        exportOptions.approvedCount = bundle.approvedCount;
        exportOptions.submissionFilter = exportFilter;
        if (exportKind === "submission") {
          exportOptions.submissionSortLabel =
            getReportExportSortDividerLine(exportSortOption);
        }
      }

      await downloadLeaderboardReport(
        format,
        `${filePrefix}-${contestTitle}`,
        headers,
        rows,
        exportOptions,
      );
      toast.success(
        `${format.toUpperCase()} download started (${rowCount} rows)`,
      );
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const entityLabel = exportKind === "creator" ? "creator" : "submission";

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
            Download {exportKind === "creator" ? "creators" : "submissions"}{" "}
            report
          </DialogTitle>
          <DialogDescription
            className={cn(
              "text-sm leading-relaxed",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            Export the {exportKind === "creator" ? "creator-wise" : "submissions"}{" "}
            leaderboard with your chosen columns. Uses current filters ({viewLabel}
            ). All matching rows are included, not only the current page.
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
              Sort order
            </Label>
            <Select
              value={exportSortOption}
              onValueChange={(value) =>
                setExportSortOption(value as ReportExportSortOption)
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
                  {exportSortLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                {exportSortOptions.map((option) => (
                  <SelectItem key={option} value={option} isDark={isDark}>
                    {getReportExportSortLabel(option)}
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

          {showIgInsightsRange && (
            <div
              className={cn(
                "rounded-lg border p-3 space-y-3",
                isDark
                  ? "border-gray-600 bg-[#170337]/60"
                  : "border-slate-200 bg-slate-50",
              )}
            >
              <div>
                <Label
                  className={cn(
                    "text-sm font-medium block",
                    isDark ? "text-slate-100" : "text-slate-800",
                  )}
                >
                  Instagram insights range
                </Label>
                <p
                  className={cn(
                    "text-xs mt-1 leading-relaxed",
                    isDark ? "text-slate-400" : "text-slate-600",
                  )}
                >
                  Uses cached data per range from the Instagram insights modal.
                  Refresh from Meta there first if a range is missing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {INSTAGRAM_INSIGHTS_EXPORT_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant={igInsightsPreset === p.id ? "default" : "outline"}
                    className={cn(
                      "rounded-full h-8 text-xs sm:text-sm",
                      igInsightsPreset === p.id &&
                        "bg-[#4A00BE] hover:bg-[#4A00BE]/90 text-white border-0",
                      igInsightsPreset !== p.id &&
                        (isDark
                          ? "border-white/15 bg-white/5 text-slate-200 hover:bg-white/10"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"),
                    )}
                    onClick={() => setIgInsightsPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              {igInsightsPreset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label
                      className={cn(
                        "text-xs",
                        isDark ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      From
                    </Label>
                    <Input
                      type="date"
                      value={igCustomSince}
                      onChange={(e) => setIgCustomSince(e.target.value)}
                      className={cn(
                        isDark
                          ? "border-gray-500 bg-[#07031D] text-white"
                          : "border-slate-300 bg-white",
                      )}
                    />
                  </div>
                  <div>
                    <Label
                      className={cn(
                        "text-xs",
                        isDark ? "text-slate-300" : "text-slate-700",
                      )}
                    >
                      To
                    </Label>
                    <Input
                      type="date"
                      value={igCustomUntil}
                      onChange={(e) => setIgCustomUntil(e.target.value)}
                      className={cn(
                        isDark
                          ? "border-gray-500 bg-[#07031D] text-white"
                          : "border-slate-300 bg-white",
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "rounded-lg border p-3",
              isDark
                ? "border-gray-600 bg-[#170337]/60"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-slate-100" : "text-slate-800",
                )}
              >
                Columns ({selectedColumnIds.length} selected)
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 text-xs font-medium",
                  isDark
                    ? "text-purple-300 hover:text-white hover:bg-white/10"
                    : "text-[#7F39EC] hover:text-[#5c2ab0] hover:bg-purple-50",
                )}
                onClick={selectAll}
              >
                Select all
              </Button>
            </div>
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
              {selectableColumns.map((col) => (
                <label
                  key={col.id}
                  className={cn(
                    "flex items-start gap-2 cursor-pointer rounded-md px-1 py-0.5 text-sm",
                    isDark ? "text-slate-100" : "text-slate-800",
                  )}
                >
                  <Checkbox
                    className="mt-0.5 shrink-0"
                    checked={selected[col.id] !== false}
                    onCheckedChange={(checked) =>
                      toggleColumn(col.id, checked === true)
                    }
                  />
                  <span className="min-w-0 flex-1 break-words leading-snug">
                    {col.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <p
            className={cn(
              "text-sm",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
          >
            {rowCount} {entityLabel}
            {rowCount === 1 ? "" : "s"} will be exported.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={exporting}
            className={cn(
              isDark
                ? "border-gray-500 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
            )}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || rowCount === 0}
            className="bg-[#7F39EC] text-white hover:bg-[#6B2FD6]"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

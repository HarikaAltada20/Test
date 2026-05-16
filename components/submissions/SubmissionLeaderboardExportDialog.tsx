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
  INSTAGRAM_INSIGHTS_EXPORT_PRESETS,
  type InstagramInsightsExportSelection,
} from "@/lib/instagram-analytics-export";
import type { InstagramProfileSnapshot } from "@/lib/platform-social-archive";

const FORMAT_LABELS: Record<LeaderboardExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
  pdf: "PDF (.pdf)",
};

/** PDF/Excel use Username only; Creator (display name) stays available for CSV. */
const CREATOR_NAME_COLUMN_ID = "creator_name";

function omitCreatorNameForSpreadsheetFormats(
  columns: { id: string; label: string }[],
  format: LeaderboardExportFormat,
) {
  if (format === "csv") return columns;
  return columns.filter((c) => c.id !== CREATOR_NAME_COLUMN_ID);
}

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
} & (SubmissionExportProps | CreatorExportProps);

async function fetchInstagramArchivesForExport(
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
    if (!isInstagramContest || !props.columnOptions.isAdminView) return false;
    const hasColumn = availableColumns.some((c) => c.id === "instagram_insights");
    if (!hasColumn) return false;
    return selected.instagram_insights !== false;
  }, [
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

      if (exportKind === "creator") {
        ({ headers, rows } = buildCreatorLeaderboardExportMatrix(
          props.creatorGroups,
          exportColumnIds as CreatorExportColumnId[],
          {
            ...props.creatorExportContext,
            instagramInsightsSelection: instagramInsightsSelection ?? null,
            instagramArchiveByCreatorId,
            instagramProfileByCreatorId,
          },
        ));
      } else {
        ({ headers, rows } = buildLeaderboardExportMatrix(
          props.submissions,
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

      await downloadLeaderboardReport(
        format,
        `${filePrefix}-${contestTitle}`,
        headers,
        rows,
        {
          contestTitle: `${contestTitle} (${viewLabel})`,
          exportedAt: new Date().toLocaleString(),
        },
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
            leaderboard with your chosen columns. Uses current filters and sort (
            {viewLabel}
            {sortLabel ? ` · ${sortLabel}` : ""}). All matching rows are included,
            not only the current page.
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

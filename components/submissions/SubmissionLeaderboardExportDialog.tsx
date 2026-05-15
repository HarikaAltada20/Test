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
  viewLabel?: string;
  sortLabel?: string;
  defaultSelectedColumnIds?: string[];
} & (SubmissionExportProps | CreatorExportProps);

export function SubmissionLeaderboardExportDialog(
  props: SubmissionLeaderboardExportDialogProps,
) {
  const {
    open,
    onOpenChange,
    isDark = false,
    contestTitle,
    viewLabel = "Normal View",
    sortLabel,
    defaultSelectedColumnIds,
    exportKind,
    rowCount,
  } = props;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [format, setFormat] = useState<LeaderboardExportFormat>("xlsx");
  const [exporting, setExporting] = useState(false);

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

    setExporting(true);
    try {
      let headers: string[];
      let rows: string[][];

      if (exportKind === "creator") {
        ({ headers, rows } = buildCreatorLeaderboardExportMatrix(
          props.creatorGroups,
          exportColumnIds as CreatorExportColumnId[],
          props.creatorExportContext,
        ));
      } else {
        ({ headers, rows } = buildLeaderboardExportMatrix(
          props.submissions,
          exportColumnIds as SubmissionExportColumnId[],
          props.getMetrics,
          props.rewardContext,
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

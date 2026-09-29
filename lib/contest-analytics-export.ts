import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import { buildTopTenCombinedSummaryRows } from "@/lib/contest-analytics-snapshot";
import type {
  LeaderboardExportFormat,
  LeaderboardExportOptions,
} from "@/lib/submission-leaderboard-export";
import { formatLocalDateTime } from "@/lib/utils";
import ExcelJS from "exceljs";
import {
  buildAnalyticsSheet,
  buildSummarySheet,
  downloadExcelBuffer,
  writeExcelWorkbook,
} from "@/lib/report-export-excel";
import {
  addPdfFooters,
  createPortraitPdfDoc,
  createPremiumPageTracker,
  markPremiumPage,
  renderPdfAnalyticsSections,
  renderPdfSectionDividerPage,
} from "@/lib/report-export-pdf";

export type ContestAnalyticsTabId =
  | "all"
  | "pending"
  | "verified"
  | "rejected"
  | "paid"
  | "verified_or_paid"
  | "not_rejected";

export const CONTEST_ANALYTICS_TAB_IDS: ContestAnalyticsTabId[] = [
  "verified_or_paid",
  "not_rejected",
  "all",
  "verified",
  "paid",
  "pending",
  "rejected",
];

const TAB_LABELS: Record<ContestAnalyticsTabId, string> = {
  all: "All",
  not_rejected: "Not Rejected",
  verified: "Verified",
  paid: "Paid",
  pending: "Pending",
  rejected: "Rejected",
  verified_or_paid: "Verified/Paid",
};

export function contestAnalyticsTabLabel(tab: ContestAnalyticsTabId): string {
  return TAB_LABELS[tab] ?? tab;
}

/** @deprecated Used only for tab counts in the dialog. */
export type ContestAnalyticsExportSubmission = {
  id: string;
  created_at?: string;
  content_link?: string;
  views: number | null;
  status?: string | null;
  moderation_status?: string | null;
  platform?: string | null;
  is_twitter_tweet?: boolean;
  creator_id?: string | null;
  creator_username?: string | null;
  creator_display_name?: string | null;
  earnings?: number | null;
  other_stats?: Record<string, unknown> | null;
  manual_points_adjustment?: number;
  video_title?: string | null;
  paid?: boolean;
  paid_at?: string | null;
  bonus_amount?: number | null;
};

export function filterSubmissionsForAnalyticsTab(
  submissions: ContestAnalyticsExportSubmission[],
  tab: ContestAnalyticsTabId,
  getStatus: (submission: ContestAnalyticsExportSubmission) => string,
): ContestAnalyticsExportSubmission[] {
  return submissions.filter((submission) => {
    const status = getStatus(submission);
    if (tab === "all") return true;
    if (tab === "not_rejected") return status !== "rejected";
    if (tab === "verified_or_paid") {
      return status === "verified" || status === "paid";
    }
    return status === tab;
  });
}

export function getAnalyticsTabCounts(
  submissions: ContestAnalyticsExportSubmission[],
  getStatus: (submission: ContestAnalyticsExportSubmission) => string,
): Record<ContestAnalyticsTabId, number> {
  const counts = {} as Record<ContestAnalyticsTabId, number>;
  for (const tab of CONTEST_ANALYTICS_TAB_IDS) {
    counts[tab] = filterSubmissionsForAnalyticsTab(
      submissions,
      tab,
      getStatus,
    ).length;
  }
  return counts;
}

function sheetNameForTab(tab: ContestAnalyticsTabId): string {
  return contestAnalyticsTabLabel(tab)
    .replace(/[\\/*?:\[\]]/g, "")
    .slice(0, 31);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function snapshotToSheetRows(snapshot: ContestAnalyticsTabSnapshot): string[][] {
  const rows: string[][] = [];
  for (const section of snapshot.sections) {
    rows.push([section.title]);
    rows.push(["Metric", "Value"]);
    rows.push(...section.rows);
    rows.push([]);
  }
  const topTenSummaryRows = buildTopTenCombinedSummaryRows(snapshot);
  if (topTenSummaryRows.length > 0) {
    for (const [label, value] of topTenSummaryRows) {
      rows.push([label, value.toLocaleString()]);
    }
    rows.push([]);
  }
  for (const table of [
    snapshot.viewsDistributionBySubmission,
    snapshot.viewsDistributionByCreator,
  ]) {
    rows.push([table.title]);
    rows.push(table.headers);
    rows.push(...table.rows);
    rows.push([]);
  }
  return rows;
}

export async function downloadContestAnalyticsReport(
  format: LeaderboardExportFormat,
  contestTitle: string,
  snapshots: ContestAnalyticsTabSnapshot[],
  options?: LeaderboardExportOptions,
): Promise<void> {
  if (snapshots.length === 0) {
    throw new Error("Select at least one tab");
  }

  const date = new Date().toISOString().slice(0, 10);
  const tabSlug =
    snapshots.length === 1
      ? snapshots[0].tabLabel
      : `${snapshots.length}_tabs`;
  const safeBase = `${contestTitle}_analytics_${tabSlug}`
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);

  if (format === "csv") {
    const lines: string[] = [];
    if (options?.branding) {
      lines.push(
        options.branding.reportTitle,
        `Prepared for,${csvEscape(options.branding.brandCompanyName)}`,
        `Campaign,${csvEscape(contestTitle)}`,
        `Exported At,${csvEscape(options.branding.exportedAt)}`,
        "",
      );
    } else {
      lines.push(
        "Contest Analytics Report",
        `Contest,${csvEscape(contestTitle)}`,
        `Exported At,${csvEscape(formatLocalDateTime(new Date()))}`,
        "",
      );
    }

    for (const snapshot of snapshots) {
      lines.push(`=== ${snapshot.tabLabel} ===`, "");
      const sheetRows = snapshotToSheetRows(snapshot);
      for (const row of sheetRows) {
        if (row.length === 1 && !row[0].includes(",")) {
          lines.push(row[0]);
        } else if (row.length === 2 && row[0] === "Metric") {
          lines.push("Metric,Value");
        } else {
          lines.push(row.map(csvEscape).join(","));
        }
      }
      lines.push("");
    }

    const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    downloadBlob(blob, `${safeBase}-${date}.csv`);
    return;
  }

  if (format === "xlsx") {
    if (options?.branding && options?.metrics) {
      const workbook = new ExcelJS.Workbook();
      await buildSummarySheet(
        workbook,
        options.branding,
        options.metrics,
        options.approvedCount ?? 0,
      );
      const usedSheetNames = new Set<string>(["Summary"]);
      for (const snapshot of snapshots) {
        let name = sheetNameForTab(snapshot.tab);
        let suffix = 1;
        while (usedSheetNames.has(name)) {
          suffix += 1;
          name = `${sheetNameForTab(snapshot.tab).slice(0, 28)}_${suffix}`;
        }
        usedSheetNames.add(name);
        buildAnalyticsSheet(workbook, snapshot, name, {
          branding: options.branding,
          metrics: options.metrics,
        });
      }
      const buffer = await writeExcelWorkbook(workbook);
      downloadExcelBuffer(buffer, `${safeBase}-${date}.xlsx`);
      return;
    }

    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const snapshot of snapshots) {
      let name = sheetNameForTab(snapshot.tab);
      let suffix = 1;
      while (usedSheetNames.has(name)) {
        suffix += 1;
        name = `${sheetNameForTab(snapshot.tab).slice(0, 28)}_${suffix}`;
      }
      usedSheetNames.add(name);

      const sheetData: string[][] = [
        [contestTitle],
        [`Filter: ${snapshot.tabLabel}`],
        [`Exported: ${formatLocalDateTime(new Date())}`],
        [],
        ...snapshotToSheetRows(snapshot),
      ];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws["!cols"] = [{ wch: 36 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${safeBase}-${date}.xlsx`);
    return;
  }

  if (options?.branding && options?.metrics) {
    const { doc, fonts } = await createPortraitPdfDoc();
    const premiumPages = createPremiumPageTracker();

    const tabLabels = snapshots.map((s) => s.tabLabel).join(" · ");
    const sectionCount = snapshots.reduce((n, s) => n + s.sections.length, 0);
    markPremiumPage(premiumPages, 1);
    await renderPdfSectionDividerPage(doc, 1, "Analytics Overview", [
      tabLabels || "Campaign analytics",
      `${sectionCount} metric sections · Views distribution`,
    ], fonts);

    for (const snapshot of snapshots) {
      doc.addPage("a4", "portrait");
      const analyticsStartPage = doc.internal.getNumberOfPages();
      await renderPdfAnalyticsSections(
        doc,
        snapshot,
        36,
        fonts,
        "Analytics Overview",
        { premium: true },
      );
      for (
        let p = analyticsStartPage;
        p <= doc.internal.getNumberOfPages();
        p++
      ) {
        markPremiumPage(premiumPages, p);
      }
    }

    addPdfFooters(doc, fonts, premiumPages, { leadingPageCount: 1 });

    const bodyBytes = doc.output("arraybuffer") as ArrayBuffer;
    const { downloadPdfWithReactPrefix } = await import(
      "@/lib/report-export-pdf-cover-render"
    );
    await downloadPdfWithReactPrefix(
      bodyBytes,
      options.branding,
      options.metrics,
      `${safeBase}-${date}.pdf`,
    );
    return;
  }

  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;

  snapshots.forEach((snapshot, index) => {
    if (index > 0) doc.addPage();
    let startY = 40;

    doc.setFontSize(14);
    doc.text(contestTitle, marginX, startY);
    startY += 18;
    doc.setFontSize(11);
    doc.text(snapshot.tabLabel, marginX, startY);
    startY += 14;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(`Exported ${formatLocalDateTime(new Date())}`, marginX, startY);
    doc.setTextColor(0, 0, 0);
    startY += 16;

    for (const section of snapshot.sections) {
      doc.setFontSize(10);
      doc.text(section.title, marginX, startY);
      startY += 8;
      autoTable(doc, {
        head: [["Metric", "Value"]],
        body: section.rows,
        startY,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: marginX, right: marginX },
      });
      startY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 14;
    }

    const topTenSummaryRows = buildTopTenCombinedSummaryRows(snapshot);
    for (const [label, value] of topTenSummaryRows) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, marginX, startY);
      doc.setFont("helvetica", "normal");
      doc.text(value.toLocaleString(), marginX + 220, startY);
      startY += 12;
    }
    if (topTenSummaryRows.length > 0) {
      startY += 6;
    }

    for (const table of [
      snapshot.viewsDistributionBySubmission,
      snapshot.viewsDistributionByCreator,
    ]) {
      doc.setFontSize(10);
      doc.text(table.title, marginX, startY);
      startY += 8;
      autoTable(doc, {
        head: [table.headers],
        body: table.rows,
        startY,
        theme: "striped",
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: marginX, right: marginX },
      });
      startY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 14;
    }
  });

  doc.save(`${safeBase}-${date}.pdf`);
}

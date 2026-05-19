import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import type { LeaderboardExportFormat } from "@/lib/submission-leaderboard-export";
import { formatLocalDateTime } from "@/lib/utils";

export type ContestAnalyticsTabId =
  | "all"
  | "pending"
  | "verified"
  | "rejected"
  | "paid"
  | "verified_or_paid"
  | "not_rejected";

export const CONTEST_ANALYTICS_TAB_IDS: ContestAnalyticsTabId[] = [
  "all",
  "not_rejected",
  "verified",
  "paid",
  "pending",
  "rejected",
  "verified_or_paid",
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
  rows.push(["Views Distribution"]);
  rows.push(snapshot.viewsDistribution.headers);
  rows.push(...snapshot.viewsDistribution.rows);
  return rows;
}

export async function downloadContestAnalyticsReport(
  format: LeaderboardExportFormat,
  contestTitle: string,
  snapshots: ContestAnalyticsTabSnapshot[],
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
    const lines: string[] = [
      "Contest Analytics Report",
      `Contest,${csvEscape(contestTitle)}`,
      `Exported At,${csvEscape(formatLocalDateTime(new Date()))}`,
      "",
    ];

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

    doc.setFontSize(10);
    doc.text("Views Distribution", marginX, startY);
    startY += 8;
    autoTable(doc, {
      head: [snapshot.viewsDistribution.headers],
      body: snapshot.viewsDistribution.rows,
      startY,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: marginX, right: marginX },
    });
  });

  doc.save(`${safeBase}-${date}.pdf`);
}

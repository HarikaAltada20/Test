import ExcelJS from "exceljs";
import type { ExportReportBranding } from "@/lib/report-export-branding";
import { REPORT_THEME } from "@/lib/report-export-branding";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import {
  executiveSummaryRows,
  marketingPerformanceRows,
} from "@/lib/report-export-metrics";
import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";

const INDIGO = REPORT_THEME.indigo;
const NAVY = REPORT_THEME.navyMid;
const GOLD = REPORT_THEME.gold;
const ROW_ALT = REPORT_THEME.rowAlt;

function estimateColumnWidth(header: string): number {
  if (
    /analytics|traffic sources|demographics|top countries|instagram insights/i.test(
      header,
    )
  ) {
    return 48;
  }
  if (/insights status/i.test(header)) return 28;
  if (/^tweet$/i.test(header.trim())) return 72;
  if (/link|url|content|title|excerpt|reason/i.test(header)) return 36;
  return 14;
}

function headerFillStyle() {
  return {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: `FF${INDIGO}` },
  };
}

function navyFillStyle() {
  return {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: `FF${NAVY}` },
  };
}

function applyHeaderRowStyle(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.fill = headerFillStyle();
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 22;
}

function applyDataRowStyle(row: ExcelJS.Row, isAlt: boolean) {
  if (isAlt) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${ROW_ALT}` },
    };
  }
  row.alignment = { vertical: "top", wrapText: true };
}

const LOGO_HORIZONTAL_URL = "/images/gold_logo_horizontal.png";

async function loadExcelLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(LOGO_HORIZONTAL_URL);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function formatCampaignDateRange(branding: ExportReportBranding): string {
  if (branding.contestStart && branding.contestEnd) {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    return `${fmt(branding.contestStart)} – ${fmt(branding.contestEnd)}`;
  }
  if (branding.durationDays != null) {
    return `${branding.durationDays} days`;
  }
  return "—";
}

function isNumericHeader(header: string): boolean {
  const hl = header.toLowerCase();
  return (
    /^rank$/.test(hl.trim()) ||
    (/views|likes|comments|shares|points|amount|submissions|reach|saves|reward/.test(
      hl,
    ) &&
      !/reason|title|link|name|username|summary|status/.test(hl))
  );
}

export async function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  approvedCount: number,
): Promise<ExcelJS.Worksheet> {
  const ws = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: false }],
  });
  ws.columns = [{ width: 22 }, { width: 28 }, { width: 22 }, { width: 28 }];

  let rowIdx = 1;

  const headerRow = ws.getRow(rowIdx++);
  ws.mergeCells(rowIdx - 1, 1, rowIdx - 1, 3);
  headerRow.getCell(1).value = "SUMMARY";
  headerRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  headerRow.getCell(1).fill = navyFillStyle();
  headerRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
  headerRow.getCell(4).fill = navyFillStyle();
  headerRow.height = 40;

  const logoBuffer = await loadExcelLogoBuffer();
  if (logoBuffer) {
    const imageId = workbook.addImage({
      buffer: logoBuffer,
      extension: "png",
    });
    ws.addImage(imageId, {
      tl: { col: 3.2, row: 0.1 },
      ext: { width: 110, height: 34 },
    });
  } else {
    headerRow.getCell(4).value = branding.platformName;
    headerRow.getCell(4).font = { bold: true, size: 12, color: { argb: `FF${GOLD}` } };
    headerRow.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
  }

  rowIdx++;
  const blockAStart = rowIdx;
  const infoRows: [string, string][] = [
    ["Prepared for", branding.brandCompanyName],
    ["Campaign", branding.contestTitle],
    ["Report type", branding.reportDescription || branding.reportTitle],
    ["Exported", branding.exportedAt],
  ];
  if (branding.filtersApplied) {
    infoRows.push(["Filters", branding.filtersApplied]);
  }

  for (const [label, value] of infoRows) {
    const r = ws.getRow(rowIdx++);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true, color: { argb: "FF475569" } };
    ws.mergeCells(rowIdx - 1, 2, rowIdx - 1, 4);
    r.getCell(2).value = value;
  }

  const metaRows: [string, string][] = [
    ["Platform", branding.platformName],
    ["Duration", metrics.durationLabel],
    ["Date range", formatCampaignDateRange(branding)],
  ];
  let metaIdx = blockAStart;
  for (const [label, value] of metaRows) {
    const r = ws.getRow(metaIdx++);
    r.getCell(3).value = label;
    r.getCell(3).font = { bold: true, color: { argb: "FF475569" } };
    r.getCell(4).value = value;
  }

  rowIdx = Math.max(rowIdx, metaIdx) + 1;

  const execHeader = ws.getRow(rowIdx++);
  ws.mergeCells(rowIdx - 1, 1, rowIdx - 1, 4);
  execHeader.getCell(1).value = "Executive Summary";
  execHeader.getCell(1).font = { bold: true, size: 12, color: { argb: `FF${INDIGO}` } };

  const execRows = executiveSummaryRows(metrics, approvedCount);
  for (let i = 0; i < execRows.length; i += 2) {
    const r = ws.getRow(rowIdx++);
    const left = execRows[i];
    const right = execRows[i + 1];
    if (left) {
      r.getCell(1).value = left[0];
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = left[1];
      r.getCell(2).font = { bold: true, color: { argb: `FF${GOLD}` } };
    }
    if (right) {
      r.getCell(3).value = right[0];
      r.getCell(3).font = { bold: true };
      r.getCell(4).value = right[1];
      r.getCell(4).font = { bold: true, color: { argb: `FF${GOLD}` } };
    }
  }

  if (metrics.showMarketingBlock) {
    rowIdx++;
    const mktHeader = ws.getRow(rowIdx++);
    ws.mergeCells(rowIdx - 1, 1, rowIdx - 1, 4);
    mktHeader.getCell(1).value = "Marketing Performance";
    mktHeader.getCell(1).font = {
      bold: true,
      size: 12,
      color: { argb: `FF${INDIGO}` },
    };

    const mktRows = marketingPerformanceRows(metrics);
    for (const [label, value] of mktRows) {
      const r = ws.getRow(rowIdx++);
      r.getCell(1).value = label;
      r.getCell(1).font = { bold: true };
      r.getCell(2).value = value;
      r.getCell(2).font = { bold: true, color: { argb: `FF${GOLD}` } };
    }

    if (metrics.insightSentence) {
      rowIdx++;
      const insight = ws.getRow(rowIdx++);
      ws.mergeCells(rowIdx - 1, 1, rowIdx - 1, 4);
      insight.getCell(1).value = metrics.insightSentence;
      insight.getCell(1).font = { italic: true, color: { argb: "FF475569" } };
      insight.getCell(1).alignment = { wrapText: true };
    }
  }

  return ws;
}

export function buildDataSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  rows: string[][],
): ExcelJS.Worksheet {
  const safeName = sheetName.replace(/[\\/*?:\[\]]/g, "").slice(0, 31);
  const ws = workbook.addWorksheet(safeName);

  ws.columns = headers.map((h) => ({ width: estimateColumnWidth(h) }));

  const headerRow = ws.addRow(headers);
  applyHeaderRowStyle(headerRow);

  rows.forEach((row, i) => {
    const dataRow = ws.addRow(row);
    applyDataRowStyle(dataRow, i % 2 === 1);
    row.forEach((cell, colIdx) => {
      if (isNumericHeader(headers[colIdx] ?? "")) {
        dataRow.getCell(colIdx + 1).alignment = {
          horizontal: "right",
          vertical: "top",
          wrapText: true,
        };
      }
    });
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  if (headers.length > 0 && rows.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  return ws;
}

export function buildAnalyticsSheet(
  workbook: ExcelJS.Workbook,
  snapshot: ContestAnalyticsTabSnapshot,
  sheetName = "Analytics",
): ExcelJS.Worksheet {
  const safeName = sheetName.replace(/[\\/*?:\[\]]/g, "").slice(0, 31);
  const ws = workbook.addWorksheet(safeName);
  ws.columns = [{ width: 36 }, { width: 28 }];

  let rowIdx = 1;
  const tabRow = ws.getRow(rowIdx++);
  tabRow.getCell(1).value = `Analytics · ${snapshot.tabLabel}`;
  tabRow.getCell(1).font = { bold: true, size: 13, color: { argb: `FF${INDIGO}` } };

  for (const section of snapshot.sections) {
    rowIdx++;
    const sectionRow = ws.getRow(rowIdx++);
    sectionRow.getCell(1).value = section.title;
    sectionRow.getCell(1).font = { bold: true, size: 11 };

    const head = ws.getRow(rowIdx++);
    head.getCell(1).value = "Metric";
    head.getCell(2).value = "Value";
    applyHeaderRowStyle(head);

    section.rows.forEach((row, i) => {
      const r = ws.getRow(rowIdx++);
      r.getCell(1).value = row[0];
      r.getCell(2).value = row[1];
      applyDataRowStyle(r, i % 2 === 1);
    });
  }

  rowIdx++;
  for (const table of [
    snapshot.viewsDistributionBySubmission,
    snapshot.viewsDistributionByCreator,
  ]) {
    const distTitle = ws.getRow(rowIdx++);
    distTitle.getCell(1).value = table.title;
    distTitle.getCell(1).font = { bold: true, size: 11 };

    if (table.combinedViews != null) {
      const combinedRow = ws.getRow(rowIdx++);
      combinedRow.getCell(1).value = "Top 10 Combined Views";
      combinedRow.getCell(2).value = table.combinedViews.toLocaleString();
    }

    const distHead = ws.getRow(rowIdx++);
    distHead.values = table.headers;
    applyHeaderRowStyle(distHead);

    table.rows.forEach((row, i) => {
      const r = ws.getRow(rowIdx++);
      r.values = row;
      applyDataRowStyle(r, i % 2 === 1);
    });
    rowIdx++;
  }

  return ws;
}

export async function writeExcelWorkbook(
  workbook: ExcelJS.Workbook,
): Promise<ArrayBuffer> {
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function downloadExcelBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

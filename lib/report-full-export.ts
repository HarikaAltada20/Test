import type { LeaderboardExportFormat } from "@/lib/submission-leaderboard-export";
import type {
  ExportReportBranding,
  ReportSubmissionFilter,
} from "@/lib/report-export-branding";
import {
  buildCreatorWiseSectionTitle,
  buildSubmissionsWiseSectionTitle,
} from "@/lib/report-export-branding";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import ExcelJS from "exceljs";
import {
  buildAnalyticsSheet,
  buildDataSheet,
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
  renderPdfDataTable,
  renderPdfSectionDividerPage,
  type PdfSectionRef,
} from "@/lib/report-export-pdf";

export type FullCampaignReportInput = {
  branding: ExportReportBranding;
  metrics: ReportCoverMetrics;
  approvedCount: number;
  submissionHeaders: string[];
  submissionRows: string[][];
  submissionCellLinks?: (string | null)[][];
  creatorHeaders: string[];
  creatorRows: string[][];
  creatorCellLinks?: (string | null)[][];
  analyticsSnapshot: ContestAnalyticsTabSnapshot;
  submissionSortLabel?: string;
  creatorSortLabel?: string;
  submissionFilter?: ReportSubmissionFilter;
  platform?: string;
};

const PREFIX_PAGE_COUNT = 2;

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

function safeFilenameBase(contestTitle: string): string {
  return `${contestTitle}_full_campaign_report`
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
}

export async function downloadFullCampaignReport(
  format: LeaderboardExportFormat,
  input: FullCampaignReportInput,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = safeFilenameBase(input.branding.contestTitle);

  if (format === "csv") {
    const lines: string[] = [
      input.branding.reportTitle,
      `Prepared for,${csvEscape(input.branding.brandCompanyName)}`,
      `Campaign,${csvEscape(input.branding.contestTitle)}`,
      `Exported,${csvEscape(input.branding.exportedAt)}`,
      "",
      "=== Submissions ===",
      input.submissionHeaders.map(csvEscape).join(","),
      ...input.submissionRows.map((r) => r.map(csvEscape).join(",")),
      "",
      "=== Creator-wise ===",
      input.creatorHeaders.map(csvEscape).join(","),
      ...input.creatorRows.map((r) => r.map(csvEscape).join(",")),
      "",
      "=== Analytics Overview ===",
    ];
    for (const section of input.analyticsSnapshot.sections) {
      lines.push(section.title, "Metric,Value");
      lines.push(...section.rows.map((row) => row.map(csvEscape).join(",")));
      lines.push("");
    }
    lines.push("Views Distribution");
    for (const table of [
      input.analyticsSnapshot.viewsDistributionBySubmission,
      input.analyticsSnapshot.viewsDistributionByCreator,
    ]) {
      lines.push(table.title);
      if (table.combinedViews != null) {
        lines.push(
          ["Top 10 Combined Views", table.combinedViews.toLocaleString()]
            .map(csvEscape)
            .join(","),
        );
      }
      lines.push(table.headers.map(csvEscape).join(","));
      lines.push(
        ...table.rows.map((r) => r.map(csvEscape).join(",")),
      );
      lines.push("");
    }
    downloadBlob(
      new Blob(["\uFEFF", lines.join("\r\n")], {
        type: "text/csv;charset=utf-8",
      }),
      `${safeBase}-${date}.csv`,
    );
    return;
  }

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await buildSummarySheet(
      workbook,
      input.branding,
      input.metrics,
      input.approvedCount,
    );
    buildDataSheet(workbook, "Submissions", input.submissionHeaders, input.submissionRows);
    buildDataSheet(workbook, "Creator-wise", input.creatorHeaders, input.creatorRows);
    buildAnalyticsSheet(workbook, input.analyticsSnapshot, "Analytics");
    const buffer = await writeExcelWorkbook(workbook);
    downloadExcelBuffer(buffer, `${safeBase}-${date}.xlsx`);
    return;
  }

  const { doc, fonts } = await createPortraitPdfDoc();
  const premiumPages = createPremiumPageTracker();
  const sectionRefs: PdfSectionRef[] = [];

  const submissionFilter = input.submissionFilter ?? "verified_or_paid";
  const submissionsSectionTitle =
    buildSubmissionsWiseSectionTitle(submissionFilter);
  const creatorsSectionTitle = buildCreatorWiseSectionTitle(submissionFilter);

  const submissionsDividerPage = doc.internal.getNumberOfPages();
  markPremiumPage(premiumPages, submissionsDividerPage);
  await renderPdfSectionDividerPage(
    doc,
    1,
    submissionsSectionTitle,
    [
      `${input.submissionRows.length.toLocaleString()} submissions · ${input.submissionHeaders.length} columns`,
      input.submissionSortLabel ?? "Sorted by Views · High → Low",
    ],
    fonts,
  );

  const submissionsDataPage = doc.internal.getNumberOfPages() + 1;
  await renderPdfDataTable(
    doc,
    input.submissionHeaders,
    input.submissionRows,
    36,
    fonts,
    submissionsSectionTitle,
    {
      cellLinks: input.submissionCellLinks,
      platform: input.platform,
    },
  );
  sectionRefs.push({
    id: "submissions",
    title: submissionsSectionTitle,
    startPage: submissionsDividerPage,
    dataStartPage: submissionsDataPage,
  });

  doc.addPage("a4", "portrait");
  const creatorsDividerPage = doc.internal.getNumberOfPages();
  markPremiumPage(premiumPages, creatorsDividerPage);
  await renderPdfSectionDividerPage(
    doc,
    2,
    creatorsSectionTitle,
    [
      `${input.creatorRows.length.toLocaleString()} creators · aggregated metrics`,
      input.creatorSortLabel ?? "Sorted by Views · High → Low",
      `${input.creatorHeaders.length} columns`,
    ],
    fonts,
  );

  const creatorsDataPage = doc.internal.getNumberOfPages() + 1;
  await renderPdfDataTable(
    doc,
    input.creatorHeaders,
    input.creatorRows,
    36,
    fonts,
    creatorsSectionTitle,
    {
      cellLinks: input.creatorCellLinks,
      platform: input.platform,
    },
  );
  sectionRefs.push({
    id: "creators",
    title: creatorsSectionTitle,
    startPage: creatorsDividerPage,
    dataStartPage: creatorsDataPage,
  });

  const analyticsSectionTitles = input.analyticsSnapshot.sections
    .map((s) => s.title)
    .join(" · ");
  const analyticsSummary = [
    analyticsSectionTitles || "Overview",
    "Top 10 Submissions by Views",
    "Top 10 Creators by Views",
  ];

  doc.addPage("a4", "portrait");
  const analyticsDividerPage = doc.internal.getNumberOfPages();
  markPremiumPage(premiumPages, analyticsDividerPage);
  await renderPdfSectionDividerPage(
    doc,
    3,
    "Analytics Overview",
    analyticsSummary,
    fonts,
  );

  doc.addPage("a4", "portrait");
  const analyticsDataPage = doc.internal.getNumberOfPages();
  await renderPdfAnalyticsSections(
    doc,
    input.analyticsSnapshot,
    36,
    fonts,
    "Analytics Overview",
    { premium: true },
  );
  for (let p = analyticsDataPage; p <= doc.internal.getNumberOfPages(); p++) {
    markPremiumPage(premiumPages, p);
  }
  sectionRefs.push({
    id: "analytics",
    title: "Analytics Overview",
    startPage: analyticsDividerPage,
    dataStartPage: analyticsDataPage,
  });

  const tocSections = sectionRefs.map((section) => ({
    title: section.title,
    pageNumber: section.startPage + PREFIX_PAGE_COUNT,
  }));

  addPdfFooters(doc, fonts, premiumPages, {
    leadingPageCount: PREFIX_PAGE_COUNT,
  });

  const bodyBytes = doc.output("arraybuffer") as ArrayBuffer;
  const { downloadPdfWithReactPrefix } = await import(
    "@/lib/report-export-pdf-cover-render"
  );
  await downloadPdfWithReactPrefix(
    bodyBytes,
    input.branding,
    input.metrics,
    `${safeBase}-${date}.pdf`,
    {
      tocSections,
      prefixPageCount: PREFIX_PAGE_COUNT,
    },
  );
}

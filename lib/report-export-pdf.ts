import type { ExportReportBranding } from "@/lib/report-export-branding";
import { GOC_PLATFORM_NAME, GOC_TAGLINE, REPORT_THEME } from "@/lib/report-export-branding";
import { resolvePdfCellLink } from "@/lib/report-export-links";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import type { ContestAnalyticsTabSnapshot } from "@/lib/contest-analytics-snapshot";
import { formatLocalDateTime } from "@/lib/utils";

const PDF_FONT_REGULAR_URL = "/fonts/Roboto-Regular.ttf";
const PDF_FONT_BOLD_URL = "/fonts/Roboto-Bold.ttf";

const LOGO_HORIZONTAL_URL = "/images/gold_logo_horizontal.png";
const LOGO_VERTICAL_URL = "/images/gold_logo_vertical.png";

const INDIGO_RGB: [number, number, number] = [79, 70, 229];
const PURPLE_DARK_RGB: [number, number, number] = [55, 32, 110];
const NAVY_RGB: [number, number, number] = [6, 2, 29];
const NAVY_MID_RGB: [number, number, number] = [23, 3, 55];
const GOLD_RGB: [number, number, number] = [201, 162, 39];
const SLATE_RGB: [number, number, number] = [160, 160, 184];
const WHITE_RGB: [number, number, number] = [255, 255, 255];

const PAGE_MARGIN = 40;

export type PdfSectionRef = {
  id: string;
  title: string;
  startPage: number;
  dataStartPage?: number;
  summaryLines?: string[];
};

export type PdfFontSet = {
  regular: string;
  bold: string;
  useUnicode: boolean;
};

type JsPdfDoc = {
  internal: {
    pageSize: { getWidth: () => number; getHeight: () => number };
    getNumberOfPages: () => number;
  };
  addPage: (format?: string | [number, number], orientation?: string) => void;
  setPage: (page: number) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { maxWidth?: number; align?: string; baseline?: string },
  ) => void;
  rect: (
    x: number,
    y: number,
    w: number,
    h: number,
    style?: string,
  ) => void;
  roundedRect?: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  ellipse?: (
    x: number,
    y: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  link: (
    x: number,
    y: number,
    w: number,
    h: number,
    options: { pageNumber?: number; url?: string },
  ) => void;
  addFileToVFS: (fileName: string, fileContent: string) => void;
  addFont: (
    postScriptName: string,
    id: string,
    fontStyle: string,
    fontWeight?: string | number,
  ) => string;
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => void;
  save: (filename: string) => void;
  getTextWidth: (text: string) => number;
  splitTextToSize: (
    text: string,
    maxWidth: number,
    options?: Record<string, unknown>,
  ) => string[];
  line?: (x1: number, y1: number, x2: number, y2: number, style?: string) => void;
};

type BrandAssets = {
  horizontalLogo: string | null;
  verticalLogo: string | null;
};

let brandAssetsCache: BrandAssets | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toLatinPdfFallback(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\t\n\r\x20-\xFF]/g, "");
}

export function normalizePdfText(
  text: string,
  preserveLineBreaks = false,
): string {
  let s = text
    .replace(/\u2014/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/gu, "");
  if (preserveLineBreaks) {
    return s
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return s.replace(/\s+/g, " ").trim();
}

function pdfText(
  text: string,
  useUnicode: boolean,
): string {
  const s = normalizePdfText(text);
  return useUnicode ? s : toLatinPdfFallback(s);
}

export function createPremiumPageTracker(): Set<number> {
  return new Set<number>();
}

export function markPremiumPage(tracker: Set<number>, pageNumber: number) {
  tracker.add(pageNumber);
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadPdfBrandAssets(): Promise<BrandAssets> {
  if (brandAssetsCache) return brandAssetsCache;
  const [horizontalLogo, verticalLogo] = await Promise.all([
    fetchImageDataUrl(LOGO_HORIZONTAL_URL),
    fetchImageDataUrl(LOGO_VERTICAL_URL),
  ]);
  brandAssetsCache = { horizontalLogo, verticalLogo };
  return brandAssetsCache;
}

export async function registerPdfUnicodeFonts(doc: JsPdfDoc): Promise<PdfFontSet> {
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch(PDF_FONT_REGULAR_URL),
      fetch(PDF_FONT_BOLD_URL),
    ]);
    if (!regularRes.ok) throw new Error("regular font failed");
    const regularBase64 = arrayBufferToBase64(await regularRes.arrayBuffer());
    doc.addFileToVFS("Roboto-Regular.ttf", regularBase64);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

    if (boldRes.ok) {
      const boldBase64 = arrayBufferToBase64(await boldRes.arrayBuffer());
      doc.addFileToVFS("Roboto-Bold.ttf", boldBase64);
      doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    }

    doc.setFont("Roboto", "normal");
    return { regular: "Roboto", bold: "Roboto", useUnicode: true };
  } catch {
    return { regular: "helvetica", bold: "helvetica", useUnicode: false };
  }
}

/** @deprecated Use registerPdfUnicodeFonts */
export async function registerPdfUnicodeFont(doc: JsPdfDoc): Promise<string> {
  const fonts = await registerPdfUnicodeFonts(doc);
  return fonts.regular;
}

export function formatCampaignDates(
  branding: ExportReportBranding,
): string | null {
  if (branding.contestStart && branding.contestEnd) {
    const start = formatLocalDateTime(branding.contestStart, {
      day: "2-digit",
      month: "short",
    });
    const end = formatLocalDateTime(branding.contestEnd, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return `${start} – ${end}`;
  }
  if (branding.durationDays != null) {
    return `${branding.durationDays} days`;
  }
  return null;
}

function drawRoundedRect(
  doc: JsPdfDoc,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: "F" | "S" | "FD" = "F",
) {
  if (doc.roundedRect) {
    doc.roundedRect(x, y, w, h, r, r, style);
    return;
  }
  doc.rect(x, y, w, h, style);
}

const WAVE_RGB: [number, number, number] = [35, 28, 90];

function drawWaveAccents(doc: JsPdfDoc, w: number, h: number) {
  const waves: Array<{ cx: number; cy: number; rx: number; ry: number }> = [
    { cx: w * 0.85, cy: h * 0.25, rx: 180, ry: 120 },
    { cx: w * 0.92, cy: h * 0.55, rx: 220, ry: 140 },
    { cx: w * 0.75, cy: h * 0.78, rx: 160, ry: 100 },
  ];
  for (const wave of waves) {
    doc.setFillColor(...WAVE_RGB);
    if (doc.ellipse) {
      doc.ellipse(wave.cx, wave.cy, wave.rx, wave.ry, "F");
    } else {
      doc.rect(wave.cx - wave.rx, wave.cy - wave.ry, wave.rx * 2, wave.ry * 2, "F");
    }
  }
}

function drawCornerFlourish(
  doc: JsPdfDoc,
  x: number,
  y: number,
  size: number,
  corner: "tl" | "tr" | "bl" | "br",
) {
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(1.2);
  const len = size;
  if (corner === "tl") {
    doc.line?.(x, y + len, x, y);
    doc.line?.(x, y, x + len, y);
  } else if (corner === "tr") {
    doc.line?.(x - len, y, x, y);
    doc.line?.(x, y, x, y + len);
  } else if (corner === "bl") {
    doc.line?.(x, y - len, x, y);
    doc.line?.(x, y, x + len, y);
  } else {
    doc.line?.(x - len, y, x, y);
    doc.line?.(x, y, x, y - len);
  }
}

export function paintPremiumPageBackground(doc: JsPdfDoc) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = PAGE_MARGIN;

  doc.setFillColor(...NAVY_RGB);
  doc.rect(0, 0, w, h, "F");

  drawWaveAccents(doc, w, h);

  const inset = margin - 10;
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(1);
  doc.rect(inset, inset, w - inset * 2, h - inset * 2, "S");

  const cornerSize = 22;
  drawCornerFlourish(doc, inset, inset, cornerSize, "tl");
  drawCornerFlourish(doc, w - inset, inset, cornerSize, "tr");
  drawCornerFlourish(doc, inset, h - inset, cornerSize, "bl");
  drawCornerFlourish(doc, w - inset, h - inset, cornerSize, "br");
}

async function drawBrandLogos(doc: JsPdfDoc, assets: BrandAssets, margin: number) {
  const w = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_RGB);
  const taglineLines = doc.splitTextToSize(GOC_TAGLINE, w - margin * 2 - 56);
  doc.text(taglineLines, margin, margin + 14);

  if (assets.verticalLogo) {
    doc.addImage(assets.verticalLogo, "PNG", w - margin - 48, margin, 48, 52);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GOLD_RGB);
    doc.text("GAME OF", w - margin - 54, margin + 18, { align: "right" });
    doc.text("CREATORS", w - margin - 54, margin + 30, { align: "right" });
  }
}

function drawSplitTitle(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  useUnicode: boolean,
  title: string,
  centerX: number,
  y: number,
): number {
  const safeTitle = pdfText(title, useUnicode);
  const performanceMatch = safeTitle.match(
    /^(.+?\s)(Performance)(\s.+)?$/i,
  );

  if (performanceMatch) {
    const before = performanceMatch[1]?.trim() ?? "";
    const perf = performanceMatch[2] ?? "Performance";
    const after = performanceMatch[3]?.trim() ?? "";

    doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
    doc.setFontSize(26);
    doc.setTextColor(...WHITE_RGB);
    if (before) {
      doc.text(before, centerX, y, { align: "center" });
      y += 30;
    }
    doc.setTextColor(...GOLD_RGB);
    doc.text(perf, centerX, y, { align: "center" });
    y += 30;
    if (after) {
      doc.setTextColor(...WHITE_RGB);
      doc.text(after, centerX, y, { align: "center" });
      y += 24;
    }
    return y;
  }

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(24);
  doc.setTextColor(...WHITE_RGB);
  doc.text(safeTitle, centerX, y, { align: "center", maxWidth: 480 });
  return y + 28;
}

function drawPillBadge(
  doc: JsPdfDoc,
  text: string,
  centerX: number,
  y: number,
): number {
  doc.setFontSize(9);
  const textWidth = doc.getTextWidth(text);
  const padX = 14;
  const pillW = textWidth + padX * 2;
  const pillH = 22;
  const pillX = centerX - pillW / 2;

  doc.setFillColor(...INDIGO_RGB);
  drawRoundedRect(doc, pillX, y - 14, pillW, pillH, 11, "F");
  doc.setTextColor(...WHITE_RGB);
  doc.text(text, centerX, y, { align: "center" });
  return y + 18;
}

function drawKpiCard(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  subtext?: string,
) {
  doc.setFillColor(...NAVY_MID_RGB);
  drawRoundedRect(doc, x, y, w, h, 6, "F");
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.8);
  drawRoundedRect(doc, x, y, w, h, 6, "S");

  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_RGB);
  doc.text(label, x + w / 2, y + 18, { align: "center" });

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GOLD_RGB);
  doc.text(value, x + w / 2, y + 38, { align: "center" });

  if (subtext) {
    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_RGB);
    doc.text(subtext, x + w / 2, y + 52, { align: "center" });
  }
}

function drawFooterBar(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  branding: ExportReportBranding,
  y: number,
) {
  const w = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;
  const colW = (w - margin * 2) / 3;

  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.6);
  doc.line?.(margin, y - 12, w - margin, y - 12);

  const cols = [
    { label: "Report Export Date", value: branding.exportedAt.split(",")[0] ?? branding.exportedAt },
    { label: "Filters Applied", value: branding.filtersApplied || branding.reportDescription || "All data" },
    { label: "Confidential", value: "For Internal Use Only" },
  ];

  cols.forEach((col, i) => {
    const cx = margin + colW * i + colW / 2;
    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_RGB);
    doc.text(col.label, cx, y, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(...WHITE_RGB);
    doc.text(pdfText(col.value, fonts.useUnicode), cx, y + 12, {
      align: "center",
      maxWidth: colW - 16,
    });
  });
}

export async function renderPdfCoverPage(
  doc: JsPdfDoc,
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  fonts: PdfFontSet,
): Promise<void> {
  try {
    const { buildCoverPageHtml, preloadHtmlReportAssets, renderHtmlPageToPdf } =
      await import("@/lib/report-export-pdf-html");
    const assets = await preloadHtmlReportAssets();
    const ok = await renderHtmlPageToPdf(
      doc,
      buildCoverPageHtml(branding, metrics, assets),
    );
    if (ok) return;
  } catch (err) {
    console.warn("[report-export] Cover HTML render failed, using fallback:", err);
  }

  await renderPdfCoverPageProcedural(doc, branding, metrics, fonts);
}

async function renderPdfCoverPageProcedural(
  doc: JsPdfDoc,
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  fonts: PdfFontSet,
): Promise<void> {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = PAGE_MARGIN;
  const assets = await loadPdfBrandAssets();

  paintPremiumPageBackground(doc);
  await drawBrandLogos(doc, assets, margin);

  let y = margin + 72;
  y = drawSplitTitle(doc, fonts, fonts.useUnicode, branding.reportTitle, w / 2, y);

  y += 8;
  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(12);
  doc.setTextColor(...SLATE_RGB);
  doc.text("Prepared for", w / 2, y, { align: "center" });
  y += 16;
  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(16);
  doc.setTextColor(...GOLD_RGB);
  doc.text(
    pdfText(branding.brandCompanyName, fonts.useUnicode),
    w / 2,
    y,
    { align: "center" },
  );

  y += 22;
  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE_RGB);
  doc.text(
    pdfText(branding.contestTitle, fonts.useUnicode),
    w / 2,
    y,
    { align: "center", maxWidth: w - margin * 2 },
  );

  y += 20;
  const pillText = pdfText(
    branding.reportDescription || branding.reportTitle,
    fonts.useUnicode,
  );
  y = drawPillBadge(doc, pillText.slice(0, 64), w / 2, y);

  y += 20;
  const dateRange = formatCampaignDates(branding);
  const cards = [
    { label: "Total Submissions", value: metrics.totalSubmissionsLabel, subtext: "Total entries received" },
    { label: "Total Views", value: metrics.totalViewsFormatted, subtext: "Across all content" },
    { label: metrics.spendLabel, value: metrics.spendFormatted, subtext: "Campaign spend" },
    {
      label: "Contest Duration",
      value: metrics.durationLabel,
      subtext: dateRange ?? undefined,
    },
  ];

  const cardW = (w - margin * 2 - 18) / 4;
  const cardH = 64;
  cards.forEach((card, i) => {
    drawKpiCard(
      doc,
      fonts,
      margin + i * (cardW + 6),
      y,
      cardW,
      cardH,
      card.label,
      card.value,
      card.subtext,
    );
  });

  if (metrics.showMarketingBlock) {
    y += cardH + 22;
    doc.setDrawColor(...GOLD_RGB);
    doc.setLineWidth(0.5);
    doc.line?.(margin + 40, y, w - margin - 40, y);
    y += 18;

    const mktItems = [
      metrics.targetCpmFormatted
        ? { label: "Target CPM", value: metrics.targetCpmFormatted }
        : null,
      metrics.effectiveCpmFormatted
        ? { label: "Effective CPM (eCPM)", value: metrics.effectiveCpmFormatted }
        : null,
      metrics.cpmEfficiency
        ? { label: "CPM Efficiency", value: metrics.cpmEfficiency }
        : null,
    ].filter(Boolean) as { label: string; value: string }[];

    const colW = (w - margin * 2) / Math.max(mktItems.length, 1);
    mktItems.forEach((item, i) => {
      const cx = margin + colW * i + colW / 2;
      doc.setFont(fonts.regular, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_RGB);
      doc.text(item.label, cx, y, { align: "center" });
      doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
      doc.setFontSize(14);
      doc.setTextColor(...GOLD_RGB);
      doc.text(item.value, cx, y + 16, { align: "center" });
    });

    if (metrics.insightSentence) {
      y += 38;
      doc.setFont(fonts.regular, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...SLATE_RGB);
      doc.text(
        pdfText(metrics.insightSentence, fonts.useUnicode),
        w / 2,
        y,
        { align: "center", maxWidth: w - margin * 2 },
      );
    }
  }

  drawFooterBar(doc, fonts, branding, h - margin - 8);
  doc.setTextColor(0, 0, 0);
}

function drawDottedLeader(
  doc: JsPdfDoc,
  x1: number,
  x2: number,
  y: number,
) {
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_RGB);
  let x = x1;
  while (x < x2 - 6) {
    doc.text(".", x, y);
    x += 5;
  }
}

export async function renderPdfIndexPage(
  doc: JsPdfDoc,
  sections: PdfSectionRef[],
  branding: ExportReportBranding,
  fonts: PdfFontSet,
  opts?: { linkPageOffset?: number },
): Promise<void> {
  const linkOffset = opts?.linkPageOffset ?? 0;
  try {
    const { buildTocPageHtml, preloadHtmlReportAssets, renderHtmlPageToPdf, TOC_LINK_LAYOUT } =
      await import("@/lib/report-export-pdf-html");
    const assets = await preloadHtmlReportAssets();
    const ok = await renderHtmlPageToPdf(
      doc,
      buildTocPageHtml(sections, branding, assets),
    );
    if (ok) {
      const w = doc.internal.pageSize.getWidth();
      sections.forEach((section, i) => {
        const y = TOC_LINK_LAYOUT.firstRowY + i * TOC_LINK_LAYOUT.rowHeight;
        doc.link(48, y, w - 96, TOC_LINK_LAYOUT.rowHeight, {
          pageNumber: section.startPage + linkOffset,
        });
      });
      return;
    }
  } catch (err) {
    console.warn("[report-export] TOC HTML render failed, using fallback:", err);
  }

  renderPdfIndexPageProcedural(doc, sections, branding, fonts, linkOffset);
}

function renderPdfIndexPageProcedural(
  doc: JsPdfDoc,
  sections: PdfSectionRef[],
  branding: ExportReportBranding,
  fonts: PdfFontSet,
  linkOffset = 0,
): void {
  const w = doc.internal.pageSize.getWidth();
  const margin = PAGE_MARGIN;
  const rowHeight = 28;

  paintPremiumPageBackground(doc);

  let y = 100;
  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(24);
  doc.setTextColor(...WHITE_RGB);
  doc.text("Table of Contents", w / 2, y, { align: "center" });

  y += 24;
  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD_RGB);
  doc.text(
    pdfText(branding.contestTitle, fonts.useUnicode),
    w / 2,
    y,
    { align: "center", maxWidth: w - margin * 2 },
  );

  y += 36;
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.5);
  doc.line?.(margin, y, w - margin, y);
  y += 24;

  sections.forEach((section, i) => {
    const title = pdfText(section.title, fonts.useUnicode);
    const label = `${i + 1}. ${title}`;
    const pageLabel = String(section.startPage);

    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE_RGB);
    doc.text(label, margin, y);

    const labelWidth = doc.getTextWidth(label);
    const pageWidth = doc.getTextWidth(pageLabel);
    const leaderStart = margin + labelWidth + 8;
    const leaderEnd = w - margin - pageWidth - 8;
    if (leaderEnd > leaderStart) {
      drawDottedLeader(doc, leaderStart, leaderEnd, y);
    }

    doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
    doc.setTextColor(...GOLD_RGB);
    doc.text(pageLabel, w - margin, y, { align: "right" });

    const linkY = y - 12;
    doc.link(margin, linkY, w - margin * 2, rowHeight, {
      pageNumber: section.startPage + linkOffset,
    });

    y += rowHeight;
  });
}

export async function renderPdfSectionDividerPage(
  doc: JsPdfDoc,
  sectionNumber: number,
  title: string,
  summaryLines: string[],
  fonts: PdfFontSet,
): Promise<void> {
  try {
    const { buildDividerPageHtml, renderHtmlPageToPdf } = await import(
      "@/lib/report-export-pdf-html"
    );
    const ok = await renderHtmlPageToPdf(
      doc,
      buildDividerPageHtml(sectionNumber, title, summaryLines),
    );
    if (ok) return;
  } catch {
    /* fallback below */
  }

  renderPdfSectionDividerPageProcedural(
    doc,
    sectionNumber,
    title,
    summaryLines,
    fonts,
  );
}

function drawSectionNumberBadge(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  centerX: number,
  topY: number,
  sectionNumber: number,
): number {
  const badgeText = String(sectionNumber).padStart(2, "0");
  const badgeW = 56;
  const badgeH = 28;
  const badgeX = centerX - badgeW / 2;

  doc.setFillColor(...PURPLE_DARK_RGB);
  drawRoundedRect(doc, badgeX, topY, badgeW, badgeH, badgeH / 2, "F");
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.6);
  drawRoundedRect(doc, badgeX, topY, badgeW, badgeH, badgeH / 2, "S");

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD_RGB);
  const textY = topY + badgeH / 2 + 4;
  const textW = doc.getTextWidth(badgeText);
  doc.text(badgeText, badgeX + (badgeW - textW) / 2, textY);
  return topY + badgeH;
}

function renderPdfSectionDividerPageProcedural(
  doc: JsPdfDoc,
  sectionNumber: number,
  title: string,
  summaryLines: string[],
  fonts: PdfFontSet,
): void {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const centerX = w / 2;

  paintPremiumPageBackground(doc);

  const blockHeight = 28 + 22 + 36 + 28 + summaryLines.length * 18;
  let y = h / 2 - blockHeight / 2;

  y = drawSectionNumberBadge(doc, fonts, centerX, y, sectionNumber) + 22;

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(title.length > 52 ? 16 : title.length > 40 ? 18 : 20);
  doc.setTextColor(...WHITE_RGB);
  doc.text(pdfText(title, fonts.useUnicode), centerX, y, {
    align: "center",
    maxWidth: w - PAGE_MARGIN * 2 - 48,
  });

  y += 28;
  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.6);
  doc.line?.(centerX - 60, y, centerX + 60, y);
  y += 20;

  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_RGB);
  for (const line of summaryLines) {
    doc.text(pdfText(line, fonts.useUnicode), centerX, y, {
      align: "center",
      maxWidth: w - PAGE_MARGIN * 2,
    });
    y += 18;
  }

  doc.setTextColor(0, 0, 0);
}

/** @deprecated Use renderPdfSectionDividerPage for branded exports */
export function renderPdfSectionHeader(
  doc: JsPdfDoc,
  title: string,
  font: string,
  useUnicode: boolean,
): number {
  const margin = 40;
  doc.setFont(font, "normal");
  doc.setFontSize(14);
  doc.setTextColor(...INDIGO_RGB);
  doc.text(pdfText(title, useUnicode), margin, 48);
  doc.setTextColor(0, 0, 0);
  return 58;
}

export function addPdfFooters(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  premiumPages: Set<number>,
  opts?: { leadingPageCount?: number },
) {
  const leading = opts?.leadingPageCount ?? 0;
  const bodyTotal = doc.internal.getNumberOfPages();
  const total = bodyTotal + leading;
  for (let i = 1; i <= bodyTotal; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const isPremium = premiumPages.has(i);

    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(8);
    if (isPremium) {
      doc.setTextColor(...SLATE_RGB);
    } else {
      doc.setTextColor(120, 120, 120);
    }
    doc.text(
      `${GOC_PLATFORM_NAME} · Confidential · Page ${i + leading} of ${total}`,
      w / 2,
      h - 18,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);
  }
}

function isTweetExportColumn(header: string): boolean {
  return /^tweet$/i.test(header.trim());
}

function estimatePdfColumnWeight(header: string): number {
  const h = header.toLowerCase();
  if (/^rank$/.test(h.trim())) return 0.85;
  if (
    /analytics|traffic sources|demographics|top countries|instagram insights/i.test(
      h,
    )
  ) {
    return 2.4;
  }
  if (isTweetExportColumn(h)) return 2.3;
  if (/link|url|content/.test(h)) return 1.6;
  if (/title|excerpt/.test(h)) return 1.9;
  if (/reason|summary/.test(h)) return 1.7;
  if (/insights status/.test(h)) return 1.35;
  if (/milestone/.test(h)) return 1.5;
  if (/reward|bonus|granted|expected|adjusted/.test(h)) return 1.25;
  if (/submitted|date|time|watch/.test(h)) return 1.15;
  if (/status/.test(h)) return 0.95;
  if (/username|creator/.test(h) && !/manual|points/.test(h)) return 1.1;
  if (
    /views|likes|comments|shares|saves|reach|points|impressions|engagement|retweets|replies|submissions/.test(
      h,
    )
  ) {
    return 0.9;
  }
  return 1;
}

function isPdfRankColumn(header: string): boolean {
  return /^rank$/i.test(header.trim());
}

function isPdfNumericColumn(header: string): boolean {
  const hl = header.toLowerCase();
  if (isPdfRankColumn(header)) return false;
  return (
    (/views|likes|comments|shares|points|impressions|rate|score|amount|submissions|reach|saves|retweets|replies|engagement/.test(
      hl,
    ) &&
      !/reason|title|link|name|username|summary|milestone|excerpt|creator/.test(
        hl,
      )) ||
    (/reward|bonus|granted|expected|adjusted/.test(hl) &&
      !/reason|summary/.test(hl))
  );
}

function getPdfLandscapeLayout(columnCount: number) {
  const marginX = 28;
  const minColWidthPt =
    columnCount > 28 ? 54 : columnCount > 20 ? 62 : columnCount > 12 ? 70 : 80;
  const neededPageWidth = columnCount * minColWidthPt + marginX * 2;

  let pageWidth = 842;
  let pageFormat: string | [number, number] = "a4";

  if (neededPageWidth <= 842) {
    if (columnCount <= 4) {
      pageWidth = 842;
      pageFormat = "a4";
    } else {
      pageWidth = 1191;
      pageFormat = "a3";
    }
  } else if (neededPageWidth <= 1191) {
    pageWidth = 1191;
    pageFormat = "a3";
  } else if (neededPageWidth <= 1684) {
    pageWidth = 1684;
    pageFormat = "a2";
  } else if (neededPageWidth <= 2384) {
    pageWidth = 2384;
    pageFormat = "a1";
  } else {
    pageWidth = Math.min(neededPageWidth, 3400);
    pageFormat = [pageWidth, 595];
  }

  return {
    pageFormat,
    pageWidth,
    tableWidth: pageWidth - marginX * 2,
    marginX,
  };
}

function buildPdfColumnStyles(headers: string[], tableWidth: number) {
  const weights = headers.map((h) => estimatePdfColumnWeight(h));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;
  const styles: Record<
    number,
    { cellWidth: number; overflow: "linebreak"; halign: "left" | "right" | "center" }
  > = {};
  headers.forEach((header, colIndex) => {
    styles[colIndex] = {
      cellWidth: (weights[colIndex]! / weightSum) * tableWidth,
      overflow: "linebreak",
      halign: isPdfRankColumn(header)
        ? "center"
        : isPdfNumericColumn(header)
          ? "right"
          : "left",
    };
  });
  return styles;
}

function pickPdfFontSize(columnCount: number, pageWidth: number): number {
  const colWidth = (pageWidth - 56) / Math.max(columnCount, 1);
  if (colWidth >= 90) return 9;
  if (colWidth >= 72) return 8;
  if (columnCount > 28) return 6;
  if (columnCount > 22) return 6.5;
  if (columnCount > 16) return 7;
  if (columnCount > 10) return 7.5;
  return 8;
}

function pickPdfCellPadding(columnCount: number): number {
  if (columnCount > 22) return 2;
  if (columnCount > 14) return 3;
  return 4;
}

function preparePdfBodyCell(
  cell: string,
  maxLen: number,
  useUnicodeFont: boolean,
  preserveLineBreaks = false,
): string {
  let s = normalizePdfText(cell, preserveLineBreaks);
  if (!useUnicodeFont) s = toLatinPdfFallback(s);
  if (!s) return "";
  if (preserveLineBreaks && maxLen >= 4000) return s;
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function wrapPdfHeaderLabel(
  header: string,
  colWidthPt: number,
  fontSizePt: number,
): string {
  const padding = 8;
  const approxCharWidth = Math.max(2.5, fontSizePt * 0.48);
  const charsPerLine = Math.max(
    3,
    Math.floor((colWidthPt - padding) / approxCharWidth),
  );
  if (header.length <= charsPerLine) return header;
  const words = header.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > charsPerLine ? word.slice(0, charsPerLine) : word;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export async function renderPdfDataTable(
  doc: JsPdfDoc,
  headers: string[],
  rows: string[][],
  startY: number,
  fonts: PdfFontSet,
  sectionLabel?: string,
  options?: {
    cellLinks?: (string | null)[][];
    platform?: string;
  },
): Promise<number> {
  const autoTable = (await import("jspdf-autotable")).default;
  const colCount = headers.length;
  const layout = getPdfLandscapeLayout(colCount);
  const currentW = doc.internal.pageSize.getWidth();

  if (currentW < layout.pageWidth - 10) {
    doc.addPage(layout.pageFormat, "landscape");
    startY = 36;
  }

  if (sectionLabel) {
    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(pdfText(sectionLabel, fonts.useUnicode), layout.marginX, startY - 8);
    doc.setTextColor(0, 0, 0);
  }

  const marginX = layout.marginX;
  const tableWidth = layout.tableWidth;
  const avgColWidth = tableWidth / Math.max(colCount, 1);
  const fontSize = pickPdfFontSize(colCount, layout.pageWidth);
  const cellPadding = pickPdfCellPadding(colCount);
  const columnStyles = buildPdfColumnStyles(headers, tableWidth);
  const headFontSize = Math.max(5, fontSize);

  const pdfHeaders = headers.map((h, i) => {
    const colWidth = columnStyles[i]?.cellWidth ?? avgColWidth;
    return wrapPdfHeaderLabel(h, colWidth, headFontSize);
  });

  const pdfBody = rows.map((row) =>
    row.map((cell, i) => {
      const header = headers[i] ?? "";
      const colWidth = columnStyles[i]?.cellWidth ?? avgColWidth;
      const isLongCol =
        /analytics|traffic sources|demographics|top countries|instagram insights|insights status/i.test(
          header,
        ) || isTweetExportColumn(header);
      return preparePdfBodyCell(
        cell,
        isLongCol ? 4000 : 120,
        fonts.useUnicode,
        isLongCol,
      );
    }),
  );

  autoTable(doc as never, {
    head: [pdfHeaders],
    body: pdfBody,
    startY,
    tableWidth,
    showHead: "everyPage",
    styles: {
      font: fonts.regular,
      fontStyle: "normal",
      fontSize,
      cellPadding,
      overflow: "linebreak",
      valign: "top",
      lineWidth: 0.1,
      lineColor: [210, 210, 210],
    },
    headStyles: {
      font: fonts.regular,
      fontStyle: "normal",
      fillColor: INDIGO_RGB,
      textColor: 255,
      fontSize: headFontSize,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
    },
    columnStyles,
    margin: { left: marginX, right: marginX, bottom: 32 },
    tableLineWidth: 0.1,
    tableLineColor: [210, 210, 210],
    willDrawCell: (data) => {
      if (data.section !== "body") return;
      const header = headers[data.column.index] ?? "";
      const raw = rows[data.row.index]?.[data.column.index] ?? "";
      const linkUrl = resolvePdfCellLink(
        data.row.index,
        data.column.index,
        header,
        raw,
        options?.cellLinks,
        options?.platform,
      );
      if (!linkUrl) return;
      data.cell.styles.textColor = [0, 102, 204];
    },
    didDrawCell: (data) => {
      if (data.section !== "body") return;
      const header = headers[data.column.index] ?? "";
      const raw = rows[data.row.index]?.[data.column.index] ?? "";
      const linkUrl = resolvePdfCellLink(
        data.row.index,
        data.column.index,
        header,
        raw,
        options?.cellLinks,
        options?.platform,
      );
      if (!linkUrl) return;
      doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, {
        url: linkUrl,
      });
    },
  });

  return (
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      ?.finalY ?? startY
  );
}

async function drawPremiumAnalyticsHeader(
  doc: JsPdfDoc,
  fonts: PdfFontSet,
  tabLabel: string,
): Promise<number> {
  paintPremiumPageBackground(doc);
  const assets = await loadPdfBrandAssets();
  const margin = PAGE_MARGIN;
  const w = doc.internal.pageSize.getWidth();

  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.6);
  doc.roundedRect?.(margin, margin, w - margin * 2, 52, 4, 4, "S");

  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_RGB);
  doc.text("REPORT BY", margin + 12, margin + 12);

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD_RGB);
  doc.text(GOC_PLATFORM_NAME, margin + 12, margin + 24);

  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...WHITE_RGB);
  const taglineLines = doc.splitTextToSize(GOC_TAGLINE, w - margin * 2 - 72);
  doc.text(taglineLines, margin + 12, margin + 34);

  if (assets.verticalLogo) {
    doc.addImage(assets.verticalLogo, "PNG", w - margin - 44, margin + 6, 40, 44);
  }

  const centerX = w / 2;
  let y = margin + 68;

  doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE_RGB);
  doc.text("Analytics Overview", centerX, y, { align: "center" });
  y += 22;

  doc.setFont(fonts.regular, "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GOLD_RGB);
  doc.text(pdfText(tabLabel, fonts.useUnicode), centerX, y, { align: "center" });
  y += 14;

  doc.setDrawColor(...GOLD_RGB);
  doc.setLineWidth(0.8);
  doc.line?.(centerX - 60, y, centerX + 60, y);
  return y + 18;
}

function premiumAnalyticsTableOptions(
  fonts: PdfFontSet,
  marginX: number,
) {
  return {
    theme: "plain" as const,
    styles: {
      font: fonts.regular,
      fontStyle: "normal" as const,
      fontSize: 8,
      cellPadding: 4,
      textColor: [40, 40, 55] as [number, number, number],
      lineColor: [201, 162, 39] as [number, number, number],
      lineWidth: 0.15,
      fillColor: [255, 255, 255] as [number, number, number],
    },
    headStyles: {
      font: fonts.bold,
      fontStyle: "bold" as const,
      fillColor: PURPLE_DARK_RGB,
      textColor: 255,
      fontSize: 8,
      halign: "left" as const,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249] as [number, number, number],
    },
    margin: { left: marginX, right: marginX, bottom: 40 },
  };
}

async function renderPdfAnalyticsSectionsProcedural(
  doc: JsPdfDoc,
  snapshot: ContestAnalyticsTabSnapshot,
  fonts: PdfFontSet,
): Promise<number> {
  const autoTable = (await import("jspdf-autotable")).default;
  const marginX = PAGE_MARGIN;
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerReserve = 72;
  let y = await drawPremiumAnalyticsHeader(doc, fonts, snapshot.tabLabel);

  for (const section of snapshot.sections) {
    if (y > pageHeight - footerReserve) {
      doc.addPage();
      paintPremiumPageBackground(doc);
      y = 88;
      doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
      doc.setFontSize(14);
      doc.setTextColor(...WHITE_RGB);
      doc.text("Analytics Overview (continued)", marginX, y);
      y += 16;
      doc.setFont(fonts.regular, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GOLD_RGB);
      doc.text(pdfText(snapshot.tabLabel, fonts.useUnicode), marginX, y);
      y += 14;
    }

    doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD_RGB);
    doc.text(section.title.toUpperCase(), marginX, y);
    y += 10;

    autoTable(doc as never, {
      head: [["Metric", "Value"]],
      body: section.rows,
      startY: y,
      ...premiumAnalyticsTableOptions(fonts, marginX),
      columnStyles: {
        0: { cellWidth: 220 },
        1: { halign: "right" },
      },
    });
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 12;
  }

  doc.addPage();
  paintPremiumPageBackground(doc);
  y = 88;

  const distributionTables = [
    snapshot.viewsDistributionBySubmission,
    snapshot.viewsDistributionByCreator,
  ];

  for (let i = 0; i < distributionTables.length; i++) {
    if (i > 0) {
      doc.addPage();
      paintPremiumPageBackground(doc);
      y = 88;
    }

    const table = distributionTables[i]!;
    doc.setFont(fonts.bold, fonts.useUnicode ? "bold" : "bold");
    doc.setFontSize(18);
    doc.setTextColor(...WHITE_RGB);
    doc.text(table.title, doc.internal.pageSize.getWidth() / 2, y, {
      align: "center",
    });
    y += 18;
    doc.setFont(fonts.regular, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD_RGB);
    doc.text(
      pdfText(snapshot.tabLabel, fonts.useUnicode),
      doc.internal.pageSize.getWidth() / 2,
      y,
      { align: "center" },
    );
    y += 14;

    const isSubmissionTable =
      table === snapshot.viewsDistributionBySubmission;
    const summaryLines: string[] = [];
    if (isSubmissionTable && table.combinedViews != null) {
      summaryLines.push(
        `Top 10 Submissions Combined Views: ${table.combinedViews.toLocaleString()}`,
      );
    } else if (!isSubmissionTable) {
      if (table.combinedViews != null) {
        summaryLines.push(
          `Top 10 Creators Combined Views: ${table.combinedViews.toLocaleString()}`,
        );
      }
      if (table.combinedPosts != null) {
        summaryLines.push(
          `Top 10 Creators Combined Posts: ${table.combinedPosts.toLocaleString()}`,
        );
      }
    }

    for (const line of summaryLines) {
      doc.setFontSize(8);
      doc.setTextColor(...SLATE_RGB);
      doc.text(
        pdfText(line, fonts.useUnicode),
        doc.internal.pageSize.getWidth() / 2,
        y,
        { align: "center" },
      );
      y += 12;
    }

    autoTable(doc as never, {
      head: [table.headers],
      body: table.rows,
      startY: y,
      ...premiumAnalyticsTableOptions(fonts, marginX),
      headStyles: {
        ...premiumAnalyticsTableOptions(fonts, marginX).headStyles,
        halign: "center" as const,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 36 },
      },
    });
  }

  return (
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 14
  );
}

export async function renderPdfAnalyticsSections(
  doc: JsPdfDoc,
  snapshot: ContestAnalyticsTabSnapshot,
  _startY: number,
  fonts: PdfFontSet,
  _sectionLabel?: string,
  options?: { premium?: boolean },
): Promise<number> {
  const usePremium = options?.premium !== false;

  if (usePremium && typeof document !== "undefined") {
    try {
      const {
        buildAnalyticsSummaryPagesHtml,
        preloadHtmlReportAssets,
        renderHtmlPageToPdf,
      } = await import("@/lib/report-export-pdf-html");
      const assets = await preloadHtmlReportAssets();
      const pages = buildAnalyticsSummaryPagesHtml(snapshot, assets);
      let rendered = false;
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) doc.addPage();
        const ok = await renderHtmlPageToPdf(doc, pages[i]!);
        if (!ok) {
          rendered = false;
          break;
        }
        rendered = true;
      }
      if (rendered) return doc.internal.pageSize.getHeight() - 40;
    } catch {
      /* fallback below */
    }
  }

  return renderPdfAnalyticsSectionsProcedural(doc, snapshot, fonts);
}

export async function createPortraitPdfDoc(): Promise<{
  doc: JsPdfDoc;
  fonts: PdfFontSet;
}> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  }) as unknown as JsPdfDoc;
  const fonts = await registerPdfUnicodeFonts(doc);
  return { doc, fonts };
}

export { REPORT_THEME };

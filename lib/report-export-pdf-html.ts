import type { ExportReportBranding } from "@/lib/report-export-branding";
import { GOC_TAGLINE } from "@/lib/report-export-branding";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import type {
  ContestAnalyticsSnapshotSection,
  ContestAnalyticsTabSnapshot,
  ViewsDistributionTable,
} from "@/lib/contest-analytics-snapshot";
import { formatLocalDateTime } from "@/lib/utils";

export type HtmlTocSection = {
  title: string;
  startPage: number;
};

export type HtmlReportAssets = {
  verticalLogoDataUrl: string | null;
};

export const TOC_LINK_LAYOUT = {
  firstRowY: 228,
  rowHeight: 34,
} as const;

const PAGE_W = 595;
const PAGE_H = 842;

const VERTICAL_LOGO_PATH = "/images/gold_logo_vertical.png";

function assetUrl(path: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export async function preloadHtmlReportAssets(): Promise<HtmlReportAssets> {
  let verticalLogoDataUrl: string | null = null;
  try {
    const res = await fetch(assetUrl(VERTICAL_LOGO_PATH));
    if (res.ok) {
      const blob = await res.blob();
      verticalLogoDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    /* optional asset */
  }
  return { verticalLogoDataUrl };
}

function formatCampaignDates(branding: ExportReportBranding): string | null {
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandTaglineHtml(): string {
  return `<div class="brand-tagline">${escapeHtml(GOC_TAGLINE)}</div>`;
}

function cornerOrnamentSvg(): string {
  return `<svg class="ornament ornament-tl" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 44 L4 4 L44 4" fill="none" stroke="#c9a227" stroke-width="1.5"/>
    <path d="M8 38 Q4 28 14 8" fill="none" stroke="#c9a227" stroke-width="1" opacity="0.85"/>
    <circle cx="14" cy="8" r="2" fill="#c9a227"/>
  </svg>
  <svg class="ornament ornament-tr" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4 L44 4 L44 44" fill="none" stroke="#c9a227" stroke-width="1.5"/>
    <path d="M40 38 Q44 28 34 8" fill="none" stroke="#c9a227" stroke-width="1" opacity="0.85"/>
    <circle cx="34" cy="8" r="2" fill="#c9a227"/>
  </svg>
  <svg class="ornament ornament-bl" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4 L4 44 L44 44" fill="none" stroke="#c9a227" stroke-width="1.5"/>
    <path d="M8 10 Q4 20 14 40" fill="none" stroke="#c9a227" stroke-width="1" opacity="0.85"/>
    <circle cx="14" cy="40" r="2" fill="#c9a227"/>
  </svg>
  <svg class="ornament ornament-br" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M44 4 L44 44 L4 44" fill="none" stroke="#c9a227" stroke-width="1.5"/>
    <path d="M40 10 Q44 20 34 40" fill="none" stroke="#c9a227" stroke-width="1" opacity="0.85"/>
    <circle cx="34" cy="40" r="2" fill="#c9a227"/>
  </svg>`;
}

function waveSvg(): string {
  return `<svg class="waves" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wg1" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0"/>
        <stop offset="40%" stop-color="#818cf8" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="wg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7c3aed" stop-opacity="0"/>
        <stop offset="50%" stop-color="#6366f1" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="#c084fc" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M380 60 C480 100, 560 180, 545 300 S460 460, 510 600 S590 740, 470 810" fill="none" stroke="url(#wg1)" stroke-width="2.5"/>
    <path d="M450 30 C540 80, 610 160, 580 280 S490 420, 530 560 S610 700, 490 780" fill="none" stroke="url(#wg2)" stroke-width="2"/>
    <path d="M320 180 C400 220, 470 300, 440 400 S360 540, 400 660" fill="none" stroke="url(#wg1)" stroke-width="1.5" opacity="0.6"/>
    <ellipse cx="520" cy="380" rx="140" ry="100" fill="#6366f1" opacity="0.06"/>
    <ellipse cx="480" cy="520" rx="180" ry="120" fill="#7c3aed" opacity="0.05"/>
  </svg>`;
}

const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .page {
    width: ${PAGE_W}px;
    height: ${PAGE_H}px;
    position: relative;
    overflow: hidden;
    font-family: Inter, "Segoe UI", system-ui, sans-serif;
    color: #fff;
    background: #06021d;
  }
  .waves { position: absolute; inset: 0; pointer-events: none; }
  .flare-tl, .flare-br {
    position: absolute;
    width: 320px;
    height: 320px;
    pointer-events: none;
    background: linear-gradient(135deg, rgba(212,175,55,0.22) 0%, transparent 50%);
  }
  .flare-tl { top: -60px; left: -60px; }
  .flare-br { bottom: -60px; right: -60px; transform: rotate(180deg); }
  .frame {
    position: absolute;
    inset: 26px;
    border: 1px solid rgba(201, 162, 39, 0.9);
    pointer-events: none;
  }
  .ornament { position: absolute; width: 42px; height: 42px; pointer-events: none; }
  .ornament-tl { top: 22px; left: 22px; }
  .ornament-tr { top: 22px; right: 22px; }
  .ornament-bl { bottom: 22px; left: 22px; }
  .ornament-br { bottom: 22px; right: 22px; }
  .logo-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 42px 46px 0;
    position: relative;
    z-index: 2;
  }
  .brand-tagline {
    flex: 1;
    max-width: 360px;
    font-size: 10px;
    line-height: 1.35;
    color: #c8c8dc;
    padding-right: 16px;
  }
  .logo-right { height: 56px; width: auto; display: block; object-fit: contain; }
`;

function iconSvg(name: string): string {
  const icons: Record<string, string> = {
    users: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    eye: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    trophy: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
    calendar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
    funnel: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>`,
    lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.8"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  };
  return icons[name] ?? "";
}

function splitReportTitle(title: string): { line1: string; line2: string; line3: string } {
  const m = title.match(/^(.+?)\s+(Performance)\s+(.+)$/i);
  if (m) {
    return { line1: m[1]!, line2: m[2]!, line3: m[3]! };
  }
  return { line1: title, line2: "", line3: "" };
}

function pageShell(inner: string, extraStyles: string): string {
  return `<div class="page">
    ${waveSvg()}
    <div class="frame"></div>
    ${cornerOrnamentSvg()}
    <div class="flare-tl"></div>
    <div class="flare-br"></div>
    ${inner}
  </div>
  <style>${BASE_STYLES}${extraStyles}</style>`;
}

export function buildCoverPageHtml(
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  assets: HtmlReportAssets,
): string {
  const title = splitReportTitle(branding.reportTitle);
  const dateRange = formatCampaignDates(branding);
  const exportDate = branding.exportedAt.split(",")[0]?.trim() ?? branding.exportedAt;
  const filters = branding.filtersApplied || branding.reportDescription || "All data";
  const pill = branding.reportDescription || branding.reportTitle;

  const spendSubtext = metrics.spendLabel.toLowerCase().includes("paid")
    ? "Total amount paid"
    : "Total prize pool";

  const cards = [
    { icon: "users", label: "Total Submissions", value: metrics.totalSubmissionsLabel, sub: "Total entries received" },
    { icon: "eye", label: "Total Views", value: metrics.totalViewsFormatted, sub: "Across all content" },
    { icon: "trophy", label: metrics.spendLabel, value: metrics.spendFormatted, sub: spendSubtext },
    {
      icon: "calendar",
      label: "Contest Duration",
      value: metrics.durationLabel.replace(/\bdays\b/i, "Days"),
      sub: dateRange ?? "",
    },
  ];

  const titleHtml = title.line2
    ? `<div class="title-line t1">${escapeHtml(title.line1)}</div>
       <div class="title-line t2 gold">${escapeHtml(title.line2)}</div>
       <div class="title-line t3">${escapeHtml(title.line3)}</div>`
    : `<div class="title-line t2">${escapeHtml(title.line1)}</div>`;

  const cardsHtml = cards
    .map(
      (c) => `
      <div class="kpi-card">
        <div class="kpi-icon">${iconSvg(c.icon)}</div>
        <div class="kpi-label">${escapeHtml(c.label)}</div>
        <div class="kpi-value">${escapeHtml(c.value)}</div>
        ${c.sub ? `<div class="kpi-sub">${escapeHtml(c.sub)}</div>` : ""}
      </div>`,
    )
    .join("");

  const marketingHtml = metrics.showMarketingBlock
    ? `<div class="marketing">
        <div class="marketing-rule"></div>
        <div class="marketing-cols">
          ${metrics.targetCpmFormatted ? `<div class="mkt-item"><div class="mkt-label">Target CPM</div><div class="mkt-value">${escapeHtml(metrics.targetCpmFormatted)}</div></div>` : ""}
          ${metrics.effectiveCpmFormatted ? `<div class="mkt-item"><div class="mkt-label">Effective CPM (eCPM)</div><div class="mkt-value">${escapeHtml(metrics.effectiveCpmFormatted)}</div></div>` : ""}
          ${metrics.cpmEfficiency ? `<div class="mkt-item"><div class="mkt-label">CPM Efficiency</div><div class="mkt-value">${escapeHtml(metrics.cpmEfficiency)}</div></div>` : ""}
        </div>
        ${metrics.insightSentence ? `<div class="mkt-insight">${escapeHtml(metrics.insightSentence)}</div>` : ""}
      </div>`
    : "";

  const rightLogo = assets.verticalLogoDataUrl
    ? `<img class="logo-right" src="${assets.verticalLogoDataUrl}" alt="Game of Creators"/>`
    : `<div class="logo-right-fallback">GAME OF<br/>CREATORS</div>`;

  const extraStyles = `
    .hero { text-align: center; padding: 20px 46px 0; position: relative; z-index: 2; }
    .title-line { font-weight: 700; letter-spacing: -0.02em; color: #fff; line-height: 1.1; }
    .title-line.t1 { font-size: 30px; margin-bottom: 2px; }
    .title-line.t2 { font-size: 38px; margin-bottom: 2px; }
    .title-line.t3 { font-size: 38px; }
    .title-line.gold { color: #d4af37; }
    .prepared { margin-top: 20px; font-size: 13px; color: #b8b8cc; font-weight: 400; }
    .brand { margin-top: 5px; font-size: 19px; font-weight: 700; color: #d4af37; }
    .divider {
      margin: 16px auto 14px;
      width: 340px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a227 18%, #c9a227 82%, transparent);
      position: relative;
    }
    .divider::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
      width: 8px;
      height: 8px;
      background: #c9a227;
    }
    .campaign { font-size: 15px; font-weight: 600; color: #fff; max-width: 480px; margin: 0 auto; line-height: 1.4; }
    .pill {
      display: inline-block;
      margin-top: 12px;
      padding: 8px 20px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(88, 55, 168, 0.95) 0%, rgba(55, 35, 110, 0.95) 100%);
      border: 1px solid rgba(139, 92, 246, 0.4);
      font-size: 11px;
      color: #ececf4;
      max-width: 440px;
    }
    .kpi-row {
      display: flex;
      gap: 9px;
      padding: 22px 38px 0;
      position: relative;
      z-index: 2;
    }
    .kpi-card {
      flex: 1;
      min-height: 112px;
      padding: 12px 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(201, 162, 39, 0.55);
      background: linear-gradient(180deg, rgba(35, 15, 65, 0.75) 0%, rgba(18, 8, 40, 0.85) 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
      text-align: center;
    }
    .kpi-icon { display: flex; justify-content: center; margin-bottom: 5px; }
    .kpi-label { font-size: 9px; color: #c8c8dc; margin-bottom: 3px; line-height: 1.2; }
    .kpi-value { font-size: 19px; font-weight: 700; color: #d4af37; line-height: 1.1; word-break: break-word; }
    .kpi-sub { font-size: 8px; color: #9494b0; margin-top: 4px; line-height: 1.2; }
    .marketing { padding: 16px 46px 0; text-align: center; position: relative; z-index: 2; }
    .marketing-rule { height: 1px; background: linear-gradient(90deg, transparent, rgba(201,162,39,0.6) 20%, rgba(201,162,39,0.6) 80%, transparent); margin-bottom: 14px; }
    .marketing-cols { display: flex; justify-content: center; gap: 36px; }
    .mkt-label { font-size: 9px; color: #a0a0b8; margin-bottom: 4px; }
    .mkt-value { font-size: 16px; font-weight: 700; color: #d4af37; }
    .mkt-insight { margin-top: 10px; font-size: 9px; color: #a0a0b8; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.4; }
    .footer {
      position: absolute;
      left: 46px;
      right: 46px;
      bottom: 48px;
      z-index: 2;
    }
    .footer-rule {
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a227 12%, #c9a227 88%, transparent);
      margin-bottom: 14px;
    }
    .footer-cols { display: flex; }
    .footer-col {
      flex: 1;
      text-align: center;
      padding: 0 6px;
      border-right: 1px solid rgba(201, 162, 39, 0.3);
    }
    .footer-col:last-child { border-right: none; }
    .footer-icon { display: flex; justify-content: center; margin-bottom: 5px; }
    .footer-label { font-size: 9px; color: #a0a0b8; margin-bottom: 2px; }
    .footer-value { font-size: 10px; font-weight: 600; color: #fff; line-height: 1.35; }
    .logo-right-fallback { text-align: right; font-size: 9px; color: #d4af37; line-height: 1.3; font-weight: 700; }
  `;

  const inner = `
    <div class="logo-row">
      ${brandTaglineHtml()}
      ${rightLogo}
    </div>
    <div class="hero">
      ${titleHtml}
      <div class="prepared">Prepared for</div>
      <div class="brand">${escapeHtml(branding.brandCompanyName)}</div>
      <div class="divider"></div>
      <div class="campaign">${escapeHtml(branding.contestTitle)}</div>
      <div class="pill">${escapeHtml(pill.slice(0, 72))}</div>
    </div>
    <div class="kpi-row">${cardsHtml}</div>
    ${marketingHtml}
    <div class="footer">
      <div class="footer-rule"></div>
      <div class="footer-cols">
        <div class="footer-col">
          <div class="footer-icon">${iconSvg("calendar")}</div>
          <div class="footer-label">Report Export Date</div>
          <div class="footer-value">${escapeHtml(exportDate)}</div>
        </div>
        <div class="footer-col">
          <div class="footer-icon">${iconSvg("funnel")}</div>
          <div class="footer-label">Filters Applied</div>
          <div class="footer-value">${escapeHtml(filters)}</div>
        </div>
        <div class="footer-col">
          <div class="footer-icon">${iconSvg("lock")}</div>
          <div class="footer-label">Confidential</div>
          <div class="footer-value">For Internal Use Only</div>
        </div>
      </div>
    </div>`;

  return pageShell(inner, extraStyles);
}

export function buildTocPageHtml(
  sections: HtmlTocSection[],
  branding: ExportReportBranding,
  assets: HtmlReportAssets,
): string {
  const rows = sections
    .map((section, i) => {
      const label = `${i + 1}. ${section.title}`;
      return `
        <div class="toc-row">
          <span class="toc-title">${escapeHtml(label)}</span>
          <span class="toc-dots"></span>
          <span class="toc-page">${section.startPage}</span>
        </div>`;
    })
    .join("");

  const rightLogo = assets.verticalLogoDataUrl
    ? `<img class="logo-right" src="${assets.verticalLogoDataUrl}" alt=""/>`
    : "";

  const extraStyles = `
    .content { padding: 88px 52px 48px; position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
    .toc-heading { text-align: center; font-size: 30px; font-weight: 700; margin-bottom: 10px; width: 100%; }
    .toc-sub { text-align: center; font-size: 13px; color: #d4af37; margin-bottom: 28px; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.35; }
    .toc-rule { height: 1px; width: 100%; max-width: 480px; background: linear-gradient(90deg, transparent, #c9a227 10%, #c9a227 90%, transparent); margin-bottom: 22px; }
    .toc-list { width: 100%; max-width: 480px; }
    .toc-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 20px; font-size: 12px; }
    .toc-title { color: #fff; flex: 1; text-align: left; line-height: 1.35; }
    .toc-dots { flex: 0 0 24px; border-bottom: 1px dotted rgba(160, 160, 184, 0.65); min-width: 20px; margin-bottom: 4px; }
    .toc-page { color: #d4af37; font-weight: 700; min-width: 28px; text-align: right; flex-shrink: 0; }
    .mini-logos { display: flex; justify-content: space-between; padding: 42px 46px 0; position: relative; z-index: 2; }
  `;

  const inner = `
    <div class="mini-logos">${brandTaglineHtml()}${rightLogo}</div>
    <div class="content">
      <div class="toc-heading">Table of Contents</div>
      <div class="toc-sub">${escapeHtml(branding.contestTitle)}</div>
      <div class="toc-rule"></div>
      <div class="toc-list">${rows}</div>
    </div>`;

  return pageShell(inner, extraStyles);
}

function renderMetricSectionHtml(
  title: string,
  rows: [string, string][],
): string {
  const body = rows
    .map(
      ([metric, value]) => `
      <tr>
        <td class="metric-name">${escapeHtml(metric)}</td>
        <td class="metric-value">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");

  return `
    <div class="analytics-section">
      <div class="section-title">${escapeHtml(title)}</div>
      <table class="analytics-table metric-table">
        <thead>
          <tr><th>Metric</th><th>Value</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderDistributionTableHtml(
  table: ViewsDistributionTable,
  options?: { isLast?: boolean; variant?: "submission" | "creator" },
): string {
  const head = table.headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join("")}</tr>`,
    )
    .join("");

  const lastClass = options?.isLast ? " analytics-section-last" : "";
  const summaryLines: string[] = [];
  if (options?.variant === "submission" && table.combinedViews != null) {
    summaryLines.push(
      `Top 10 Submissions Combined Views: ${table.combinedViews.toLocaleString()}`,
    );
  }
  if (options?.variant === "creator") {
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
  const combinedNote = summaryLines
    .map((line) => `<div class="distribution-note">${escapeHtml(line)}</div>`)
    .join("");

  return `
    <div class="analytics-section${lastClass}">
      <div class="section-title">${escapeHtml(table.title)}</div>
      ${combinedNote}
      <table class="analytics-table distribution-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderReportBrandBarHtml(
  assets: HtmlReportAssets,
  options?: { compact?: boolean },
): string {
  const compact = options?.compact === true;
  const rightLogo = assets.verticalLogoDataUrl
    ? `<img class="brand-logo" src="${assets.verticalLogoDataUrl}" alt="Game of Creators"/>`
    : `<div class="brand-logo-fallback">GAME OF<br/>CREATORS</div>`;

  return `
    <div class="report-brand-bar${compact ? " report-brand-bar-compact" : ""}">
      <div class="report-brand-copy">
        <div class="report-by">Report by</div>
        <div class="report-brand-name">Game of Creators</div>
        <div class="report-tagline">${escapeHtml(GOC_TAGLINE)}</div>
      </div>
      ${rightLogo}
    </div>`;
}

function paginateAnalyticsMetricSections(
  sections: ContestAnalyticsSnapshotSection[],
): ContestAnalyticsSnapshotSection[][] {
  if (sections.length === 0) return [[]];
  if (sections.length === 1) return [sections];

  const campaignMetricsIndex = sections.findIndex(
    (section) => section.title === "Campaign Metrics",
  );
  if (campaignMetricsIndex >= 0) {
    return [
      sections.slice(0, campaignMetricsIndex + 1),
      sections.slice(campaignMetricsIndex + 1),
    ].filter((page) => page.length > 0);
  }

  const splitAt = Math.ceil(sections.length / 2);
  return [sections.slice(0, splitAt), sections.slice(splitAt)];
}

const ANALYTICS_PAGE_STYLES = `
  .content {
    position: relative;
    z-index: 2;
    padding: 0 44px 32px;
  }
  .report-brand-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin: 34px 44px 0;
    padding: 14px 18px;
    position: relative;
    z-index: 2;
    border: 1px solid rgba(201, 162, 39, 0.55);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(23, 3, 55, 0.72) 0%, rgba(6, 2, 29, 0.55) 100%);
  }
  .report-brand-bar-compact {
    margin-top: 28px;
    padding: 10px 16px;
  }
  .report-brand-copy {
    flex: 1;
    min-width: 0;
  }
  .report-by {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #a0a0b8;
    margin-bottom: 4px;
  }
  .report-brand-name {
    font-size: 16px;
    font-weight: 700;
    color: #d4af37;
    line-height: 1.2;
    margin-bottom: 5px;
  }
  .report-brand-bar-compact .report-brand-name {
    font-size: 14px;
  }
  .report-tagline {
    font-size: 8.5px;
    line-height: 1.4;
    color: #ececf4;
    max-width: 360px;
  }
  .report-brand-bar-compact .report-tagline {
    font-size: 8px;
  }
  .brand-logo {
    height: 58px;
    width: auto;
    display: block;
    object-fit: contain;
    flex-shrink: 0;
  }
  .report-brand-bar-compact .brand-logo {
    height: 48px;
  }
  .brand-logo-fallback {
    font-size: 9px;
    font-weight: 700;
    line-height: 1.25;
    color: #d4af37;
    text-align: right;
    flex-shrink: 0;
  }
  .hero {
    text-align: center;
    padding: 16px 12px 12px;
  }
  .hero-title {
    font-size: 26px;
    font-weight: 700;
    color: #fff;
    line-height: 1.15;
    margin-bottom: 6px;
  }
  .hero-sub {
    font-size: 11px;
    font-weight: 600;
    color: #d4af37;
    letter-spacing: 0.02em;
  }
  .hero-rule {
    width: 120px;
    height: 2px;
    background: #c9a227;
    margin: 12px auto 0;
  }
  .analytics-section {
    margin-bottom: 12px;
  }
  .analytics-section-last {
    margin-bottom: 0;
  }
  .section-title {
    font-size: 10px;
    font-weight: 700;
    color: #d4af37;
    margin-bottom: 5px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
  .analytics-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    border: 1px solid rgba(201, 162, 39, 0.35);
    border-radius: 6px;
    overflow: hidden;
  }
  .analytics-table th {
    background: linear-gradient(180deg, #37206e 0%, #231045 100%);
    color: #fff;
    padding: 6px 10px;
    text-align: left;
    font-weight: 700;
  }
  .metric-table th:last-child,
  .metric-table td.metric-value,
  .distribution-table td:nth-child(3),
  .distribution-table td:nth-child(4) {
    text-align: right;
  }
  .distribution-table td:first-child {
    text-align: center;
    width: 42px;
  }
  .analytics-table td {
    padding: 5px 10px;
    color: #ececf4;
    border-top: 1px solid rgba(201, 162, 39, 0.18);
    vertical-align: top;
    line-height: 1.35;
  }
  .analytics-table tbody tr:nth-child(even) td {
    background: rgba(255, 255, 255, 0.04);
  }
  .metric-name { color: #d8d8ea; }
  .metric-value {
    color: #f5b942;
    font-weight: 600;
    white-space: pre-wrap;
  }
  .distribution-note {
    font-size: 8px;
    color: #a0a0b8;
    margin: -2px 0 6px;
  }
  .analytics-footer {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid rgba(201, 162, 39, 0.35);
    text-align: center;
  }
  .analytics-footer .report-by {
    margin-bottom: 3px;
  }
  .analytics-footer .report-brand-name {
    font-size: 14px;
    margin-bottom: 4px;
  }
  .analytics-footer .report-tagline {
    font-size: 8px;
    max-width: 420px;
    margin: 0 auto 10px;
    color: #c8c8dc;
  }
  .analytics-footer .brand-logo {
    height: 46px;
    margin: 0 auto;
  }
`;

function renderAnalyticsHeroHtml(title: string, subtitle: string): string {
  return `
    <div class="hero">
      <div class="hero-title">${escapeHtml(title)}</div>
      <div class="hero-sub">${escapeHtml(subtitle)}</div>
      <div class="hero-rule"></div>
    </div>`;
}

export function buildAnalyticsSummaryPagesHtml(
  snapshot: ContestAnalyticsTabSnapshot,
  assets: HtmlReportAssets,
): string[] {
  const metricPages = paginateAnalyticsMetricSections(snapshot.sections);
  const pages: string[] = metricPages.map((sections, index) => {
    const sectionsHtml = sections
      .map((section) => renderMetricSectionHtml(section.title, section.rows))
      .join("");
    const isFirst = index === 0;
    const heroSubtitle =
      metricPages.length > 1 && !isFirst
        ? `${snapshot.tabLabel} · continued`
        : snapshot.tabLabel;

    const inner = isFirst
      ? `${renderReportBrandBarHtml(assets)}
        <div class="content">
          ${renderAnalyticsHeroHtml("Analytics Overview", heroSubtitle)}
          ${sectionsHtml}
        </div>`
      : `${renderReportBrandBarHtml(assets, { compact: true })}
        <div class="content">
          ${renderAnalyticsHeroHtml("Analytics Overview", heroSubtitle)}
          ${sectionsHtml}
        </div>`;

    return pageShell(inner, ANALYTICS_PAGE_STYLES);
  });

  const footerLogo = assets.verticalLogoDataUrl
    ? `<img class="brand-logo" src="${assets.verticalLogoDataUrl}" alt="Game of Creators"/>`
    : "";

  const page2Inner = `
    ${renderReportBrandBarHtml(assets, { compact: true })}
    <div class="content">
      ${renderAnalyticsHeroHtml("Views Distribution", snapshot.tabLabel)}
      ${renderDistributionTableHtml(snapshot.viewsDistributionBySubmission, {
        variant: "submission",
      })}
    </div>`;

  const page3Inner = `
    ${renderReportBrandBarHtml(assets, { compact: true })}
    <div class="content">
      ${renderAnalyticsHeroHtml("Views Distribution", snapshot.tabLabel)}
      ${renderDistributionTableHtml(snapshot.viewsDistributionByCreator, {
        isLast: true,
        variant: "creator",
      })}
      <div class="analytics-footer">
        <div class="report-by">Report by</div>
        <div class="report-brand-name">Game of Creators</div>
        <div class="report-tagline">${escapeHtml(GOC_TAGLINE)}</div>
        ${footerLogo}
      </div>
    </div>`;

  pages.push(pageShell(page2Inner, ANALYTICS_PAGE_STYLES));
  pages.push(pageShell(page3Inner, ANALYTICS_PAGE_STYLES));
  return pages;
}

export function buildAnalyticsSummaryPageHtml(
  snapshot: ContestAnalyticsTabSnapshot,
  assets: HtmlReportAssets,
): string {
  return buildAnalyticsSummaryPagesHtml(snapshot, assets)[0] ?? "";
}

export function buildDividerPageHtml(
  sectionNumber: number,
  title: string,
  summaryLines: string[],
): string {
  const badge = String(sectionNumber).padStart(2, "0");
  const summaries = summaryLines
    .map((line) => `<div class="summary-line">${escapeHtml(line)}</div>`)
    .join("");

  const extraStyles = `
    .center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 56px 64px;
      z-index: 2;
      text-align: center;
      width: 100%;
    }
    .badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 28px;
      margin: 0 auto 22px;
      align-self: center;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(55, 32, 110, 0.98) 0%, rgba(18, 8, 42, 0.98) 100%);
      border: 1px solid rgba(212, 175, 55, 0.55);
      color: #f5b942;
      font-size: 11px;
      font-weight: 700;
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
      line-height: 1;
      padding: 0;
    }
    .badge-num {
      display: block;
      width: 100%;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .section-title {
      font-size: 22px;
      font-weight: 700;
      line-height: 1.25;
      max-width: 460px;
      width: 100%;
      margin: 0 auto 16px;
      padding: 0 12px;
    }
    .section-rule {
      width: 120px;
      height: 2px;
      background: #c9a227;
      margin: 0 auto 16px;
    }
    .summary-line {
      font-size: 12px;
      color: #a0a0b8;
      line-height: 1.55;
      max-width: 420px;
      width: 100%;
      margin: 0 auto;
      padding: 0 12px;
    }
  `;

  const inner = `
    <div class="center">
      <div class="badge"><span class="badge-num">${badge}</span></div>
      <div class="section-title">${escapeHtml(title)}</div>
      <div class="section-rule"></div>
      ${summaries}
    </div>`;

  return pageShell(inner, extraStyles);
}

export function buildAnalyticsSummaryOverflowPageHtml(
  _snapshot: ContestAnalyticsTabSnapshot,
  _assets: HtmlReportAssets,
): string | null {
  return null;
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 800);
        }),
    ),
  );
}

export async function captureHtmlPageToDataUrl(
  html: string,
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const host = document.createElement("div");
  host.setAttribute("data-pdf-capture", "true");
  host.style.cssText = `position:fixed;left:0;top:0;width:${PAGE_W}px;height:${PAGE_H}px;opacity:0;pointer-events:none;z-index:2147483646;overflow:hidden;`;

  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    await document.fonts.ready;
    await waitForImages(host);
    await new Promise((r) => setTimeout(r, 300));

    const page = host.querySelector(".page") as HTMLElement | null;
    if (!page) return null;

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(page, {
      width: PAGE_W,
      height: PAGE_H,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#06021d",
      logging: false,
      windowWidth: PAGE_W,
      windowHeight: PAGE_H,
    });

    return canvas.toDataURL("image/png", 1.0);
  } catch (err) {
    console.warn("[report-export] HTML page capture failed:", err);
    return null;
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}

export async function renderHtmlPageToPdf(
  doc: {
    internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
    addImage: (
      imageData: string,
      format: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => void;
  },
  html: string,
): Promise<boolean> {
  const dataUrl = await captureHtmlPageToDataUrl(html);
  if (!dataUrl || dataUrl.length < 1000) return false;

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.addImage(dataUrl, "PNG", 0, 0, w, h);
  return true;
}

export async function renderPremiumHtmlPageToPdf(
  doc: Parameters<typeof renderHtmlPageToPdf>[0],
  html: string,
): Promise<boolean> {
  return renderHtmlPageToPdf(doc, html);
}

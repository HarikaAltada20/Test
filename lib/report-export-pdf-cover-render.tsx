import React from "react";
import { pdf } from "@react-pdf/renderer";
import {
  buildCampaignCoverReportData,
  type CampaignCoverReportData,
} from "@/lib/report-export-pdf-cover-data";
import { CampaignReportPrefixDocument } from "@/lib/report-export-pdf-cover-document";
import type { ExportReportBranding } from "@/lib/report-export-branding";
import type { ReportCoverMetrics } from "@/lib/report-export-metrics";
import type { TocSection } from "@/lib/report-export-pdf-premium-shared";
import {
  prependPdfDocument,
  addTocInternalLinks,
  downloadPdfBytes,
} from "@/lib/report-export-pdf-merge";

const SHIELD_LOGO_PATH = "/images/gold_logo_vertical.png";

async function fetchShieldLogoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(`${window.location.origin}${SHIELD_LOGO_PATH}`);
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

export async function renderCampaignPrefixPdfBytes(
  data: CampaignCoverReportData,
  shieldLogoSrc?: string | null,
  tocSections?: TocSection[],
): Promise<ArrayBuffer> {
  const blob = await pdf(
    <CampaignReportPrefixDocument
      data={data}
      shieldLogoSrc={shieldLogoSrc}
      tocSections={tocSections}
    />,
  ).toBlob();
  return blob.arrayBuffer();
}

export async function renderBrandedPrefixPdfBytes(
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  tocSections?: TocSection[],
): Promise<ArrayBuffer> {
  const data = buildCampaignCoverReportData(branding, metrics);
  const shieldLogoSrc = await fetchShieldLogoDataUrl();
  return renderCampaignPrefixPdfBytes(data, shieldLogoSrc, tocSections);
}

export type BrandedPdfDownloadOptions = {
  tocSections?: TocSection[];
  /** Number of React-PDF pages prepended (1 = cover only, 2 = cover + TOC) */
  prefixPageCount?: number;
};

/** Prepend React-PDF cover (+ optional TOC) to jsPDF body and download */
export async function downloadPdfWithReactPrefix(
  bodyPdfBytes: ArrayBuffer,
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  filename: string,
  options?: BrandedPdfDownloadOptions,
): Promise<void> {
  const prefixPageCount = options?.prefixPageCount ?? (options?.tocSections?.length ? 2 : 1);
  const prefixBytes = await renderBrandedPrefixPdfBytes(
    branding,
    metrics,
    options?.tocSections,
  );
  let merged = await prependPdfDocument(bodyPdfBytes, prefixBytes);

  if (options?.tocSections?.length && prefixPageCount >= 2) {
    merged = await addTocInternalLinks(merged, {
      tocPageIndex: 1,
      sections: options.tocSections,
    });
  }

  await downloadPdfBytes(merged, filename);
}

/** @deprecated Use downloadPdfWithReactPrefix */
export async function downloadPdfWithReactCover(
  bodyPdfBytes: ArrayBuffer,
  branding: ExportReportBranding,
  metrics: ReportCoverMetrics,
  filename: string,
): Promise<void> {
  await downloadPdfWithReactPrefix(bodyPdfBytes, branding, metrics, filename);
}

export { buildCampaignCoverReportData };
export type { CampaignCoverReportData, TocSection };

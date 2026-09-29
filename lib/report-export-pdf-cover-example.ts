import type { CampaignCoverReportData } from "@/lib/report-export-pdf-cover-data";
import { buildCoverEngineLabel } from "@/lib/report-export-pdf-cover-data";

const baseTrust = {
  reportId: "GOC-20260611102101",
  generatedTimestamp: "11 Jun 2026, 10:21:01 pm IST",
  dataScopeLabel: "Verified + Paid Submissions Data",
  engineLabel: buildCoverEngineLabel(),
};

export const exampleCampaignCoverData: CampaignCoverReportData = {
  brandName: "Acme Brand Co.",
  campaignName: "Summer Creator Challenge 2026",
  dataScopeLabel: "Verified + Paid Submissions Data",
  exportDate: "04 June 2026",
  filters: "Verified + Paid Submissions Data",
  heroMetric: {
    value: "2.6M",
    label: "Campaign Views",
    subline:
      "Generated from 12,842 creator submissions\nwith an effective CPM of $0.017",
  },
  insightSentence:
    "The campaign generated 2.6M views from 12,842 creator submissions while achieving an effective CPM of $0.017.",
  trust: baseTrust,
  kpis: [
    {
      label: "Total Submissions",
      value: "12,842",
      subtext: "Total entries received",
    },
    {
      label: "Total Views",
      value: "2.6M",
      subtext: "Across all content",
    },
    {
      label: "Expected Reward",
      value: "$50,000",
      subtext: "Total prize pool",
    },
    {
      label: "Contest Duration",
      value: "45 Days",
      subtext: "01 May – 14 Jun 2026",
    },
  ],
};

export const exampleCpmCampaignCoverData: CampaignCoverReportData = {
  brandName: "Beer Biceps",
  campaignName: "Ranveer: BTS, Vlogs & Documentaries (Special Campaign)",
  dataScopeLabel: "Verified + Paid Submissions Data",
  exportDate: "10/06/2026",
  filters: "Verified + Paid Submissions Data",
  heroMetric: {
    value: "21.0M",
    label: "Campaign Views",
    subline:
      "Generated from 1,065 creator submissions\nwith an effective CPM of $0.017",
  },
  insightSentence:
    "The campaign generated 21.0M views from 1,065 creator submissions while achieving an effective CPM of $0.017.",
  trust: {
    ...baseTrust,
    reportId: "GOC-20260611102101",
  },
  kpis: [
    {
      label: "Total Submissions",
      value: "1065",
      subtext: "Total entries received",
    },
    {
      label: "Total Views",
      value: "21.0M",
      subtext: "Across all content",
    },
    {
      label: "Amount Paid",
      value: "$357.42",
      subtext: "Total amount paid",
    },
    {
      label: "Contest Duration",
      value: "23 Days",
      subtext: "02 May – 25 May 2026",
    },
  ],
  marketing: {
    targetCpm: "$0.200",
    effectiveCpm: "$0.017",
    cpmEfficiency: "11.8×",
  },
};

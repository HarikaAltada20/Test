export const BRAND_PARTNERSHIP_GOOGLE_FORM_ID =
  "1FAIpQLSf7C6hOBIr90e8pBDt9mMo4AzJaFM0Dlbud-EleVIPtuCC68A";

export const BRAND_PARTNERSHIP_FORM_EDIT_URL =
  "https://docs.google.com/forms/d/1Lx_aasGgd32zIlmshksN7EiZ3JjfNQmQFkkV3ujgWhM/edit";

export const BRAND_PARTNERSHIP_FORM_VIEW_URL = `https://docs.google.com/forms/d/e/${BRAND_PARTNERSHIP_GOOGLE_FORM_ID}/viewform`;

export const BRAND_PARTNERSHIP_FORM_RESPONSE_URL = `https://docs.google.com/forms/d/e/${BRAND_PARTNERSHIP_GOOGLE_FORM_ID}/formResponse`;

export const CALENDLY_FOUNDER_URL = "https://calendly.com/guptavishesh2/30min";

/** Google Form entry.XXXX field IDs (from FB_PUBLIC_LOAD_DATA_) */
export const BRAND_PARTNERSHIP_FIELD_ENTRIES = {
  brandName: "953405649",
  websiteOrSocial: "252800795",
  category: "183190247",
  targetRegion: "1489914077",
  campaignExpectations: "1361951032",
  marketingBudgetChannels: "2109640101",
  monthlyMarketingSpend: "392490872",
  scalingPotential: "1171856862",
  whatsappNumber: "1434148185",
  targetDemographic: "124018534",
  platforms: "1754931358",
  viralityVsConversion: "94215581",
  additionalNotes: "170082596",
} as const;

export const PROMOTE_CATEGORIES = [
  "Mobile App",
  "Game",
  "SaaS",
  "AI Tool",
  "Music/Song",
  "Podcast",
  "Movie",
  "Entertainment",
  "Crypto Token",
  "D2C Product",
] as const;

export const MARKETING_BUDGET_CHANNELS = [
  "Facebook/Instagram Ads",
  "Google Ads",
  "Influencer Marketing",
  "Offline Ads",
  "We don't run ads yet",
] as const;

export const MONTHLY_MARKETING_SPEND_OPTIONS = [
  "$0 - Just starting",
  "Under $1,000",
  "$1,000 - $5,000",
  "$5,000+",
  "$10,000+",
] as const;

export const SCALING_POTENTIAL_OPTIONS = [
  "Small Scale ($100 - $500)",
  "Growth Mode ($500 - $2,500)",
  "Aggressive Scaling ($2,500+)",
  "Unlimited (As long as it's profitable)",
] as const;

export const TARGET_DEMOGRAPHICS = [
  "Gen Z (13-25)",
  "Millennials (26-40)",
  "Gen X (41-56)",
  "Baby Boomers (57+)",
] as const;

export const IMPORTANT_PLATFORMS = [
  "TikTok",
  "Instagram",
  "YouTube",
  "X (Twitter)",
  "Facebook",
] as const;

export const VIRALITY_SCALE_OPTIONS = ["1", "2", "3", "4", "5"] as const;

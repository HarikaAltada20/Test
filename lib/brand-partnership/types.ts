export interface BrandPartnershipApplicationPayload {
  brandName: string;
  websiteOrSocial: string;
  category: string;
  categoryOther?: string;
  targetRegion: string;
  campaignExpectations: string;
  marketingBudgetChannels: string[];
  marketingBudgetOther?: string;
  monthlyMarketingSpend: string;
  monthlyMarketingSpendOther?: string;
  scalingPotential: string;
  scalingPotentialOther?: string;
  email: string;
  whatsappNumber: string;
  targetDemographic: string;
  targetDemographicOther?: string;
  platforms: string[];
  platformsOther?: string;
  viralityVsConversion: string;
  additionalNotes?: string;
  /** Honeypot — must stay empty */
  companyWebsite?: string;
}

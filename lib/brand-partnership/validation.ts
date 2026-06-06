import { z } from "zod";
import {
  IMPORTANT_PLATFORMS,
  MARKETING_BUDGET_CHANNELS,
  MONTHLY_MARKETING_SPEND_OPTIONS,
  PROMOTE_CATEGORIES,
  SCALING_POTENTIAL_OPTIONS,
  TARGET_DEMOGRAPHICS,
  VIRALITY_SCALE_OPTIONS,
} from "@/constants/brandPartnershipForm";

const brandPartnershipBaseSchema = z.object({
  brandName: z.string().trim().min(1, "Required"),
  websiteOrSocial: z.string().trim().min(1, "Required"),
  category: z.string().min(1, "Required"),
  categoryOther: z.string().optional(),
  targetRegion: z.string().trim().min(1, "Required"),
  campaignExpectations: z.string().trim().min(1, "Required"),
  marketingBudgetChannels: z.array(z.string()).min(1, "Select at least one"),
  marketingBudgetOther: z.string().optional(),
  monthlyMarketingSpend: z.string().min(1, "Required"),
  monthlyMarketingSpendOther: z.string().optional(),
  scalingPotential: z.string().min(1, "Required"),
  scalingPotentialOther: z.string().optional(),
  email: z.string().trim().email("Enter a valid email"),
  whatsappNumber: z.string().trim().min(5, "Required"),
  targetDemographic: z.string().min(1, "Required"),
  targetDemographicOther: z.string().optional(),
  platforms: z.array(z.string()).min(1, "Select at least one"),
  platformsOther: z.string().optional(),
  viralityVsConversion: z.enum(VIRALITY_SCALE_OPTIONS, {
    errorMap: () => ({ message: "Required" }),
  }),
  additionalNotes: z.string().optional(),
  companyWebsite: z.string().optional(),
});

function applyFullRefinements(
  data: z.infer<typeof brandPartnershipBaseSchema>,
  ctx: z.RefinementCtx,
) {
    if (data.companyWebsite?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Spam detected",
        path: ["companyWebsite"],
      });
    }

    if (data.category === "Other" && !data.categoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify category",
        path: ["categoryOther"],
      });
    } else if (
      data.category !== "Other" &&
      !(PROMOTE_CATEGORIES as readonly string[]).includes(data.category)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid category",
        path: ["category"],
      });
    }

    const channelChecks = data.marketingBudgetChannels.filter((c) =>
      (MARKETING_BUDGET_CHANNELS as readonly string[]).includes(c),
    );
    const hasOtherChannel = data.marketingBudgetChannels.includes("Other");
    if (hasOtherChannel && !data.marketingBudgetOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify other channel",
        path: ["marketingBudgetOther"],
      });
    }
    if (
      channelChecks.length === 0 &&
      !hasOtherChannel
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one valid option",
        path: ["marketingBudgetChannels"],
      });
    }

    if (
      data.monthlyMarketingSpend === "Other" &&
      !data.monthlyMarketingSpendOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify",
        path: ["monthlyMarketingSpendOther"],
      });
    } else if (
      data.monthlyMarketingSpend !== "Other" &&
      !(MONTHLY_MARKETING_SPEND_OPTIONS as readonly string[]).includes(
        data.monthlyMarketingSpend,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid option",
        path: ["monthlyMarketingSpend"],
      });
    }

    if (
      data.scalingPotential === "Other" &&
      !data.scalingPotentialOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify",
        path: ["scalingPotentialOther"],
      });
    } else if (
      data.scalingPotential !== "Other" &&
      !(SCALING_POTENTIAL_OPTIONS as readonly string[]).includes(
        data.scalingPotential,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid option",
        path: ["scalingPotential"],
      });
    }

    if (
      data.targetDemographic === "Other" &&
      !data.targetDemographicOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify",
        path: ["targetDemographicOther"],
      });
    } else if (
      data.targetDemographic !== "Other" &&
      !(TARGET_DEMOGRAPHICS as readonly string[]).includes(
        data.targetDemographic,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid option",
        path: ["targetDemographic"],
      });
    }

    const platformChecks = data.platforms.filter((p) =>
      (IMPORTANT_PLATFORMS as readonly string[]).includes(p),
    );
    const hasOtherPlatform = data.platforms.includes("Other");
    if (hasOtherPlatform && !data.platformsOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify other platform",
        path: ["platformsOther"],
      });
    }
    if (platformChecks.length === 0 && !hasOtherPlatform) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one valid platform",
        path: ["platforms"],
      });
    }
}

export const brandPartnershipSchema = brandPartnershipBaseSchema.superRefine(
  applyFullRefinements,
);

export type BrandPartnershipFormData = z.infer<typeof brandPartnershipBaseSchema>;

export const brandPartnershipStep1Schema = brandPartnershipBaseSchema
  .pick({
    brandName: true,
    websiteOrSocial: true,
    category: true,
    categoryOther: true,
    targetRegion: true,
  })
  .superRefine((data, ctx) => {
    if (data.category === "Other" && !data.categoryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify category",
        path: ["categoryOther"],
      });
    } else if (
      data.category !== "Other" &&
      !(PROMOTE_CATEGORIES as readonly string[]).includes(data.category)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid category",
        path: ["category"],
      });
    }
  });

export const brandPartnershipStep2Schema = brandPartnershipBaseSchema
  .pick({
    campaignExpectations: true,
    marketingBudgetChannels: true,
    marketingBudgetOther: true,
    monthlyMarketingSpend: true,
    monthlyMarketingSpendOther: true,
    scalingPotential: true,
    scalingPotentialOther: true,
  })
  .superRefine((data, ctx) => {
    const channelChecks = data.marketingBudgetChannels.filter((c) =>
      (MARKETING_BUDGET_CHANNELS as readonly string[]).includes(c),
    );
    const hasOtherChannel = data.marketingBudgetChannels.includes("Other");
    if (hasOtherChannel && !data.marketingBudgetOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify other channel",
        path: ["marketingBudgetOther"],
      });
    }
    if (channelChecks.length === 0 && !hasOtherChannel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one",
        path: ["marketingBudgetChannels"],
      });
    }
    if (
      data.monthlyMarketingSpend === "Other" &&
      !data.monthlyMarketingSpendOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify",
        path: ["monthlyMarketingSpendOther"],
      });
    } else if (
      data.monthlyMarketingSpend !== "Other" &&
      !(MONTHLY_MARKETING_SPEND_OPTIONS as readonly string[]).includes(
        data.monthlyMarketingSpend,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid option",
        path: ["monthlyMarketingSpend"],
      });
    }
    if (
      data.scalingPotential === "Other" &&
      !data.scalingPotentialOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify",
        path: ["scalingPotentialOther"],
      });
    } else if (
      data.scalingPotential !== "Other" &&
      !(SCALING_POTENTIAL_OPTIONS as readonly string[]).includes(
        data.scalingPotential,
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid option",
        path: ["scalingPotential"],
      });
    }
  });

export const STEP_SCHEMAS = {
  1: brandPartnershipStep1Schema,
  2: brandPartnershipStep2Schema,
  3: brandPartnershipSchema,
} as const;

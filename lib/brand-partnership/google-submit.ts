import {
  BRAND_PARTNERSHIP_FIELD_ENTRIES,
  BRAND_PARTNERSHIP_FORM_RESPONSE_URL,
} from "@/constants/brandPartnershipForm";
import type { BrandPartnershipFormData } from "@/lib/brand-partnership/validation";

function resolveChoiceValue(
  value: string,
  otherText?: string,
): string {
  if (value === "Other") {
    return otherText?.trim() || "Other";
  }
  return value;
}

function appendEntry(
  params: URLSearchParams,
  entryId: string,
  value: string,
) {
  if (value.trim()) {
    params.append(`entry.${entryId}`, value.trim());
  }
}

function appendMultipleEntries(
  params: URLSearchParams,
  entryId: string,
  values: string[],
  otherText?: string,
) {
  values.forEach((value) => {
    if (value === "Other") {
      appendEntry(params, entryId, otherText?.trim() || "Other");
    } else {
      appendEntry(params, entryId, value);
    }
  });
}

export function buildGoogleFormBody(data: BrandPartnershipFormData): URLSearchParams {
  const params = new URLSearchParams();
  const e = BRAND_PARTNERSHIP_FIELD_ENTRIES;

  appendEntry(params, e.brandName, data.brandName);
  appendEntry(params, e.websiteOrSocial, data.websiteOrSocial);
  appendEntry(
    params,
    e.category,
    resolveChoiceValue(data.category, data.categoryOther),
  );
  appendEntry(params, e.targetRegion, data.targetRegion);
  appendEntry(params, e.campaignExpectations, data.campaignExpectations);

  appendMultipleEntries(
    params,
    e.marketingBudgetChannels,
    data.marketingBudgetChannels,
    data.marketingBudgetOther,
  );

  appendEntry(
    params,
    e.monthlyMarketingSpend,
    resolveChoiceValue(
      data.monthlyMarketingSpend,
      data.monthlyMarketingSpendOther,
    ),
  );

  appendEntry(
    params,
    e.scalingPotential,
    resolveChoiceValue(data.scalingPotential, data.scalingPotentialOther),
  );

  appendEntry(params, e.whatsappNumber, data.whatsappNumber);

  appendEntry(
    params,
    e.targetDemographic,
    resolveChoiceValue(data.targetDemographic, data.targetDemographicOther),
  );

  appendMultipleEntries(
    params,
    e.platforms,
    data.platforms,
    data.platformsOther,
  );

  appendEntry(params, e.viralityVsConversion, data.viralityVsConversion);

  const notesParts = [`Contact email: ${data.email}`];
  if (data.additionalNotes?.trim()) {
    notesParts.push("", data.additionalNotes.trim());
  }
  appendEntry(params, e.additionalNotes, notesParts.join("\n"));

  return params;
}

export async function submitToGoogleForm(
  data: BrandPartnershipFormData,
): Promise<{ ok: boolean; status: number }> {
  const body = buildGoogleFormBody(data);

  const response = await fetch(BRAND_PARTNERSHIP_FORM_RESPONSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    redirect: "manual",
  });

  // Google Forms returns 200 or 302 on success
  const ok = response.status === 200 || response.status === 302;
  return { ok, status: response.status };
}

export function formatApplicationEmailSummary(
  data: BrandPartnershipFormData,
): string {
  return [
    `Brand: ${data.brandName}`,
    `Email: ${data.email}`,
    `WhatsApp: ${data.whatsappNumber}`,
    `Website/Social: ${data.websiteOrSocial}`,
    `Category: ${resolveChoiceValue(data.category, data.categoryOther)}`,
    `Region: ${data.targetRegion}`,
    `Expectations: ${data.campaignExpectations}`,
    `Marketing channels: ${data.marketingBudgetChannels.join(", ")}${data.marketingBudgetOther ? ` (${data.marketingBudgetOther})` : ""}`,
    `Monthly spend: ${resolveChoiceValue(data.monthlyMarketingSpend, data.monthlyMarketingSpendOther)}`,
    `Scaling: ${resolveChoiceValue(data.scalingPotential, data.scalingPotentialOther)}`,
    `Demographic: ${resolveChoiceValue(data.targetDemographic, data.targetDemographicOther)}`,
    `Platforms: ${data.platforms.join(", ")}${data.platformsOther ? ` (${data.platformsOther})` : ""}`,
    `Virality vs CPA (1-5): ${data.viralityVsConversion}`,
    data.additionalNotes ? `Notes: ${data.additionalNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

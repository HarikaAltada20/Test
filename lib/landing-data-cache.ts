import { unstable_cache } from "next/cache";
import {
  getTotalCreatorMoneyWonCents,
  getTotalSubmissionViews,
} from "@/lib/landing-stats";
import { createPublicServerClient } from "@/utils/supabase/public-server";

/** Matches `export const revalidate` on landing routes — ISR-style data cache. */
const LANDING_DATA_REVALIDATE_SECONDS = 86400; // 1 day

async function fetchBrandsLandingData() {
  const supabase = createPublicServerClient();
  const totalViews = await getTotalSubmissionViews(supabase);
  return { totalViews };
}

const cachedBrandsLandingData = unstable_cache(
  fetchBrandsLandingData,
  ["landing-brands-stats-v1"],
  {
    revalidate: LANDING_DATA_REVALIDATE_SECONDS,
    tags: ["landing-brands"],
  },
);

export async function getCachedBrandsLandingData() {
  if (process.env.NODE_ENV === "development") {
    return fetchBrandsLandingData();
  }
  try {
    return await cachedBrandsLandingData();
  } catch (_err) {
    return await fetchBrandsLandingData();
  }
}

async function fetchCreatorsLandingData() {
  const supabase = createPublicServerClient();

  const totalViews = await getTotalSubmissionViews(supabase);
  const totalMoneyCreditedCents = await getTotalCreatorMoneyWonCents(supabase);
  const contestsResult = await supabase
    .from("contests_with_status")
    .select(
      `
    *,
    contest_based_details
  `,
    )
    .eq("moderation_status", "published")
    .not("status", "eq", "incomplete")
    .order("created_at", { ascending: false });

  if (contestsResult.error) {
    console.error("Error fetching contests:", contestsResult.error);
  }

  const contests = contestsResult.data ?? [];

  return {
    totalViews,
    totalMoneyCreditedCents,
    contests,
  };
}

const cachedCreatorsLandingData = unstable_cache(
  fetchCreatorsLandingData,
  ["landing-creators-data-v1"],
  {
    revalidate: LANDING_DATA_REVALIDATE_SECONDS,
    tags: ["landing-creators"],
  },
);

export async function getCachedCreatorsLandingData() {
  if (process.env.NODE_ENV === "development") {
    return fetchCreatorsLandingData();
  }
  try {
    return await cachedCreatorsLandingData();
  } catch (_err) {
    return await fetchCreatorsLandingData();
  }
}

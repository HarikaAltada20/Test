import { unstable_cache } from "next/cache";
import {
  getTotalCreatorMoneyWonCents,
  getTotalSubmissionViews,
} from "@/lib/landing-stats";
import { createPublicServerClient } from "@/utils/supabase/public-server";

/** Matches `export const revalidate` on landing routes — ISR-style data cache. */
const LANDING_DATA_REVALIDATE_SECONDS = 86400; // 1 day

export const getCachedBrandsLandingData = unstable_cache(
  async () => {
    const supabase = createPublicServerClient();
    const totalViews = await getTotalSubmissionViews(supabase);
    return { totalViews };
  },
  ["landing-brands-stats-v1"],
  {
    revalidate: LANDING_DATA_REVALIDATE_SECONDS,
    tags: ["landing-brands"],
  },
);

export const getCachedCreatorsLandingData = unstable_cache(
  async () => {
    const supabase = createPublicServerClient();

    // Sequential (not parallel) so each prerender bursts at most one DB request at a time —
    // helps avoid PGRST003 when many routes prerender alongside /creators.
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
  },
  ["landing-creators-data-v1"],
  {
    revalidate: LANDING_DATA_REVALIDATE_SECONDS,
    tags: ["landing-creators"],
  },
);

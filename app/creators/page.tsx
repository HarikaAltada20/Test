import { publicPageMetadata } from "@/lib/seo/metadata";
import React from "react";
import { Metadata } from "next";
import CreatorsClient from "./CreatorsClient";
import {
  getCachedCreatorsLandingData,
} from "@/lib/landing-data-cache";

/**
 * Do not set `revalidate` here — with `force-dynamic`, the page must not participate in static prerender
 * (that path hits 60s / PGRST003 during `next build`). Freshness comes from `unstable_cache` in
 * `getCachedCreatorsLandingData` (24h TTL + tags).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata("/creators");

export default async function CreatorsPage() {
  const { totalViews, totalMoneyCreditedCents, contests } =
    await getCachedCreatorsLandingData();

  return (
    <CreatorsClient
      totalViews={totalViews}
      totalMoneyCreditedCents={totalMoneyCreditedCents}
      initialContests={contests}
    />
  );
}

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

export const metadata: Metadata = {
  title:
    "Best Platform to Get Paid Based on Views - Turn Your Creativity Into Income | Game Of Creators",
  description:
    "The best platform to get paid based on views and ranking. Join Game of Creators and earn money even with 0 followers! Top choice for creators seeking performance-based payments and fair compensation for quality content.",
  openGraph: {
    title: "Creators - Turn Your Creativity Into Income | Game Of Creators",
    description:
      "Join Game of Creators and get paid based on views or ranking - even with 0 followers! Participate in brand contests and earn money through performance-based payments.",
    type: "website",
    url: "https://gameofcreators.com/creators",
  },
  twitter: {
    card: "summary_large_image",
    title: "Creators - Turn Your Creativity Into Income | Game Of Creators",
    description:
      "Join Game of Creators and get paid based on views or ranking - even with 0 followers! Participate in brand contests and earn money through performance-based payments.",
  },
  alternates: {
    canonical: "https://gameofcreators.com/creators",
  },
};

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

import React from "react";
import { Metadata } from "next";
import BrandsClient from "./BrandsClient";
import {
  getCachedBrandsLandingData,
  LANDING_DATA_REVALIDATE_SECONDS,
} from "@/lib/landing-data-cache";

/** Time-based ISR: page shell + `unstable_cache` refresh at this interval. */
export const revalidate = LANDING_DATA_REVALIDATE_SECONDS;

export const metadata: Metadata = {
  title: "Best Platform for Creator Marketing - Make Your Product Go Viral | Game Of Creators",
  description:
    "The best platform for creator marketing. Launch strategic creator contests and drive organic viral marketing with 1000s of creators producing content that scales your brand's reach. Top choice for performance-based brand marketing.",
  keywords:
    "best platform for creator marketing, best creator marketing platform, viral marketing, creator contests, brand viral campaigns, organic marketing, creator marketing platform, viral content creation, brand awareness, performance marketing, viral brand strategy, top creator marketing platform",
  openGraph: {
    title: "Brands - Make Your Product Go Viral | Game Of Creators",
    description:
      "Launch strategic creator contests and drive organic viral marketing with 1000s of creators producing content that scales your brand's reach.",
    type: "website",
    url: "https://gameofcreators.com/brands",
  },
  twitter: {
    card: "summary_large_image",
    title: "Brands - Make Your Product Go Viral | Game Of Creators",
    description:
      "Launch strategic creator contests and drive organic viral marketing with 1000s of creators producing content that scales your brand's reach.",
  },
  alternates: {
    canonical: "https://gameofcreators.com/brands",
  },
};

export default async function BrandsPage() {
  const { totalViews } = await getCachedBrandsLandingData();

  return <BrandsClient totalViews={totalViews} />;
}

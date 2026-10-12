import { publicPageMetadata } from "@/lib/seo/metadata";
import React from "react";
import { Metadata } from "next";
import BrandsClient from "./BrandsClient";
import {
  getCachedBrandsLandingData,
} from "@/lib/landing-data-cache";
import { getServerThemeMode } from "@/lib/server-theme-mode";

/**
 * Do not set `revalidate` here — with `force-dynamic`, the page must not participate in static prerender
 * (that path hits 60s timeouts / DB pool contention during `next build`). Freshness comes from
 * `unstable_cache` in `getCachedBrandsLandingData` (24h TTL + tags).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = publicPageMetadata("/brands");

export default async function BrandsPage() {
  const [{ totalViews }, initialTheme] = await Promise.all([
    getCachedBrandsLandingData(),
    getServerThemeMode(),
  ]);

  return <BrandsClient totalViews={totalViews} initialTheme={initialTheme} />;
}

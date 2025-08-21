import React from "react";
import { Metadata } from "next";
import BrandsClient from "./BrandsClient";

export const metadata: Metadata = {
  title: "Game Of Creators - Discover Verified Creators for Your Brand Campaigns",
  description:
    "Find and collaborate with verified creators to launch gamified campaigns. Engage audiences, boost brand visibility, and scale your marketing with Game of Creators.",
  keywords:
    "brand marketing, influencer marketing, creator collaborations, gamified campaigns, social media growth, content marketing, advertising solutions",
  openGraph: {
    title: "Game Of Creators - Discover Verified Creators for Your Brand Campaigns",
    description:
      "Find and collaborate with verified creators to launch gamified campaigns. Engage audiences, boost brand visibility, and scale your marketing with Game of Creators.",
    type: "website",
    url: "https://gameofcreators.com/brands",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators - Discover Verified Creators for Your Brand Campaigns",
    description:
      "Find and collaborate with verified creators to launch gamified campaigns. Engage audiences, boost brand visibility, and scale your marketing with Game of Creators.",
  },
  alternates: {
    canonical: "https://gameofcreators.com/brands",
  },
};

export default function BrandsPage() {
  return <BrandsClient />;
}

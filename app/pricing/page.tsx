import React from "react";
import { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Game Of Creators Pricing - Subscription Plans for Brands & Advertisers",
  description: "Choose your subscription plan to launch gamified creator contests. Access 5,000+ verified creators, get full content ownership, and scale your content marketing. Plans from $0/month.",
  keywords: "creator marketing, influencer marketing, content creation, brand contests, subscription plans, advertising, social media marketing",
  openGraph: {
    title: "Game Of Creators Pricing - Subscription Plans for Brands & Advertisers",
    description: "Choose your subscription plan to launch gamified creator contests. Access 5,000+ verified creators, get full content ownership, and scale your content marketing.",
    type: "website",
    url: "https://gameofcreators.com/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators Pricing - Subscription Plans for Brands & Advertisers",
    description: "Choose your subscription plan to launch gamified creator contests. Access 5,000+ verified creators, get full content ownership, and scale your content marketing.",
  },
  alternates: {
    canonical: "https://gameofcreators.com/pricing",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}

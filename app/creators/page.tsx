import React from "react";
import { Metadata } from "next";
import CreatorsClient from "./CreatorsClient";
import { createClient } from "@/utils/supabase/server";

// Always fetch fresh data so newly published contests show up immediately
export const revalidate = 0;

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
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from("submissions")
    .select("views");

  const totalViews =
    submissions?.reduce(
      (sum, sub: { views: number | null }) => sum + (sub.views || 0),
      0
    ) || 0;

  // Fetch contests on the server for immediate display
  const { data: contestsData, error: contestsError } = await supabase
    .from("contests_with_status")
    .select(
      `
      *,
      contest_based_details
    `
    )
    .eq("moderation_status", "published")
    .not("status", "eq", "incomplete")
    .order("created_at", { ascending: false });

  if (contestsError) {
    console.error("Error fetching contests:", contestsError);
  }

  const contests = contestsData || [];

  return <CreatorsClient totalViews={totalViews} initialContests={contests} />;
}

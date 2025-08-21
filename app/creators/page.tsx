import React from "react";
import { Metadata } from "next";
import CreatorsClient from "./CreatorsClient";

export const metadata: Metadata = {
  title: "Game Of Creators - Join as a Creator & Collaborate with Top Brands",
  description:
    "Grow your influence and earn by collaborating with leading brands. Participate in gamified campaigns, showcase your creativity, and unlock new opportunities.",
  keywords:
    "creators, influencer opportunities, brand collaborations, gamified campaigns, social media influencers, earn as creator",
  openGraph: {
    title: "Game Of Creators - Join as a Creator & Collaborate with Top Brands",
    description:
      "Grow your influence and earn by collaborating with leading brands. Participate in gamified campaigns, showcase your creativity, and unlock new opportunities.",
    type: "website",
    url: "https://gameofcreators.com/creators",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators - Join as a Creator & Collaborate with Top Brands",
    description:
      "Grow your influence and earn by collaborating with leading brands. Participate in gamified campaigns, showcase your creativity, and unlock new opportunities.",
  },
  alternates: {
    canonical: "https://gameofcreators.com/creators",
  },
};

export default function CreatorsPage() {
  return <CreatorsClient />;
}

import { Metadata } from "next";
import GetStartedClient from "./GetStartedClient";

export const metadata: Metadata = {
  title: "Get Started — Launch Your Creator Campaign | Game Of Creators",
  description:
    "Book a call with founder and we'll build your campaign plan together. Let's launch your first creator marketing campaign together.",
  alternates: {
    canonical: "https://gameofcreators.com/get-started",
  },
};

export default function GetStartedPage() {
  return <GetStartedClient />;
}

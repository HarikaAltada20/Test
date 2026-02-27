import { Metadata } from "next";
import GetStartedClient from "./GetStartedClient";

export const metadata: Metadata = {
  title: "Get Started — Launch Your Creator Campaign | Game Of Creators",
  description:
    "Book a call with our team or send us a message. Let's launch your first creator marketing campaign together.",
  alternates: {
    canonical: "https://gameofcreators.com/get-started",
  },
};

export default function GetStartedPage() {
  return <GetStartedClient />;
}

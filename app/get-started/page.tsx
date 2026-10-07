import { publicPageMetadata } from "@/lib/seo/metadata";
import { Metadata } from "next";
import GetStartedClient from "./GetStartedClient";

export const metadata: Metadata = publicPageMetadata("/get-started");

export default function GetStartedPage() {
  return <GetStartedClient />;
}

import { publicPageMetadata } from "@/lib/seo/metadata";
import React from "react";
import { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = publicPageMetadata("/pricing");

export default function PricingPage() {
  return <PricingClient />;
}

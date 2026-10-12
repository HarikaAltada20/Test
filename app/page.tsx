import { publicPageMetadata } from "@/lib/seo/metadata";
import { HeroSection } from "@/components/hero-section";
import type { Metadata } from "next";

// Add export const for static page generation
export const revalidate = 3600; // Revalidate every hour

export const metadata: Metadata = publicPageMetadata("/");

export default function Home() {
  return (
    <div>
      <HeroSection />
    </div>
  );
}

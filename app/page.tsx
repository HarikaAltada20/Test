import { HeroSection } from "@/components/hero-section"
import type { Metadata } from "next"

// Add export const for static page generation
export const revalidate = 3600 // Revalidate every hour

export const metadata: Metadata = {
  title: "Game Of Creators - Connect Brands with Content Creators",
  description: "Join the premier platform connecting brands with talented content creators for viral marketing campaigns. Create engaging content, grow your audience, and monetize your creativity.",
  openGraph: {
    title: "Game Of Creators - Connect Brands with Content Creators",
    description: "Join the premier platform connecting brands with talented content creators for viral marketing campaigns. Create engaging content, grow your audience, and monetize your creativity.",
    url: "https://www.gameofcreators.com/",
    siteName: "Game Of Creators",
    images: [
      {
        url: "https://www.gameofcreators.com/images/square_goc.png",
        width: 1200,
        height: 630,
        alt: "Game Of Creators Logo - Platform connecting brands with content creators",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  other: {
    "fb:app_id": "9901516833263498", // Replace with your actual Facebook App ID
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators - Connect Brands with Content Creators",
    description: "Join the premier platform connecting brands with talented content creators for viral marketing campaigns.",
    images: ["https://www.gameofcreators.com/images/square_goc.png"],
    creator: "@gameofcreators",
  },
}

export default function Home() {
  return (
    <div>
      <HeroSection />
    </div>
  )
}


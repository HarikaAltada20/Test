import { HeroSection } from "@/components/hero-section"
import type { Metadata } from "next"

// Add export const for static page generation
export const revalidate = 3600 // Revalidate every hour

export const metadata: Metadata = {
  title: "Game Of Creators - Performance-Based Creator Marketing Platform",
  description: "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers. Join 1000s of creators earning through performance-based marketing.",
  openGraph: {
    title: "Game Of Creators - Performance-Based Creator Marketing Platform",
    description: "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers. Join 1000s of creators earning through performance-based marketing.",
    url: "https://www.gameofcreators.com/",
    siteName: "Game Of Creators",
    images: [
      {
        url: "https://www.gameofcreators.com/goc.png",
        width: 1200,
        height: 630,
        alt: "Game Of Creators - Performance-based creator marketing platform where creators get paid based on views and ranking",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  facebook: {
    appId: "9901516833263498",
  },
  twitter: {
    card: "summary_large_image",
    title: "Game Of Creators - Performance-Based Creator Marketing Platform",
    description: "Turn creativity into income with Game of Creators. Get paid based on views or ranking in brand contests - even with 0 followers.",
    images: ["https://www.gameofcreators.com/goc.png"],
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


import { HeroSection } from "@/components/hero-section"

// Add export const for static page generation
export const revalidate = 3600 // Revalidate every hour

export default function Home() {
  return (
    <div>
      <HeroSection />
    </div>
  )
}


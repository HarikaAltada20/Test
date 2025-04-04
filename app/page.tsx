import { HeroSection } from "@/components/hero-section"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Home() {
  return (
    <div>
      <HeroSection />

      {/* Stats Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-center items-center text-center gap-8 md:gap-16 lg:gap-24">
            <div className="flex flex-col">
              <h2 className="text-5xl md:text-6xl font-bold text-rose-600">3000+</h2>
              <p className="text-gray-600 mt-2">Creators on the platform</p>
            </div>

            <div className="h-16 w-px bg-gray-200 hidden md:block"></div>

            <div className="flex flex-col">
              <h2 className="text-5xl md:text-6xl font-bold text-rose-600">99+</h2>
              <p className="text-gray-600 mt-2">Campaigns delivered</p>
            </div>

            <div className="h-16 w-px bg-gray-200 hidden md:block"></div>

            <div className="flex flex-col">
              <h2 className="text-5xl md:text-6xl font-bold text-rose-600">80M+</h2>
              <p className="text-gray-600 mt-2">Views Generated</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why it Works Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Why it Works</h2>
            <p className="text-lg text-gray-600">
              Generating fresh content ideas and managing creators can be challenging. With Go Viral, creators compete
              to craft the most viral content for your brand, hassle free.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-blue-50 rounded-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Organic content at scale</h3>
              <p className="text-gray-600">
                With Go Viral, you generate a high volume of diverse, high-quality content without the hassle of
                sourcing, negotiating, or managing creators manually.
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Supply and Demand based platform</h3>
              <p className="text-gray-600">
                Go Viral operates on a supply and demand model. Creators compete, allowing the best ideas to surface
                organically. This competition drives higher engagement, better content quality, and increased reach as
                creators share their work.
              </p>
            </div>

            <div className="bg-yellow-50 rounded-lg p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Scale winners on paid ads</h3>
              <p className="text-gray-600">
                Identify the best-performing content and seamlessly scale it into paid campaigns. With proven,
                audience-validated content, your ads drive higher engagement, lower costs, and better conversions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="bg-blue-50 rounded-lg p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <div className="text-navy-900">
                  <h2 className="text-3xl md:text-4xl font-bold mb-2">Launch a contest today</h2>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white"></div>
                      ))}
                    </div>
                    <span className="font-medium">
                      3000+ <span className="text-gray-600 font-normal">Active Creators</span>
                    </span>
                  </div>
                </div>
              </div>

              <Button size="lg" className="bg-rose-600 hover:bg-rose-700 text-white min-w-[200px]" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


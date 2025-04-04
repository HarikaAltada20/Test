import { Button } from "@/components/ui/button"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-blue-400 via-pink-300 to-rose-500 py-20">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-navy-900 mb-6">
            Make your product go viral
            <br />
            with creator contests
          </h1>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Button
              variant="outline"
              size="lg"
              className="bg-white hover:bg-gray-100 text-gray-800 border-gray-200"
              asChild
            >
              <Link href="/contact">Book a Demo</Link>
            </Button>
            <Button size="lg" className="bg-rose-600 hover:bg-rose-700 text-white" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>

        <div className="mt-12 relative">
          <div className="relative w-full max-w-5xl mx-auto">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="aspect-[16/9] bg-gray-100 flex items-center justify-center">
                <span className="text-gray-400">Dashboard Preview</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


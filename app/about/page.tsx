"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"

export default function AboutPage() {
  const { user } = useAuth()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">About Go Viral</h1>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-xl mb-8">
            Go Viral connects brands with content creators through a unique contest-based platform, helping brands
            generate authentic content at scale while giving creators opportunities to earn and grow.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-4">Our Story</h2>
          <p>
            Founded in 2023, Go Viral was born from a simple observation: brands struggle to consistently create
            engaging content that resonates with audiences, while creators are looking for meaningful opportunities to
            collaborate with brands they love.
          </p>
          <p>
            Our platform bridges this gap by creating a contest marketplace where brands can easily launch content
            creation contests, and creators can submit their best work to win prizes and recognition.
          </p>

          <h2 className="text-2xl font-bold mt-10 mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6 my-8">
            <div className="bg-muted p-6 rounded-lg">
              <h3 className="font-bold mb-2">For Brands</h3>
              <p className="mb-4">
                Launch a contest with clear guidelines, set prize pools, and watch as creators submit their best content
                featuring your products or services.
              </p>
            </div>
            <div className="bg-muted p-6 rounded-lg">
              <h3 className="font-bold mb-2">For Creators</h3>
              <p className="mb-4">
                Browse available contests, create content for brands you're passionate about, and earn rewards when your
                content performs well.
              </p>
            </div>
            <div className="bg-muted p-6 rounded-lg">
              <h3 className="font-bold mb-2">The Results</h3>
              <p className="mb-4">
                Brands get diverse, authentic content at scale, while creators build relationships with brands and grow
                their audiences through meaningful collaborations.
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-bold mt-10 mb-4">Our Values</h2>
          <ul className="space-y-4 mb-8">
            <li>
              <strong>Authenticity:</strong> We believe in the power of genuine content that resonates with real
              audiences.
            </li>
            <li>
              <strong>Opportunity:</strong> We're committed to creating fair opportunities for creators of all sizes and
              backgrounds.
            </li>
            <li>
              <strong>Innovation:</strong> We're constantly evolving our platform to meet the changing needs of both
              brands and creators.
            </li>
            <li>
              <strong>Community:</strong> We foster a supportive community where both brands and creators can grow
              together.
            </li>
          </ul>

          {!user && (
            <div className="text-center mt-12">
              <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                <Button asChild>
                  <Link href="/auth/signup">Create an Account</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


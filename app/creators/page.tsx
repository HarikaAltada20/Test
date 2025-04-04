import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, BadgeCheck, DollarSign, Zap } from "lucide-react"

export default function CreatorsPage() {
  return (
    <div>
      {/* Hero section */}
      <section className="bg-muted py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Turn Your Creativity Into Income</h1>
            <p className="text-xl mb-8">
              Join Go Viral to find creative opportunities, collaborate with brands, and get paid for your content.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">Start Creating Today</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Join as a Creator</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Earn Money</h3>
                  <p className="text-muted-foreground">
                    Get paid for creating content for brands you love through contests and collaborations.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <BadgeCheck className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Build Your Portfolio</h3>
                  <p className="text-muted-foreground">
                    Create professional content for recognized brands to showcase in your portfolio.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Grow Your Audience</h3>
                  <p className="text-muted-foreground">
                    Gain exposure when brands share and promote your content to their followers.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="max-w-4xl mx-auto">
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="md:w-1/3 flex justify-center">
                  <div className="bg-background h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold">
                    1
                  </div>
                </div>
                <div className="md:w-2/3">
                  <h3 className="text-xl font-medium mb-2">Create Your Creator Profile</h3>
                  <p className="text-muted-foreground mb-4">
                    Sign up and build your profile showcasing your skills, previous work, and the platforms you create
                    content for.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="md:w-1/3 flex justify-center">
                  <div className="bg-background h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold">
                    2
                  </div>
                </div>
                <div className="md:w-2/3">
                  <h3 className="text-xl font-medium mb-2">Browse Available Contests</h3>
                  <p className="text-muted-foreground mb-4">
                    Explore contests from brands looking for content creators. Filter by platform, deadline, and prize
                    amount to find the perfect opportunity.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="md:w-1/3 flex justify-center">
                  <div className="bg-background h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold">
                    3
                  </div>
                </div>
                <div className="md:w-2/3">
                  <h3 className="text-xl font-medium mb-2">Create & Submit Content</h3>
                  <p className="text-muted-foreground mb-4">
                    Produce content according to the brand's brief and submit it through our platform to be considered
                    for prizes and future opportunities.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="md:w-1/3 flex justify-center">
                  <div className="bg-background h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold">
                    4
                  </div>
                </div>
                <div className="md:w-2/3">
                  <h3 className="text-xl font-medium mb-2">Get Rewarded</h3>
                  <p className="text-muted-foreground mb-4">
                    Win prizes based on your content's performance and quality. Build relationships with brands for
                    ongoing collaborations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Creator Success Stories</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <p className="italic">
                    "Go Viral opened doors to collaborations with brands I've always dreamed of working with. The
                    contests helped me earn extra income while building my portfolio."
                  </p>
                  <div className="mt-4">
                    <p className="font-medium">Alex Rivera</p>
                    <p className="text-sm text-muted-foreground">Lifestyle Creator, 50K followers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <p className="italic">
                    "I started as a small creator, but after winning a few contests on Go Viral, brands started reaching
                    out to me directly. It's been a game-changer for my creative career."
                  </p>
                  <div className="mt-4">
                    <p className="font-medium">Jamie Lee</p>
                    <p className="text-sm text-muted-foreground">Beauty Creator, 100K followers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Start Earning From Your Creativity?</h2>
            <p className="text-xl mb-8">
              Join thousands of creators already using Go Viral to turn their passion into profit.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/signup">
                Join as a Creator <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}


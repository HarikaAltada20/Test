import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Award, BarChart3, Layers, PenTool } from "lucide-react"

export default function BrandsPage() {
  return (
    <div>
      {/* Hero section */}
      <section className="bg-muted py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Create More Content with Less Effort</h1>
            <p className="text-xl mb-8">
              Launch creator contests to generate high-quality, authentic content at scale, while significantly reducing
              your production costs and time.
            </p>
            <Button size="lg" asChild>
              <Link href="/auth/signup">Get Started Today</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Brands Choose Game Of Creators</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Layers className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Content at Scale</h3>
                  <p className="text-muted-foreground">
                    Generate dozens of unique content pieces for a fraction of the cost of traditional production.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <PenTool className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Authentic Creativity</h3>
                  <p className="text-muted-foreground">
                    Tap into creators' authentic voices and unique perspectives to connect with audiences.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">Performance Insights</h3>
                  <p className="text-muted-foreground">
                    See exactly how your content performs and identify winners to scale through paid ads.
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
                  <h3 className="text-xl font-medium mb-2">Create Your Contest</h3>
                  <p className="text-muted-foreground mb-4">
                    Define your brief, set your prize pool, and specify what kind of content you're looking for. Our
                    easy-to-use platform makes it simple to get started.
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
                  <h3 className="text-xl font-medium mb-2">Creators Submit Content</h3>
                  <p className="text-muted-foreground mb-4">
                    Our network of creators will produce content based on your brief. You'll receive submissions through
                    our platform, where you can review and provide feedback.
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
                  <h3 className="text-xl font-medium mb-2">Reward the Best Performers</h3>
                  <p className="text-muted-foreground mb-4">
                    Based on performance metrics and quality, reward the top creators. This incentivizes high-quality
                    content and builds relationships with top-performing creators.
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
          <h2 className="text-3xl font-bold text-center mb-12">What Our Clients Say</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                  </div>
                  <p className="italic">
                    "Game Of Creators revolutionized our content strategy. We received over 50 unique content pieces in just two
                    weeks, and our engagement rates went through the roof."
                  </p>
                  <div className="mt-4">
                    <p className="font-medium">Sarah Johnson</p>
                    <p className="text-sm text-muted-foreground">Marketing Director, Fashion Brand</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                    <Award className="h-5 w-5 text-yellow-500" />
                  </div>
                  <p className="italic">
                    "The quality of content we received was outstanding. The creators really understood our brand and
                    delivered beyond our expectations."
                  </p>
                  <div className="mt-4">
                    <p className="font-medium">Michael Chen</p>
                    <p className="text-sm text-muted-foreground">CEO, Tech Startup</p>
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
            <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Content Strategy?</h2>
            <p className="text-xl mb-8">
              Join hundreds of brands already using Game Of Creators to create authentic content that resonates with their
              audience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/auth/signup">
                  Get Started <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent" asChild>
                <Link href="/contact">Book a Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowRight, BadgeCheck, DollarSign, Zap, Star, Plus, X, Users } from "lucide-react"

// Placeholder for social icons image - replace with actual path if different
import SocialPairPng from "@/public/images/social_pair.png"

const faqItems = [
  {
    id: "faq-1",
    question: "What platforms do you support for content creation?",
    answer:
      "We support a wide range of platforms including TikTok, Instagram Reels, YouTube Shorts, as well as long-form videos for YouTube, podcasts, and interviews. Every piece of content is tailored for optimal quality and performance on its intended platform.",
  },
  {
    id: "faq-2",
    question: "How does the contest and collaboration process work?",
    answer:
      "Brands post briefs for their campaigns or contests. Creators can browse these opportunities, submit their content, and get selected based on quality and engagement. Payments and collaborations are managed through our secure platform.",
  },
  {
    id: "faq-3",
    question: "How do I get paid?",
    answer:
      "Payments for winning contests or completing collaborations are processed securely through our platform. You can link your preferred payment method to receive your earnings directly.",
  },
  {
    id: "faq-4",
    question: "Are there any fees to join as a creator?",
    answer:
      "Joining Game Of Creators is completely free for creators. We believe in empowering you to monetize your skills without upfront costs. We may take a small platform fee from brand payments on successful collaborations.",
  },
]

const testimonials = [
  {
    stars: 5,
    quote: "Game Of Creators revolutionized our content strategy. We received over 50 unique content pieces in just two weeks, and our engagement rates went through the roof.",
    name: "Sarah Johnson",
    title: "Marketing Director, Fashion Brand",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "Working with talented creators on this platform has been a breeze. The quality of content exceeded our expectations, and we saw a significant ROI.",
    name: "Mike Chen",
    title: "Founder, Tech Startup",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "Finally, a platform that truly understands the creator economy. The opportunities are diverse, and the community is incredibly supportive.",
    name: "Aisha Khan",
    title: "Travel Vlogger & Influencer",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 4,
    quote: "The contest feature is fantastic for discovering new talent. We've found some hidden gems who are now regular contributors to our brand.",
    name: "David Miller",
    title: "Head of Content, Food & Beverage Co.",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "As a new creator, Game Of Creators gave me the exposure I needed. I landed my first paid collaboration within a month of joining!",
    name: "Chloe Dubois",
    title: "Lifestyle Content Creator",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "The platform is intuitive, and the support team is always responsive. It made managing multiple brand deals so much simpler.",
    name: "Kenji Tanaka",
    title: "Gaming Streamer & YouTuber",
    avatar: "/images/avatar_placeholder.png",
  },
]

export default function CreatorsPage() {
  return (
    <div className="bg-[#0D1117] text-white">
      {/* New Hero Section */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            {/* Assuming SocialPairPng is the correct image for TikTok, Insta, YouTube icons combined */}
            <Image src={SocialPairPng} alt="Social Media Icons" width={180} height={40} />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Turn Your Creativity<br />Into Income
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Join Game Of Creators to find creative opportunities, collaborate with brands, and get paid for your content.
          </p>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3">
            Start Creating Today!
          </Button>
        </div>
      </section>

      {/* Why Join as a Creator Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Why Join as a Creator</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Earn Money", description: "Get paid for creating content for brands you love through contests and collaborations.", icon: <DollarSign className="h-8 w-8 text-blue-400" />, number: "01" },
              { title: "Build Your Portfolio", description: "Create professional content for recognized brands to showcase in your portfolio.", icon: <BadgeCheck className="h-8 w-8 text-blue-400" />, number: "02" },
              { title: "Grow Your Audience", description: "Gain exposure when brands share and promote your content to their followers.", icon: <Users className="h-8 w-8 text-blue-400" />, number: "03" },
            ].map((item, index) => (
              <div key={index} className="bg-[#161B22] p-8 rounded-xl border border-slate-700/70 shadow-lg text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="bg-slate-700/50 h-16 w-16 rounded-full flex items-center justify-center mb-4 md:mb-0">
                      {item.icon}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-slate-400 block mb-1">{item.number}</span>
                    <h3 className="text-2xl font-semibold mb-3">{item.title}</h3>
                    <p className="text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 md:py-24 bg-[#161B22]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute left-1/2 md:left-8 top-0 bottom-0 w-0.5 bg-slate-700 transform -translate-x-1/2 md:translate-x-0 hidden md:block"></div>
            {[
              { number: "1", title: "Create Your Creator Profile", description: "Sign up and build your profile showcasing your skills, previous work, and the platforms you create content for.", color: "bg-blue-600" },
              { number: "2", title: "Browse Available Contests", description: "Explore contests from brands looking for content creators. Filter by platform, deadline, and prize amount to find the perfect opportunity.", color: "bg-blue-600" },
              { number: "3", title: "Create & Submit Content", description: "Produce content according to the brand's brief and submit it through our platform to be considered for prizes and future opportunities.", color: "bg-blue-600" },
              { number: "4", title: "Get Rewarded", description: "Win prizes based on your content's performance and quality. Build relationships with brands for ongoing collaborations.", color: "bg-green-500" },
            ].map((step, index, arr) => (
              <div key={index} className="mb-12 md:mb-16 flex items-start gap-6 md:gap-8">
                <div className={`relative z-10 h-12 w-12 md:h-16 md:w-16 rounded-full ${step.color} flex items-center justify-center text-xl md:text-2xl font-bold flex-shrink-0`}>
                  {step.number}
                </div>
                <div className="pt-1 md:pt-3">
                  <h3 className="text-xl md:text-2xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-slate-300 leading-relaxed">{step.description}</p>
                </div>
                {index < arr.length - 1 && <div className="absolute left-6 top-14 bottom-[-2rem] w-0.5 bg-slate-700 md:hidden"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-5xl md:text-6xl font-bold text-blue-400 mb-2">3000+</p>
              <p className="text-slate-300">Creators on the platform</p>
            </div>
            <div>
              <p className="text-5xl md:text-6xl font-bold text-blue-400 mb-2">100+</p>
              <p className="text-slate-300">Campaigns delivered</p>
            </div>
            <div>
              <p className="text-5xl md:text-6xl font-bold text-blue-400 mb-2">80M+</p>
              <p className="text-slate-300">Views generated</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-[#161B22]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">What Our Creators & Brands Say</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-[#0D1117] border border-slate-700/70 shadow-xl flex flex-col">
                <CardContent className="pt-8 pb-8 flex flex-col flex-grow">
                  <div className="flex mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-5 w-5 ${i < testimonial.stars ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}`} />
                    ))}
                  </div>
                  <p className="italic text-slate-300 mb-6 flex-grow">"{testimonial.quote}"</p>
                  <div className="flex items-center mt-auto">
                    <Image src={testimonial.avatar} alt={testimonial.name} width={40} height={40} className="rounded-full mr-4" />
                    <div>
                      <p className="font-semibold text-slate-100">{testimonial.name}</p>
                      <p className="text-sm text-slate-400">{testimonial.title}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">FAQ</h2>
            <p className="text-slate-300 text-center mb-12">Here are some frequently asked questions</p>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={item.id} value={item.id} className="border-slate-700/70">
                  <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline py-6 pr-2">
                    <span className="mr-4 text-slate-400 font-medium">{(index + 1).toString().padStart(2, '0')}</span>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 text-base leading-relaxed pb-6 pl-10 pr-2">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Creativity?</h2>
            <p className="text-lg md:text-xl text-slate-100 mb-10">
              Join thousands of creators and brands. Sign up today and unlock your potential!
            </p>
            <Button size="lg" variant="outline" className="bg-white text-blue-600 hover:bg-slate-100 border-white hover:border-slate-100 text-lg px-8 py-3" asChild>
              <Link href="/auth/signup">
                Join Game Of Creators <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}


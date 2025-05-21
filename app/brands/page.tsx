import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Award, BarChart3, Layers, PenTool, Lightbulb, Gauge, CheckCircle, Plus, X, Star } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

// Placeholder for social icons image - reuse from creators page
import SocialPairPng from "@/public/images/social_pair.png"

const faqItemsBrands = [
  {
    id: "faq-brand-1",
    question: "How do I create a contest for creators?",
    answer:
      "Our platform makes it easy. Simply define your campaign brief, set your prize pool, specify the type of content you're looking for (e.g., TikTok videos, Instagram Reels), and launch. Creators in our network will then be able to see and participate in your contest.",
  },
  {
    id: "faq-brand-2",
    question: "How do I ensure content quality and brand alignment?",
    answer:
      "You provide a detailed brief outlining your brand guidelines, key messages, and content expectations. You can review submissions and provide feedback before selecting winners. Many brands also use contests to discover creators for longer-term collaborations.",
  },
  {
    id: "faq-brand-3",
    question: "What kind of results can I expect from creator contests?",
    answer:
      "Results vary, but brands typically receive a diverse range of authentic content pieces at a fraction of traditional production costs. This content can be used for social media, ads, and other marketing channels, often leading to increased engagement, brand awareness, and reach.",
  },
  {
    id: "faq-brand-4",
    question: "How are creators paid and how much does it cost?",
    answer:
      "You set the prize pool for your contest. Payments to winning creators are handled securely through our platform. Our pricing is transparent, typically involving a platform fee on top of the prize money you allocate for creators.",
  },
]

export default function BrandsPage() {
  return (
    <div className="bg-[#0D1117] text-white">
      {/* Hero section */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Image src={SocialPairPng} alt="Social Media Icons" width={180} height={40} />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Create More Content <br /> with Less Effort
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10">
            Launch creator contests to generate high-quality, authentic content at scale, while significantly reducing your production costs and time.
          </p>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-lg px-8 py-3">
            Get Started
          </Button>
        </div>
      </section>

      {/* Why Brands Choose section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Why Brands Choose Game Of Creators</h2>
          <p className="text-lg text-slate-400 text-center mb-16">Simple steps to launch your influencer marketing campaign</p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Content at Scale", description: "Generate dozens of unique content pieces for a fraction of the cost of traditional production.", icon: <Layers className="h-8 w-8 text-blue-400" />, number: "01" },
              { title: "Authentic Creativity", description: "Tap into creators\' authentic voices and unique perspectives to connect with audiences.", icon: <Lightbulb className="h-8 w-8 text-blue-400" />, number: "02" },
              { title: "Performance Insights", description: "See exactly how your content performs and identify winners to scale through paid ads.", icon: <Gauge className="h-8 w-8 text-blue-400" />, number: "03" },
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

      {/* How it works section */}
      <section className="py-16 md:py-24 bg-[#161B22]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="max-w-3xl mx-auto relative">
            <div className="absolute left-1/2 md:left-8 top-0 bottom-0 w-0.5 bg-slate-700 transform -translate-x-1/2 md:translate-x-0 hidden md:block"></div>
            {[
              { number: "1", title: "Create Your Contest", description: "Define your brief, set your prize pool, and specify what kind of content you\'re looking for. Our easy-to-use platform makes it simple to get started.", color: "bg-blue-600" },
              { number: "2", title: "Creators Submit Content", description: "Our network of creators will produce content based on your brief. You\'ll receive submissions through our platform, where you can review and provide feedback.", color: "bg-blue-600" },
              { number: "3", title: "Reward the Best Performers", description: "Based on performance metrics and quality, reward the top creators. This incentivizes high-quality content and builds relationships with top-performing creators.", color: "bg-green-500" },
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

      {/* Stats section */}
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

      {/* FAQ section */}
      <section className="py-16 md:py-24 bg-[#161B22]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">FAQ</h2>
            <p className="text-slate-300 text-center mb-12">Here are some frequently asked questions</p>
            <Accordion type="single" collapsible className="w-full">
              {faqItemsBrands.map((item, index) => (
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

      {/* CTA section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Content Strategy?</h2>
            <p className="text-lg md:text-xl text-slate-100 mb-10">
              Launch your first contest today and witness the power of creator-generated content.
            </p>
            <Button size="lg" variant="outline" className="bg-white text-blue-600 hover:bg-slate-100 border-white hover:border-slate-100 text-lg px-8 py-3" asChild>
              <Link href="/auth/signup">
                Launch a Contest <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}


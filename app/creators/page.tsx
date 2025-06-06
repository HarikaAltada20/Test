import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ArrowRight, BadgeCheck, DollarSign, Zap, Star, Plus, X, Users, Crown, Sparkles, Target, TrendingUp, Trophy, Rocket, Shield, Palette, Camera, Heart, Award, Gift } from "lucide-react"

// Placeholder for social icons image - replace with actual path if different
import SocialPairPng from "@/public/images/social_pair.png"

const faqItems = [
  {
    id: "faq-1",
    question: "What platforms do you support for content creation?",
    answer:
      "We support a wide range of platforms including Instagram Reels, YouTube Shorts, as well as long-form videos for YouTube, podcasts, and interviews. Every piece of content is tailored for optimal quality and performance on its intended platform.",
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

const creatorTestimonials = [
  {
    stars: 5,
    quote: "Finally, a platform that truly understands the creator economy. The opportunities are diverse, and the community is incredibly supportive.",
    name: "Aisha Khan",
    title: "Travel Vlogger & Influencer",
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
  {
    stars: 4,
    quote: "Game Of Creators helped me turn my passion into a full-time income. The contest format pushes me to create my best work every time.",
    name: "Marcus Rivera",
    title: "Fitness Influencer & Coach",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "The quality of brands on this platform is incredible. I've worked with some amazing companies and built lasting relationships.",
    name: "Sophie Williams",
    title: "Beauty Content Creator",
    avatar: "/images/avatar_placeholder.png",
  },
  {
    stars: 5,
    quote: "From zero followers to 100K in 8 months thanks to the exposure from brand collaborations. This platform changed my life!",
    name: "Alex Thompson",
    title: "Tech Reviewer & YouTuber",
    avatar: "/images/avatar_placeholder.png",
  },
]

export default function CreatorsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Strategic Background Elements */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(139,92,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,rgba(236,72,153,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]"></div>

        {/* Precision Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
      </div>

      {/* Floating Creative Elements */}
      <div className="fixed inset-0 z-10 pointer-events-none">
        <Sparkles className="absolute top-20 left-10 h-6 w-6 text-amber-400/30 animate-pulse" />
        <Camera className="absolute top-32 right-20 h-5 w-5 text-violet-400/40 animate-bounce" style={{ animationDelay: '1s' }} />
        <Star className="absolute top-40 left-1/4 h-4 w-4 text-purple-400/30 animate-pulse" style={{ animationDelay: '2s' }} />
        <Heart className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce" style={{ animationDelay: '0.5s' }} />
        <Palette className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse" style={{ animationDelay: '1.5s' }} />
        <Trophy className="absolute bottom-32 right-12 h-5 w-5 text-amber-400/40 animate-bounce" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="relative z-20">
        {/* Epic Creator Hero Section */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative">
          <div className="container mx-auto px-4 text-center">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600/20 to-orange-600/20 backdrop-blur-sm border border-amber-400/30 rounded-full px-6 py-3 mb-8 shadow-xl shadow-amber-500/20">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-semibold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                #1 Creator Gaming Platform
              </span>
            </div>

            {/* Enhanced Social Icons */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-700/60 p-4 rounded-2xl border border-amber-400/20 backdrop-blur-md shadow-xl shadow-amber-500/10">
                  <Image src={SocialPairPng} alt="Social Media Icons" width={180} height={40} className="relative z-10" />
                </div>
              </div>
            </div>

            {/* Massive Gaming Title */}
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-6 leading-tight">
              <span className="block text-white drop-shadow-2xl">
                Turn Your Creativity
              </span>
              <span className="block text-white drop-shadow-2xl">
                Into{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent font-black animate-pulse">
                    Income
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl animate-pulse"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p className="text-xl md:text-2xl text-slate-300 max-w-4xl mx-auto mb-12 leading-relaxed drop-shadow-lg">
              Join Game Of Creators to find creative <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">opportunities</span>, collaborate with brands, and get paid for your <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">content</span>
            </p>

            {/* Epic CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:via-orange-500 hover:to-yellow-500 text-white font-bold px-10 py-4 rounded-xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-105 border border-amber-400/30 text-lg overflow-hidden"
                asChild
              >
                <Link href="/auth/signup">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  <Palette className="mr-3 h-5 w-5" />
                  <span className="relative z-10">I'm a Creator</span>
                  <Rocket className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="group bg-slate-900/50 border-2 border-amber-400/30 text-white hover:text-white hover:bg-amber-600/20 hover:border-amber-400/50 backdrop-blur-sm font-bold px-10 py-4 rounded-xl transition-all duration-300 hover:scale-105 text-lg"
                asChild
              >
                <Link href="/brands">
                  <Crown className="mr-3 h-5 w-5" />
                  <span>I'm a Brand</span>
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Why Join as Creator - Gaming Style */}
        <section className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-black mb-6 text-white drop-shadow-xl">
                Why Join as a Creator
              </h2>
              <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                Unlock your creative potential and monetize your passion
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Earn Money",
                  description: "Get paid for creating content for brands you love through contests and collaborations.",
                  icon: <DollarSign className="h-10 w-10" />,
                  number: "01",
                  gradient: "from-emerald-600 to-teal-600",
                  accentColor: "emerald"
                },
                {
                  title: "Build Your Portfolio",
                  description: "Create professional content for recognized brands to showcase in your portfolio.",
                  icon: <BadgeCheck className="h-10 w-10" />,
                  number: "02",
                  gradient: "from-violet-600 to-purple-600",
                  accentColor: "violet"
                },
                {
                  title: "Grow Your Audience",
                  description: "Gain exposure when brands share and promote your content to their followers.",
                  icon: <Users className="h-10 w-10" />,
                  number: "03",
                  gradient: "from-amber-600 to-orange-600",
                  accentColor: "amber"
                },
              ].map((item, index) => (
                <div key={index} className="group relative">
                  {/* Gaming Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full">
                    {/* Number Badge */}
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r ${item.gradient} text-white font-black text-lg mb-6 shadow-lg`}>
                      {item.number}
                    </div>

                    {/* Icon */}
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r ${item.gradient} bg-opacity-20 border border-${item.accentColor}-400/30 mb-6 text-${item.accentColor}-400`}>
                      {item.icon}
                    </div>

                    <h3 className="text-2xl font-bold mb-4 text-white">{item.title}</h3>
                    <p className="text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gaming How It Works */}
        <section className="py-20 md:py-32 relative">
          {/* Section Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-black mb-6 text-white drop-shadow-xl">
                How It Works
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto rounded-full"></div>
            </div>

            <div className="max-w-4xl mx-auto">
              {[
                {
                  number: "1",
                  title: "Create Your Creator Profile",
                  description: "Sign up and build your profile showcasing your skills, previous work, and the platforms you create content for.",
                  icon: <Users className="h-8 w-8" />,
                  gradient: "from-violet-600 to-purple-600"
                },
                {
                  number: "2",
                  title: "Browse Available Contests",
                  description: "Explore contests from brands looking for content creators. Filter by platform, deadline, and prize amount to find the perfect opportunity.",
                  icon: <Target className="h-8 w-8" />,
                  gradient: "from-blue-600 to-indigo-600"
                },
                {
                  number: "3",
                  title: "Create & Submit Content",
                  description: "Produce content according to the brand's brief and submit it through our platform to be considered for prizes and future opportunities.",
                  icon: <Camera className="h-8 w-8" />,
                  gradient: "from-amber-600 to-orange-600"
                },
                {
                  number: "4",
                  title: "Get Rewarded",
                  description: "Win prizes based on your content's performance and quality. Build relationships with brands for ongoing collaborations.",
                  icon: <Gift className="h-8 w-8" />,
                  gradient: "from-emerald-600 to-teal-600"
                },
              ].map((step, index) => (
                <div key={index} className="mb-16 group">
                  <div className="flex items-start gap-8">
                    {/* Epic Number Circle */}
                    <div className="relative flex-shrink-0">
                      <div className={`absolute inset-0 bg-gradient-to-r ${step.gradient} rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500`}></div>
                      <div className={`relative w-20 h-20 rounded-full bg-gradient-to-r ${step.gradient} flex items-center justify-center text-2xl font-bold text-white shadow-2xl border-4 border-white/20`}>
                        {step.number}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${step.gradient} bg-opacity-20 border border-amber-400/30 flex items-center justify-center text-amber-400`}>
                          {step.icon}
                        </div>
                        <h3 className="text-3xl font-bold text-white">{step.title}</h3>
                      </div>
                      <p className="text-xl text-slate-300 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Epic Stats Section */}
        <section className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { number: "3000+", label: "Creators on Platform", icon: <Users className="h-8 w-8" />, gradient: "from-violet-600 to-purple-600" },
                { number: "100+", label: "Campaigns Delivered", icon: <Rocket className="h-8 w-8" />, gradient: "from-blue-600 to-indigo-600" },
                { number: "80M+", label: "Views Generated", icon: <TrendingUp className="h-8 w-8" />, gradient: "from-amber-600 to-orange-600" },
              ].map((stat, index) => (
                <div key={index} className="group text-center">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-3xl blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40`}></div>
                    <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto mb-6`}>
                        {stat.icon}
                      </div>
                      <p className={`text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                        {stat.number}
                      </p>
                      <p className="text-xl text-slate-300 font-semibold">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gaming Testimonials Section */}
        <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-6xl font-black mb-6 text-white drop-shadow-xl">
                What Creators Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {creatorTestimonials.map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-5 w-5 ${i < testimonial.stars ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">"{testimonial.quote}"</p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold mr-4">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{testimonial.name}</p>
                        <p className="text-sm text-slate-400">{testimonial.title}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gaming FAQ Section */}
        <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-6xl font-black mb-6 text-white drop-shadow-xl">FAQ</h2>
                <p className="text-xl text-slate-300">Here are some frequently asked questions</p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqItems.map((item, index) => (
                  <AccordionItem key={item.id} value={item.id} className="border-0">
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-amber-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12">
                          {item.answer}
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>

        {/* Epic Final CTA */}
        <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/30 via-orange-900/30 to-yellow-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Sparkles className="h-16 w-16 text-amber-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-5xl md:text-7xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Creativity</span>?
              </h2>

              <p className="text-2xl text-slate-300 mb-12 leading-relaxed">
                Join thousands of creators and brands. Sign up today and unlock your potential!
              </p>

              <Button
                size="lg"
                className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:via-orange-500 hover:to-yellow-500 text-white font-bold px-12 py-6 rounded-2xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-110 border border-amber-400/30 text-xl overflow-hidden"
                asChild
              >
                <Link href="/auth/signup">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  <Sparkles className="mr-4 h-6 w-6" />
                  <span className="relative z-10">Join Game Of Creators</span>
                  <ArrowRight className="ml-4 h-6 w-6 transition-transform group-hover:translate-x-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


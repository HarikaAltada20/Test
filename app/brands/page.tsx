import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Award, BarChart3, Layers, PenTool, Lightbulb, Gauge, CheckCircle, Plus, X, Star, Crown, Sparkles, Target, TrendingUp, Zap, Trophy, Rocket, Shield, Users } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import BrandGetStartedButton from '@/components/BrandGetStartedButton'
import BrandLaunchContestButton from '@/components/BrandLaunchContestButton'

// Placeholder for social icons image - reuse from creators page
import SocialPairPng from "@/public/images/social_pair.png"

const faqItemsBrands = [
  {
    id: "faq-brand-1",
    question: "What are contests? And How does it work?",
    answer:
      "There are <strong>two types of contests</strong> on Game of Creators: <strong>Leaderboard</strong> and <strong>CPM-based contests</strong>. These contests allow brands to crowdsource a large volume of creator content quickly by launching a competitive campaign.<br><br><strong>How it works:</strong><br>• You set a total prize pool, define your brief and rules<br>• Creators submit videos posted organically on their own YouTube or Instagram accounts<br>• At the end of the contest (typically lasting 3-28 days, set by you), creators with the most views win and split the prize money based on your payout structure<br>• Plus, you own all the winning content, giving you a library of performance-tested videos for paid ads<br><br>It's the fastest way to test multiple hooks, formats, and creators all at once and get viral marketing with hundreds of creators.",
  },
  {
    id: "faq-brand-2",
    question: "How are the contest payouts/prizes structured?",
    answer:
      "You have <strong>full control</strong> over how the prize pool is distributed among winners. Prizes are awarded based on organic views, and you can structure payouts to align with your campaign goals.<br><br><strong>Example:</strong> On a $1,000 contest, you could have 10 winners at $100 each, or 40 winners with this prize distribution:<br><br>• <strong>1st Place:</strong> $300 (A strong, attractive top prize)<br>• <strong>2nd Place:</strong> $150<br>• <strong>3rd Place:</strong> $75<br>• <strong>4th-10th Place</strong> (7 winners): $25 each ($175 total)<br>• <strong>11th-40th Place</strong> (30 winners): $10 each ($300 total)<br><br>The prize pool and distribution are set before your contest goes live, ensuring clarity and consistency in payouts.",
  },
  {
    id: "faq-brand-3",
    question: "What if my contest gets no views?",
    answer:
      "Game of Creators operates on a <strong>supply-and-demand model</strong>, ensuring that your contest won't go unnoticed. With a large network of eager creators, there's always someone ready to compete for your prize pool.<br><br>The prize pool creates an incentive for submissions, which generate views as creators post organically to their audiences. If engagement is lower than expected, we are here to help refine your brief or strategy to maximize participation and results.",
  },
  {
    id: "faq-brand-4",
    question: "How much should I run a contest for?",
    answer:
      "The ideal budget depends on your campaign goals:<br><br><strong>Optimizing for Paid Ads:</strong> Allocate more winners with smaller prizes for a diverse range of content.<br><br><strong>Maximizing Organic Reach:</strong> Offer fewer but larger payouts to attract top-tier creators for viral, organic reach.<br><br>We recommend starting with at least <strong>$1,000</strong>, but contests can begin with as little as <strong>$50</strong>. There is no upper limit.",
  },
  {
    id: "faq-brand-5",
    question: "How do I track conversions?",
    answer:
      "To track conversions effectively, Game of Creators tracks views and engagement on the organic content posted by influencers:<br><br><strong>View and Engagement Metrics:</strong> After the contest launches, creators post content on their Instagram or YouTube accounts. You can track the views, likes, shares, and other engagement metrics to evaluate each post's performance.<br><br><strong>Custom Call-to-Actions (CTAs):</strong> You can require creators to include a CTA in their content, such as visiting your website or downloading your app, making it easier to connect content performance with measurable outcomes.",
  },
  {
    id: "faq-brand-6",
    question: "Do I own the winning content?",
    answer:
      "<strong>Yes, you own the winning content outright and forever.</strong> This means you have full rights to repost, edit, or use it across any platform, including in paid ads.",
  },
  {
    id: "faq-brand-7",
    question: "How can Game of Creators help me find content-market fit?",
    answer:
      "By running a contest, you gain access to diverse content from creators, helping you quickly identify which content formats resonate with your audience. You'll also discover top-performing creators who can become long-term partners.<br><br>Game of Creators accelerates your path to content-market fit by streamlining testing, learning, and scaling what works for your brand.",
  },
  {
    id: "faq-brand-8",
    question: "How do I know views are real?",
    answer:
      "Game of Creators is a <strong>YouTube and Instagram-approved platform</strong>, with access to their APIs. This ensures all views and engagement metrics come directly from verified data, providing accurate and trustworthy analytics.<br><br>Any creator attempting to manipulate metrics will be removed from the platform, ensuring transparency and quality results for your campaigns.",
  },
  {
    id: "faq-brand-9",
    question: "Where will the videos be posted?",
    answer:
      "Videos will be posted directly on the creators' <strong>organic YouTube and Instagram accounts</strong>, ensuring they reach genuine audiences in an authentic way. This approach maximizes exposure and leverages the creators' established following for better results.",
  },
  {
    id: "faq-brand-10",
    question: "How are creators paid?",
    answer:
      "Game of Creators handles all creator payments seamlessly for you. Once the contest ends and winners are determined based on organic views, we distribute the prize money directly to the winning creators' wallets.<br><br>From there, they can request a withdrawal at any time through their preferred payment method—<strong>Crypto, Bank Transfer, or UPI</strong>. The only condition is that the payout must be at least <strong>$20</strong>.<br><br>This ensures a smooth process, so you don't have to worry about managing individual payments or logistics.",
  },
]

export default function BrandsPage() {
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

      {/* Floating Gaming Elements */}
      <div className="fixed inset-0 z-10 pointer-events-none">
        <Crown className="absolute top-20 left-10 h-6 w-6 text-violet-400/30 animate-pulse" />
        <Trophy className="absolute top-32 right-20 h-5 w-5 text-amber-400/40 animate-bounce" style={{ animationDelay: '1s' }} />
        <Star className="absolute top-40 left-1/4 h-4 w-4 text-purple-400/30 animate-pulse" style={{ animationDelay: '2s' }} />
        <Sparkles className="absolute top-60 right-1/3 h-5 w-5 text-indigo-400/40 animate-bounce" style={{ animationDelay: '0.5s' }} />
        <Zap className="absolute bottom-40 left-16 h-6 w-6 text-yellow-400/30 animate-pulse" style={{ animationDelay: '1.5s' }} />
        <Target className="absolute bottom-32 right-12 h-5 w-5 text-cyan-400/40 animate-bounce" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="relative z-20">
        {/* Epic Hero Section */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative">
          <div className="container mx-auto px-4 text-center">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600/20 to-purple-600/20 backdrop-blur-sm border border-violet-400/30 rounded-full px-6 py-3 mb-8 shadow-xl shadow-violet-500/20">
              <Crown className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                #1 Gamified Creator Marketing Platform
              </span>
            </div>

            {/* Enhanced Social Icons */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-purple-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-700/60 p-4 rounded-2xl border border-violet-400/20 backdrop-blur-md shadow-xl shadow-violet-500/10">
                  <Image src={SocialPairPng} alt="Social Media Icons" width={180} height={40} className="relative z-10" />
                </div>
              </div>
            </div>

            {/* Massive Gaming Title */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight">
              <span className="block text-white drop-shadow-2xl">
                Make your product
              </span>
              <span className="block text-white drop-shadow-2xl">
                go{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent font-black animate-pulse">
                    VIRAL
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-red-400/20 blur-3xl animate-pulse"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed drop-shadow-lg">
              Launch strategic creator <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">contests</span> and achieve viral success with <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">guaranteed results</span>
            </p>

            {/* Epic CTA Button */}
            <div className="flex justify-center items-center mb-12">
              <BrandGetStartedButton />
            </div>
          </div>
        </section>

        {/* Why Brands Choose - Gaming Style */}
        <section className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                Why Brands Choose Game Of Creators
              </h2>
              <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                Simple steps to launch your influencer marketing campaign
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Content at Scale",
                  description: "Generate dozens of unique content pieces for a fraction of the cost of traditional production.",
                  icon: <Layers className="h-10 w-10" />,
                  number: "01",
                  gradient: "from-violet-600 to-purple-600",
                  accentColor: "violet"
                },
                {
                  title: "Authentic Creativity",
                  description: "Tap into creators' authentic voices and unique perspectives to connect with audiences.",
                  icon: <Lightbulb className="h-10 w-10" />,
                  number: "02",
                  gradient: "from-amber-600 to-orange-600",
                  accentColor: "amber"
                },
                {
                  title: "Performance Insights",
                  description: "See exactly how your content performs and identify winners to scale through paid ads.",
                  icon: <TrendingUp className="h-10 w-10" />,
                  number: "03",
                  gradient: "from-emerald-600 to-teal-600",
                  accentColor: "emerald"
                },
              ].map((item, index) => (
                <div key={index} className="group relative">
                  {/* Gaming Glow Effect */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`}></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full">
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
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                How It Works
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-violet-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <div className="max-w-4xl mx-auto">
              {[
                {
                  number: "1",
                  title: "Create Your Contest",
                  description: "Define your brief, set your prize pool, and specify what kind of content you're looking for. Our easy-to-use platform makes it simple to get started.",
                  icon: <PenTool className="h-8 w-8" />,
                  gradient: "from-violet-600 to-purple-600"
                },
                {
                  number: "2",
                  title: "Creators Submit Content",
                  description: "Our network of creators will produce content based on your brief. You'll receive submissions through our platform, where you can review and provide feedback.",
                  icon: <Users className="h-8 w-8" />,
                  gradient: "from-blue-600 to-indigo-600"
                },
                {
                  number: "3",
                  title: "Reward Top Performers",
                  description: "Based on performance metrics and quality, reward the top creators. This incentivizes high-quality content and builds relationships with top-performing creators.",
                  icon: <Trophy className="h-8 w-8" />,
                  gradient: "from-amber-600 to-orange-600"
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
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${step.gradient} bg-opacity-20 border border-violet-400/30 flex items-center justify-center text-violet-400`}>
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
        {/* <section className="py-20 md:py-32 relative">
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
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-violet-400/30 flex items-center justify-center text-violet-400 mx-auto mb-6`}>
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
      </section> */}

        {/* Gaming Brand Testimonials Section */}
        <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                What Brands Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-violet-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  stars: 5,
                  quote: "Game Of Creators revolutionized our content strategy. We received over 50 unique content pieces in just two weeks, and our engagement rates went through the roof.",
                  name: "Sarah Johnson",
                  title: "Marketing Director, Fashion Brand",
                },
                {
                  stars: 5,
                  quote: "Working with talented creators on this platform has been a breeze. The quality of content exceeded our expectations, and we saw a significant ROI.",
                  name: "Mike Chen",
                  title: "Founder, Tech Startup",
                },
                {
                  stars: 4,
                  quote: "The contest feature is fantastic for discovering new talent. We've found some hidden gems who are now regular contributors to our brand.",
                  name: "David Miller",
                  title: "Head of Content, Food & Beverage Co.",
                },
                {
                  stars: 5,
                  quote: "The platform's analytics helped us identify our best-performing content creators. We've scaled our campaigns 300% while reducing costs by 60%.",
                  name: "Emma Rodriguez",
                  title: "CMO, E-commerce Platform",
                },
                {
                  stars: 5,
                  quote: "Game Of Creators delivered results beyond our expectations. The quality and authenticity of content from creators has transformed our brand presence.",
                  name: "James Wilson",
                  title: "Brand Manager, Consumer Goods",
                },
                {
                  stars: 4,
                  quote: "Finally, a platform that understands both brand needs and creator capabilities. The collaboration process is seamless and results-driven.",
                  name: "Lisa Chen",
                  title: "Head of Digital Marketing, SaaS Company",
                },
              ].map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`h-5 w-5 ${i < testimonial.stars ? "text-violet-400 fill-violet-400" : "text-slate-600"}`} />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">"{testimonial.quote}"</p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold mr-4">
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
                <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">FAQ</h2>
                <p className="text-xl text-slate-300">Here are some frequently asked questions</p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqItemsBrands.map((item, index) => (
                  <AccordionItem key={item.id} value={item.id} className="border-0">
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-violet-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12"
                          dangerouslySetInnerHTML={{
                            __html: item.answer
                          }}
                        />
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
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/30 via-purple-900/30 to-indigo-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Crown className="h-16 w-16 text-violet-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">Content Strategy</span>?
              </h2>

              <p className="text-xl text-slate-300 mb-12 leading-relaxed">
                Launch your first contest today and witness the power of creator-generated content.
              </p>

              <BrandLaunchContestButton />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}


"use client"

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import socialPairIcon from "@/public/images/social_pair.png";
import {
  ArrowRight,
  ChevronDown,
  Zap,
  Trophy,
  Users,
  Target,
  Gamepad2,
  Sparkles,
  Star,
  Play,
  TrendingUp,
  Award,
  Crown,
  Rocket,
  Heart,
  Eye,
  Share2,
  BarChart3,
  Palette,
  Camera,
  Video,
  MessageCircle,
  ThumbsUp,
  Globe,
  Shield
} from "lucide-react";

// Helper component for Creator Avatars with gaming aesthetic
const AvatarCircle = ({ src, alt, isActive = false }: { src: string, alt: string, isActive?: boolean }) => (
  <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden border-3 ${isActive ? 'border-yellow-400 shadow-lg shadow-yellow-400/50' : 'border-purple-500/50'} -ml-3 first:ml-0 bg-gradient-to-br from-purple-600 to-pink-600 flex-shrink-0 transition-all duration-300 hover:scale-110 hover:z-10`}>
    <Image src={src} alt={alt} width={56} height={56} className="object-cover w-full h-full" />
    {isActive && <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full border-2 border-slate-900 animate-pulse"></div>}
  </div>
);

// Floating Animation Component
const FloatingElement = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <div
    className="animate-float"
    style={{
      animationDelay: `${delay}s`,
      animation: `float 6s ease-in-out infinite ${delay}s`
    }}
  >
    {children}
  </div>
);

export function HeroSection() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Refined Background Elements - More Subtle */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(139,92,246,0.15),transparent)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.15),transparent)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.1),transparent)]"></div>

      {/* Precision Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

      {/* Floating Gaming Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <FloatingElement delay={0}>
          <div className="absolute top-20 left-10 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg rotate-45 opacity-60"></div>
        </FloatingElement>
        <FloatingElement delay={2}>
          <div className="absolute top-40 right-20 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full opacity-60"></div>
        </FloatingElement>
        <FloatingElement delay={4}>
          <div className="absolute bottom-60 left-20 w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full opacity-60"></div>
        </FloatingElement>
        <FloatingElement delay={1}>
          <Trophy className="absolute top-32 right-10 h-6 w-6 text-yellow-400/60" />
        </FloatingElement>
        <FloatingElement delay={3}>
          <Star className="absolute bottom-40 right-40 h-5 w-5 text-pink-400/60" />
        </FloatingElement>
        <FloatingElement delay={5}>
          <Sparkles className="absolute top-60 left-40 h-7 w-7 text-cyan-400/60" />
        </FloatingElement>
      </div>

      {/* Main Hero Content */}
      <div className="relative flex flex-col items-center justify-center min-h-screen py-12 sm:py-20 px-4">
        {/* Refined Badge with Better Contrast */}
        <div className="mb-6 sm:mb-8">
          <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-8 py-3 text-sm font-bold border border-violet-400/30 hover:from-violet-500 hover:to-purple-500 transition-all duration-300 hover:scale-105 shadow-xl shadow-violet-500/25 backdrop-blur-sm">
            <Crown className="mr-2 h-4 w-4" />
            #1 Creator Platform
          </Badge>
        </div>

        {/* Refined Social Icons with Premium Feel */}
        <div className="mb-8 sm:mb-10 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl"></div>
          <div className="relative p-6 bg-slate-900/80 rounded-3xl border border-violet-400/20 backdrop-blur-md shadow-2xl shadow-violet-500/10">
            <Image
              src={socialPairIcon}
              alt="Social Media Icons"
              width={120}
              height={75}
              priority
              className="transition-all duration-300 hover:scale-110 drop-shadow-lg"
            />
          </div>
        </div>

        {/* Precision-Crafted Main Title */}
        <div className="text-center space-y-8 max-w-6xl relative">
          <div className="relative">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9]">
              <span className="block text-white drop-shadow-2xl">Turn Your</span>
              <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent font-black tracking-wider">
                creativity
              </span>
              <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl mt-4 relative">
                <span className="text-white">into </span>
                <span className="inline-block relative">
                  <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent font-black tracking-wider">
                    SUCCESS
                  </span>
                  <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-red-500 rounded-full"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Accent Elements */}
            <div className="absolute -top-6 -left-6 w-3 h-3 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full animate-pulse"></div>
            <div className="absolute top-20 -right-8 w-2 h-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-10 left-10 w-1 h-1 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-pulse delay-2000"></div>
          </div>

          <p className="text-xl md:text-2xl text-slate-200 max-w-3xl mx-auto leading-relaxed font-medium">
            Connect <span className="text-violet-400 font-bold">brands</span> with <span className="text-amber-400 font-bold">creators</span> through strategic contests and achieve viral success with
            <span className="text-emerald-400 font-bold"> guaranteed results</span>
          </p>
        </div>

        {/* Premium CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 mt-12 sm:mt-16 relative">
          <Link href="/brands" passHref>
            <Button
              size="lg"
              className="group relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold px-12 py-4 text-lg rounded-2xl shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 hover:scale-105 border border-violet-400/20 overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
              <Crown className="mr-3 h-5 w-5" />
              I'm a Brand
              <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/creators" passHref>
            <Button
              size="lg"
              className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:via-orange-500 hover:to-red-500 text-white font-bold px-12 py-4 text-lg rounded-2xl shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 hover:scale-105 border border-amber-400/20 overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
              <Palette className="mr-3 h-5 w-5" />
              I'm a Creator
              <Sparkles className="ml-3 h-5 w-5 transition-transform group-hover:rotate-180" />
            </Button>
          </Link>
        </div>

        {/* Premium Creator Showcase */}
        <div className="mt-16 flex flex-col items-center space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <span className="text-slate-300 text-lg font-semibold">Join 50,000+ Active Creators</span>
            <div className="flex items-center">
              {['/placeholder-creator-1.jpg', '/placeholder-creator-2.jpg', '/placeholder-creator-3.jpg', '/placeholder-creator-4.jpg', '/placeholder-creator-5.jpg'].map((src, index) => (
                <AvatarCircle key={index} src={src} alt={`Creator ${index + 1}`} isActive={index === 2} />
              ))}
              <div className="ml-2 text-sm text-slate-400 font-medium">+49,995 more</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-8 text-slate-300">
            <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-emerald-400/20">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">2,847 creators online</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-amber-400/20">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium">$2.5M+ rewards paid</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-violet-400/20">
              <Eye className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-medium">100M+ views generated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Gallery Section */}
      <section className="relative w-full pb-16 md:pb-24 lg:pb-32 bg-gradient-to-t from-slate-900/90 to-transparent">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
              🎨 Creative Showcase
            </h3>
            <p className="text-slate-400">Discover viral content created by our amazing creators</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { type: 'video', views: '2.1M', likes: '89K' },
              { type: 'photo', views: '1.5M', likes: '67K' },
              { type: 'video', views: '890K', likes: '45K' },
              { type: 'photo', views: '1.2M', likes: '78K' }
            ].map((item, index) => (
              <div key={index} className="group relative aspect-square bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/60 transition-all duration-300 hover:scale-105">
                <Image
                  src={`/placeholder-gallery-${index + 1}.jpg`}
                  alt={`Creative showcase ${index + 1}`}
                  width={400}
                  height={400}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute bottom-4 left-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="flex items-center justify-between text-white text-sm">
                    <div className="flex items-center gap-2">
                      {item.type === 'video' ? <Video className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                      <span>{item.views} views</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-red-400" />
                      <span>{item.likes}</span>
                    </div>
                  </div>
                </div>
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Gaming Style */}
      <section className="relative w-full py-16 md:py-24 bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2 text-sm font-bold border-0 mb-6">
              🎮 Level Up Your Marketing
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-6">
              How Game Of Creators Works
            </h2>
            <p className="max-w-3xl text-slate-300 text-lg md:text-xl mx-auto leading-relaxed">
              Three simple steps to launch your viral marketing campaign and dominate the game
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                title: "CREATE A CONTEST",
                description: "Set up your epic campaign with budget, requirements, and creative challenges for creators to conquer.",
                icon: Trophy,
                color: "from-yellow-400 to-orange-500",
                step: "01"
              },
              {
                title: "REVIEW APPLICATIONS",
                description: "Creators compete for your contest! Review their profiles and select the champions that match your brand.",
                icon: Users,
                color: "from-purple-400 to-pink-500",
                step: "02"
              },
              {
                title: "TRACK RESULTS",
                description: "Watch your campaign go viral! Monitor real-time performance metrics and celebrate your success.",
                icon: TrendingUp,
                color: "from-cyan-400 to-blue-500",
                step: "03"
              },
            ].map((step, index) => (
              <div key={index} className="group relative">
                {/* Step Number */}
                <div className="absolute -top-4 -left-4 z-10">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${step.color} flex items-center justify-center text-black font-black text-lg shadow-lg`}>
                    {step.step}
                  </div>
                </div>

                {/* Card */}
                <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-8 rounded-3xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm group-hover:shadow-2xl group-hover:shadow-purple-500/25">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${step.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className="h-8 w-8 text-black" />
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all duration-300">
                      {step.title}
                    </h3>

                    <p className="text-slate-300 leading-relaxed mb-6">
                      {step.description}
                    </p>

                    <div className="flex items-center text-purple-400 font-semibold group-hover:text-pink-400 transition-colors duration-300">
                      <span>Start now</span>
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-2" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose - Enhanced Gaming Style */}
      <section className="relative w-full py-16 md:py-24 bg-gradient-to-t from-slate-900 via-slate-800/50 to-slate-900">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 text-sm font-bold border-0 mb-6">
              🏆 Why We're #1
            </Badge>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent mb-6">
              Why Choose Game Of Creators
            </h2>
            <p className="max-w-3xl text-slate-300 text-lg md:text-xl mx-auto leading-relaxed">
              We're not just a platform - we're your competitive advantage in the creator economy
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-12 items-stretch mb-16">
            {/* Enhanced Main Feature */}
            <div className="lg:col-span-5 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-700/90 p-8 rounded-3xl border border-purple-500/30 backdrop-blur-sm hover:border-purple-500/60 transition-all duration-500">
                <div className="absolute top-4 right-4">
                  <Crown className="h-8 w-8 text-yellow-400" />
                </div>
                <Image
                  src="/placeholder-feature-main.jpg"
                  alt="Diverse creators collaborating"
                  width={450}
                  height={600}
                  className="rounded-2xl object-cover max-h-[400px] w-full"
                />
                <div className="mt-6 text-center">
                  <h3 className="text-2xl font-bold text-white mb-2">50,000+ Active Creators</h3>
                  <p className="text-slate-300">From gaming to lifestyle - every niche covered</p>
                </div>
              </div>
            </div>

            {/* Enhanced Features Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                {
                  title: "Authentic Content",
                  description: "Generate genuine, viral-worthy content that your audience will love and share.",
                  icon: Heart,
                  color: "from-red-400 to-pink-500",
                  metric: "95% authentic rate"
                },
                {
                  title: "Real-Time Analytics",
                  description: "Track every view, like, and conversion with our advanced analytics dashboard.",
                  icon: BarChart3,
                  color: "from-blue-400 to-cyan-500",
                  metric: "Live tracking"
                },
                {
                  title: "Easy Management",
                  description: "Manage all your campaigns from one intuitive, game-like dashboard interface.",
                  icon: Gamepad2,
                  color: "from-purple-400 to-purple-600",
                  metric: "5-min setup"
                },
                {
                  title: "Targeted Reach",
                  description: "Connect with creators whose audiences perfectly match your ideal customers.",
                  icon: Target,
                  color: "from-green-400 to-emerald-500",
                  metric: "98% match rate"
                },
              ].map((item, index) => (
                <div key={item.title} className="group relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  {/* Metric Badge */}
                  <div className="absolute top-4 right-4">
                    <Badge className={`bg-gradient-to-r ${item.color} text-white text-xs px-2 py-1 border-0`}>
                      {item.metric}
                    </Badge>
                  </div>

                  <div className="relative z-10">
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${item.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all duration-300">
                      {item.title}
                    </h3>

                    <p className="text-slate-300 text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Bottom Row */}
          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            <div className="group bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-8 rounded-3xl border border-green-500/20 hover:border-green-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm text-center">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-green-400 to-emerald-500 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Cost Effective</h3>
              <p className="text-slate-300 leading-relaxed mb-4">Get 10x better ROI compared to traditional advertising. Every dollar counts!</p>
              <Badge className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-3 py-1 text-sm border-0">
                Average 400% ROI
              </Badge>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-8 rounded-3xl border border-cyan-500/20 hover:border-cyan-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 to-blue-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <Image
                src="/placeholder-laptop-dashboard.jpg"
                alt="Gaming-style dashboard"
                width={300}
                height={200}
                className="rounded-2xl object-cover w-full mb-4"
              />
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2">Gaming Dashboard</h3>
                <p className="text-slate-300 text-sm">Level up your campaigns with our intuitive interface</p>
              </div>
            </div>

            <div className="group bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-8 rounded-3xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm text-center">
              <div className="inline-flex p-4 rounded-2xl bg-gradient-to-r from-purple-400 to-purple-600 mb-6 group-hover:scale-110 transition-transform duration-300">
                <Award className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">24/7 Support</h3>
              <p className="text-slate-300 leading-relaxed mb-4">Our gaming experts are always ready to help you win big!</p>
              <Badge className="bg-gradient-to-r from-purple-400 to-purple-600 text-white px-3 py-1 text-sm border-0">
                Always Online
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Stats Section */}
      <section className="relative w-full py-16 md:py-24 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(147,51,234,0.1),transparent)]"></div>
        <div className="container px-4 md:px-6 mx-auto relative">
          <div className="text-center mb-12">
            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 text-sm font-bold border-0 mb-6">
              🎯 Game Stats
            </Badge>
            <h2 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Level Up Your Success
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { value: "50K+", label: "Active Creators", icon: Users, color: "from-purple-400 to-purple-600" },
              { value: "$2.5M+", label: "Rewards Paid", icon: Trophy, color: "from-yellow-400 to-orange-500" },
              { value: "100M+", label: "Views Generated", icon: Eye, color: "from-cyan-400 to-blue-500" }
            ].map((stat, index) => (
              <div key={index} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-8 rounded-3xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm">
                  <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${stat.color} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </h3>
                  <p className="text-slate-400 uppercase tracking-wider text-sm font-bold">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced FAQ Section */}
      <section className="relative w-full py-16 md:py-24 bg-gradient-to-t from-slate-900 via-slate-800/50 to-slate-900">
        <div className="container px-4 md:px-6 mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <Badge className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2 text-sm font-bold border-0 mb-6">
              ❓ Got Questions?
            </Badge>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-6">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-300 text-lg">
              Everything you need to know about dominating the creator game
            </p>
          </div>

          <div className="space-y-6">
            {[
              {
                q: "What makes Game Of Creators different from other platforms?",
                a: "We're the only platform that gamifies creator marketing with contests, leaderboards, and achievement systems. Plus, we guarantee results or your money back!"
              },
              {
                q: "How quickly can I launch my first contest?",
                a: "You can create and launch your first contest in under 5 minutes! Our streamlined process gets you from idea to viral campaign faster than any competitor."
              },
              {
                q: "Do you guarantee results?",
                a: "Yes! We're so confident in our platform that we offer performance guarantees. If your campaign doesn't meet the agreed metrics, we'll refund your investment."
              },
              {
                q: "What types of creators are on your platform?",
                a: "We have 50,000+ verified creators across every niche - gaming, lifestyle, tech, fashion, fitness, food, and more. From micro-influencers to mega creators!"
              },
              {
                q: "How do you ensure content quality?",
                a: "All our creators go through a rigorous vetting process. Plus, our AI-powered matching system ensures you only work with creators who align with your brand values."
              },
            ].map((faqItem, index) => (
              <details key={index} className="group bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 backdrop-blur-sm">
                <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all duration-300">
                  {faqItem.q}
                  <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform duration-300 group-open:text-purple-400" />
                </summary>
                <p className="text-slate-300 mt-4 pt-4 border-t border-slate-700/50 leading-relaxed">
                  {faqItem.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Epic CTA Section */}
      <section className="relative w-full py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-cyan-900"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.4),transparent)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,119,198,0.4),transparent)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,rgba(59,130,246,0.4),transparent)]"></div>

        <div className="container px-4 md:px-6 mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="mb-8">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-3 text-base font-black border-0 mb-8">
                🚀 Ready to Go Viral?
              </Badge>
            </div>

            <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white mb-8 leading-tight">
              Join the
              <span className="block bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Creator Revolution
              </span>
            </h2>

            <p className="text-xl md:text-2xl text-slate-200 mb-12 max-w-3xl mx-auto leading-relaxed">
              50,000+ creators, 1,000+ brands, millions of viral moments.
              <span className="text-yellow-400 font-bold"> Your turn to dominate! </span>
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
              <Link href="/auth/signup" passHref>
                <Button size="lg" className="group relative bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-black font-black px-12 py-6 text-xl rounded-2xl shadow-2xl shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all duration-300 hover:scale-110 border-0 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  <Rocket className="mr-3 h-6 w-6" />
                  Start Your Campaign
                  <Sparkles className="ml-3 h-6 w-6 transition-transform group-hover:rotate-180" />
                </Button>
              </Link>
              <Link href="/contact-demo" passHref>
                <Button size="lg" className="group relative bg-white/10 hover:bg-white/20 text-white font-bold px-12 py-6 text-xl rounded-2xl border-2 border-white/30 hover:border-white/60 backdrop-blur-sm transition-all duration-300 hover:scale-105">
                  <Play className="mr-3 h-6 w-6" />
                  Watch Demo
                  <ArrowRight className="ml-3 h-6 w-6 transition-transform group-hover:translate-x-2" />
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-slate-300 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-400" />
                <span>100% Secure</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                <span>Instant Setup</span>
              </div>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-purple-400" />
                <span>Guaranteed Results</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-400" />
                <span>Global Reach</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

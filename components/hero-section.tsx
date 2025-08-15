"use client"

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import socialPairIcon from "@/public/images/social_pair.png";
import vContentCreatorsImg from "@/public/images/v_content_creators.png";
import contentCreatorsImg from "@/public/images/content_creators.png";
import { HERO_TAGLINES, TAGLINE_ROTATION_INTERVAL } from "@/lib/constants";
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

// Rotating Tagline Component
const RotatingTagline = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);

      setTimeout(() => {
        setCurrentIndex((prevIndex) =>
          prevIndex === HERO_TAGLINES.length - 1 ? 0 : prevIndex + 1
        );
        setIsVisible(true);
      }, 300); // Half second for fade out/in

    }, TAGLINE_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className={`text-lg md:text-xl bg-gradient-to-r from-slate-200 to-slate-100 bg-clip-text text-transparent max-w-2xl mx-auto leading-relaxed font-medium tracking-wide transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
        }`}
    >
      {HERO_TAGLINES[currentIndex]}
    </p>
  );
};

// Feature Card component for consistent styling
const FeatureCard = ({ icon, title, description, className }: { icon: React.ReactNode, title: string, description: string, className?: string }) => (
  <div className={`group relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm flex flex-col justify-between h-full ${className}`}>
    <div className="flex items-center mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-300 text-sm">{description}</p>
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
            #1 Gamified Creator Marketing Platform
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
        <div className="text-center space-y-6 max-w-5xl relative">
          <div className="relative">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[0.95]">
              <span className="block text-white drop-shadow-2xl">Game Of Creators</span>
              <span className="block text-xl sm:text-2xl md:text-3xl lg:text-4xl mt-3 font-bold">
                <span className="text-white">Where </span>
                <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent font-black">
                  Creators
                </span>
                <span className="text-white"> and </span>
                <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent font-black">
                  Brands
                </span>
                <span className="text-white"> Win Together</span>
              </span>
            </h1>

            {/* Strategic Accent Elements */}
            <div className="absolute -top-6 -left-6 w-3 h-3 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full animate-pulse"></div>
            <div className="absolute top-20 -right-8 w-2 h-2 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse delay-1000"></div>
            <div className="absolute bottom-10 left-10 w-1 h-1 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-pulse delay-2000"></div>
          </div>

          <RotatingTagline />
        </div>

        {/* Premium CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-10 sm:mt-12 relative">
          <Link href="/brands" passHref>
            <Button
              size="lg"
              className="group relative bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-bold px-10 py-3 text-base rounded-2xl shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 hover:scale-105 border border-violet-400/20 overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
              <Crown className="mr-2 h-4 w-4" />
              I'm a Brand
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="/creators" passHref>
            <Button
              size="lg"
              className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-500 hover:via-orange-500 hover:to-red-500 text-white font-bold px-10 py-3 text-base rounded-2xl shadow-2xl shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 hover:scale-105 border border-amber-400/20 overflow-hidden backdrop-blur-sm"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
              <Palette className="mr-2 h-4 w-4" />
              I'm a Creator
              <Sparkles className="ml-2 h-4 w-4 transition-transform group-hover:rotate-180" />
            </Button>
          </Link>
        </div>

        {/* Premium Creator Showcase */}
        {/* <div className="mt-16 flex flex-col items-center space-y-6">
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
        </div> */}
      </div>

      {/* Animated Gallery Section */}
      {/* <section className="relative w-full pb-16 md:pb-24 lg:pb-32 bg-gradient-to-t from-slate-900/90 to-transparent">
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
      </section> */}

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                title: "Brands Create a Contest",
                description: (
                  <>
                    <span className="font-semibold">Share your vision.</span>
                    <br />
                    Describe your product, set the rules, and offer a prize. Decide how you want creators to promote your brand or product.
                  </>
                ),
                icon: Trophy,
                color: "from-yellow-400 to-orange-500",
                step: "01"
              },
              {
                title: "Open to Everyone",
                description: (
                  <>
                    <span className="font-semibold">Creators of all follower counts can join any contest that inspires them.</span>
                    <br />
                    Pick a challenge, show your creativity, and stand out!
                  </>
                ),
                icon: Users,
                color: "from-purple-400 to-pink-500",
                step: "02"
              },
              {
                title: "Win, Track, and Own Results",
                description: (
                  <>
                    <span className="font-semibold">Creators get paid. Brands get results.</span>
                    <br />
                    Creators win prize money. Brands track results and own the winning content.
                  </>
                ),
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

                  <div className="relative z-10 min-h-[260px] flex flex-col justify-between">
                    <div>
                      <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${step.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                        <step.icon className="h-8 w-8 text-black" />
                      </div>

                      <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all duration-300">
                        {step.title}
                      </h3>

                      <p className="text-slate-300 leading-relaxed mb-6">
                        {step.description}
                      </p>
                    </div>
                    <Link href="/dashboard" passHref>
                      <div className="flex items-center text-purple-400 font-semibold group-hover:text-pink-400 transition-colors duration-300 cursor-pointer">
                        <span>Start now</span>
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-2" />
                      </div>
                    </Link>
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
              The smarter way to scale creator content and results—without the hassle.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Card: spans 2 rows and 2 columns */}
            <div className="lg:row-span-2 lg:col-span-2 flex flex-col justify-end relative overflow-hidden {`group relative bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 hover:scale-105 backdrop-blur-sm flex flex-col justify-between h-full">
              <div className="absolute top-4 right-4 z-10">
                <Crown className="h-8 w-8 text-yellow-400" />
              </div>
              {/* Responsive image: horizontal (desktop) uses v_content_creators, vertical (mobile) uses content_creators */}
              <div className="">
                <Image
                  src={vContentCreatorsImg}
                  alt="Diverse creators collaborating (horizontal)"
                  width={600}
                  height={300}
                  className="rounded-2xl object-cover max-h-[400px] w-full hidden lg:block"
                  priority
                />
                <Image
                  src={contentCreatorsImg}
                  alt="Diverse creators collaborating (vertical)"
                  width={400}
                  height={400}
                  className="rounded-2xl object-cover max-h-[400px] w-full block lg:hidden"
                  priority
                />
              </div>
              <div className="mt-6 text-center">
                <h3 className="text-2xl font-bold text-white mb-2">Organic Content at Scale</h3>
                <p className="text-slate-300">
                  With Game Of Creators, you generate a high volume of diverse, high-quality content—without the hassle of sourcing, negotiating, or managing creators manually.
                </p>
              </div>
            </div>
            {/* Top row, right of main card */}
            <FeatureCard
              icon={<Award className="h-6 w-6 text-yellow-400" />}
              title="Only Pay for Top Performing Content"
              description="Stop wasting money on content that doesn’t convert. Pay only for videos that perform."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6 text-pink-400" />}
              title="Skip the Creator Outreach Hassle"
              description="No more hours spent negotiating, coordinating, and following up. With Game Of Creators, the creators come to you."
            />
            <FeatureCard
              icon={<Heart className="h-6 w-6 text-red-400" />}
              title="Find Content-Market Fit"
              description="Validate creative concepts with real audience engagement."
            />
            {/* Second row, right of main card */}
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6 text-cyan-400" />}
              title="Supply and Demand Based Platform"
              description="Game Of Creators operates on a supply and demand model. Creators compete, allowing the best ideas to surface organically and driving higher engagement and reach."
            />
            <FeatureCard
              icon={<Rocket className="h-6 w-6 text-green-400" />}
              title="Scale Winners on Paid Ads"
              description="Identify the best-performing content and seamlessly scale it into paid campaigns. With proven, audience-validated content, your ads drive higher engagement, lower costs, and better conversions."
            />
            <FeatureCard
              icon={<Award className="h-6 w-6 text-purple-400" />}
              title="24/7 Support"
              description="Our team is always ready to help you win big with Game Of Creators!"
            />
            {/* New: Democratized Brand Deals */}
            <FeatureCard
              icon={<Globe className="h-6 w-6 text-blue-400" />}
              title="Democratized Brand Deals"
              description="Every creator, no matter their follower count, can join and win. Success is based on creativity and performance—not just popularity."
            />
            {/* New: Creator Freedom of Choice */}
            <FeatureCard
              icon={<Palette className="h-6 w-6 text-orange-400" />}
              title="Creator Freedom of Choice"
              description="Creators choose which brands and campaigns to promote, empowering them to work with what they love and get paid for it."
            />
          </div>
        </div>
      </section>

      {/* Enhanced Stats Section */}
      {/* <section className="relative w-full py-16 md:py-24 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20">
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
      </section> */}

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
                q: "What is Game of Creators?",
                a: "<strong>Game of Creators democratizes brand deals</strong> by allowing any creator—even those with zero followers—to participate in contests and earn money based purely on <strong>performance and views</strong>.<br><br><strong>For brands,</strong> this system is a game-changer: a single contest can inspire <strong>hundreds to thousands of creators</strong> to generate viral marketing content for your product. You get <strong>widespread promotion</strong> and a <strong>huge variety of content</strong>, yet you only reward the <strong>best-performing creators</strong>, ensuring you pay just for the most impactful results."
              },
              {
                q: "Game of Creators is for whom?",
                a: "<strong>Brands:</strong> Especially B2C Brands looking to promote their products or services.<br><br><strong>Creators:</strong> Content creators of all sizes who are looking to earn brand deals but have struggled due to low followers. Now, performance and views are what matter, not follower count."
              },
              {
                q: "What are the key features of Game of Creators?",
                a: "<strong>🎯 Organic Content at Scale:</strong> Generate high-quality, diverse content without manual sourcing<br><br><strong>💰 Only Pay for Top Performing Content:</strong> Pay for content that drives results<br><br><strong>🚀 Creator Outreach Hassle-Free:</strong> Creators come to you<br><br><strong>⚖️ Supply and Demand Platform:</strong> Creators compete, ensuring top ideas rise to the top<br><br><strong>📈 Scale Winners:</strong> Scale top-performing content into paid campaigns<br><br><strong>🌍 Democratized Brand Deals:</strong> Success is based on creativity and performance<br><br><strong>🎨 Creator Freedom of Choice:</strong> Creators choose which brands to work with"
              },
              {
                q: "How does someone participate or sign up for Game of Creators?",
                a: "<strong>1. Sign up</strong> by registering on the platform and choosing whether you are a <strong>brand</strong> or a <strong>creator</strong>.<br><br><strong>2. For Brands:</strong> Create & launch a contest for viral marketing<br><br><strong>3. For Creators:</strong> Browse available contests, participate, and get paid based on your performance"
              },
              {
                q: "What are the main benefits for participants?",
                a: "<strong>🎯 Full Control:</strong> Choose which brands to promote<br><br><strong>🔍 Full Transparency:</strong> Access to leaderboard rankings, views, and payment details<br><br><strong>🚀 Performance-Based:</strong> Your followers no longer limit your opportunities—performance and views are what matter"
              },
              {
                q: "How long does the event or contest last?",
                a: "Contests typically last between 3 to 28 days, depending on the brand's selection."
              },
              {
                q: "What are the prizes or rewards for the winners?",
                a: "<strong>🏆 Leaderboard-based contests:</strong> Prizes are distributed based on rankings.<br><br><strong>Example:</strong> $1000 prize pool with five winners:<br>• <strong>Rank 1:</strong> $500<br>• <strong>Rank 2:</strong> $250<br>• <strong>Rank 3:</strong> $150<br>• <strong>Rank 4:</strong> $75<br>• <strong>Rank 5:</strong> $25<br><br><strong>📊 CPM-based contests:</strong> Paid based on views, for example, $1 per 1000 views, with minimum and maximum view limits."
              },
              {
                q: "What kind of support is available to participants?",
                a: "<strong>Brands provide a complete contest brief</strong> including:<br>• Required resources<br>• Inspirational links<br>• Detailed guidance<br><br><strong>Need help?</strong> You can always reach out for assistance or clarification!"
              },
              {
                q: "What happens if a participant misses a deadline?",
                a: "Content must be submitted during the live contest period. Submissions must be posted on YouTube or Instagram and linked to the contest within two hours of posting. Late submissions won't be accepted."
              },
              {
                q: "How are participants judged or evaluated?",
                a: "Judging is based purely on views. Participants must follow the contest's brief, rules, and guidelines to be eligible for payment."
              },
              {
                q: "How can participants track their progress?",
                a: "Creators can track all their submissions in My submissions section and see their ranking of each contest they participated by visiting that contest leaderboard section."
              },
              {
                q: "Can participants submit multiple entries?",
                a: "No, participants can only submit one entry per contest."
              },
              {
                q: "Will there be networking opportunities?",
                a: "Yes, creators can join our community channels and follow us on social media for networking and engagement."
              },
              {
                q: "How are winners or top creators announced?",
                a: "Winners are announced after the contest ends and after a verification process based on views and rankings."
              }
            ].map((faqItem, index) => (
              <details key={index} className="group bg-gradient-to-br from-slate-800/80 to-slate-700/80 p-6 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 transition-all duration-500 backdrop-blur-sm">
                <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all duration-300">
                  {faqItem.q}
                  <ChevronDown className="h-5 w-5 text-slate-400 group-open:rotate-180 transition-transform duration-300 group-open:text-purple-400" />
                </summary>
                <div className="text-slate-300 mt-4 pt-4 border-t border-slate-700/50 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: faqItem.a
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/\n• /g, '</p><p>• ')
                      .replace(/\n/g, '<br>')
                  }}
                />
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Epic CTA Section */}
      {/* <section className="relative w-full py-20 md:py-32 overflow-hidden">
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
      </section> */}

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

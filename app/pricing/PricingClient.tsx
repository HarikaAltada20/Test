"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  Info,
  Trophy,
  Star,
  Zap,
  Users,
  Gift,
  Sparkles,
  Camera,
  Palette,
  ArrowRight,
  Heart,
  Crown,
  Calendar,
  AlertTriangle,
  Building2,
  Loader2,
  UserCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";

import { createClient } from "@/utils/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";
import { useRouter } from "next/navigation";
import socialPair from "@/public/images/social_pair.avif";
import startdemo from "@/public/images/startdemo.avif";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
// import FAQ from "@/components/FAQ";
// Define PlanFeatures and SubscriptionPlan types (ensure consistency)
type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  commissionPercentage: number;
  contestTypes?: string[];
  analytics?: string;
  support?: string;
  description?: string;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  displayName?: string;
  price: number; // Assuming price is stored in cents
  features: PlanFeatures;
};

// Rotating tagline component
const RotatingTagline = () => {
  const taglines = [
    "The World's First Platform to Democratize Brand Deals",
    "World's First Viral Creator Marketing Platform",
    "Where Creators and Brands Win Together",
  ];

  const [currentTagline, setCurrentTagline] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentTagline((prev) => (prev + 1) % taglines.length);
        setIsVisible(true);
      }, 300);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className={`text-lg md:text-xl text-gray-600 mb-6 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"
        }`}
    >
      {taglines[currentTagline]}
    </p>
  );
};
const plans = [
  {
    title: "Lifetime Access to Winning Content",
    description:
      "Keep all the winning content from contest to use in your campaigns forever.",
  },
  {
    title: "Organic Content Validation",
    description:
      "Test and validate your content with real, engaged audiences to find what works best.",
  },
  {
    title: "Authentic Creator Network",
    description:
      "Access to our growing community of verified creators across all platforms.",
  },
  {
    title: "Secure Payment Processing",
    description:
      "Safe and secure payment handling for all contest prizes and platform fees.",
  },
];
export default function PricingClient() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [user, setUser] = useState<any>(null);
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);
  const [section1Visible, setSection1Visible] = useState(false);
  const [section2Visible, setSection2Visible] = useState(false);

  const [userType, setUserType] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const supabase = createClient(); // Initialize Supabase client
  const router = useRouter();
  const storyRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // State for fetched plans, loading, and error
  const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    setBillingCycle((prev) => (prev === "monthly" ? "yearly" : "monthly"));
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (storyRef.current) observer.observe(storyRef.current);

    return () => {
      if (storyRef.current) observer.unobserve(storyRef.current);
    };
  }, [isLoadingUser, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSection1Visible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (section1Ref.current) observer.observe(section1Ref.current);

    return () => {
      if (section1Ref.current) observer.unobserve(section1Ref.current);
    };
  }, [isLoadingUser, isLoading]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSection2Visible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (section2Ref.current) observer.observe(section2Ref.current);

    return () => {
      if (section2Ref.current) observer.unobserve(section2Ref.current);
    };
  }, [isLoadingUser, isLoading]);


  // Check for authenticated user
  useEffect(() => {
    const checkUser = async () => {
      setIsLoadingUser(true);
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          setUser(authUser);

          // Get user type
          const { data: userData } = await supabase
            .from("users")
            .select("user_type")
            .eq("id", authUser.id)
            .single();

          if (userData) {
            setUserType(userData.user_type);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setIsLoadingUser(false);
      }
    };

    checkUser();
  }, [supabase]);

  // Load subscription plans from constants (new system)
  useEffect(() => {
    const loadSubscriptionPlans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Import plans from constants (new subscription system)
        const { subscriptionPlans } = await import(
          "@/constants/subscriptionPlans"
        );
        console.log("🔍 Subscription Plans:", subscriptionPlans);
        // Convert to the format expected by the UI
        const mappedPlans: SubscriptionPlan[] = subscriptionPlans.map(
          (plan) => ({
            id: plan.id, // Now real Stripe product ID
            name: plan.name,
            displayName: plan.displayName,
            price: plan.price, // Already in cents
            features: {
              maxActiveContests: plan.features.maxActiveContests,
              minContestBudget: plan.features.minContestBudget,
              maxWinnersPerContest: plan.features.maxWinnersPerContest,
              commissionPercentage: plan.features.commissionPercentage,
              contestTypes: plan.features.contestTypes,
              analytics: plan.features.analytics,
              support: plan.features.support,
              description: plan.features.description,
            },
          })
        );

        setDbSubscriptionPlans(mappedPlans);
      } catch (error: any) {
        console.error("Error loading subscription plans:", error);
        setError(`Failed to load pricing plans: ${error.message}`);
        setDbSubscriptionPlans([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptionPlans();
  }, []); // No dependencies needed since we're using constants

  const handleBillingCycleChange = (value: string) => {
    setBillingCycle(value as "monthly" | "yearly");
  };

  // Calculate yearly pricing (20% discount)
  const getDiscountedPrice = (price: number) => {
    return Math.round(price * 12 * 0.8);
  };

  // Core features shown in the hero section
  const coreFeatures = [
    "Launch gamified creator contests",
    "Access to 5,000+ verified creators",
    "Full content ownership & rights",
    "Real-time analytics dashboard",
    "Branded contest landing pages",
  ];

  // FAQ items from the FAQ data
  const faqItems = [
    {
      question: "How are the creator payouts / prizes structured?",
      answer:
        "You control how the prize pool is split. For example: 3 winners: $500 / $300 / $200, or 5 winners: $400 / $250 / $150 / $100 / $100. You define this upfront in your contest brief, and creators compete to win based on real engagement.",
    },
    {
      question: "What if my contest gets no views?",
      answer:
        "Creators are incentivized to promote their content because views = prizes. This means they actively push their posts to friends, followers, and beyond to maximize reach. It's like having a motivated marketing team built in. If results fall short, we can help you optimize your brief or strategy for next time—at no extra cost.",
    },
    {
      question: "How many creators are on Game Of Creators?",
      answer:
        "We have a fast-growing network of 5,000+ active creators across various niches. When you launch a contest, it goes live to all eligible creators through our dashboard and email system—ensuring visibility and participation.",
    },
    {
      question: "How much should I run a contest for?",
      answer:
        "It depends on your goal: $1,000–$2,000 for a range of quality UGC entries, $500+ for niche campaigns or specific messaging, higher payouts attract creators with larger audiences. We'll help you structure it based on your goals—whether that's more entries, more reach, or better-quality content.",
    },
    {
      question: "Do I own the content?",
      answer:
        "Yes, once a contest ends and winners are announced, you get full rights to download and repurpose all winning content for your brand's marketing use—including ads, social posts, website use, etc. Non-winning content may still be available upon request or with creator permission, depending on your use case.",
    },
    {
      question: "How do you help me find my content-market fit?",
      answer:
        "We help you test different content styles and creator personalities to see what resonates with your audience. This process of testing various approaches helps you discover the most effective way to present your product or service to your target market.",
    },
    {
      question: "How do I know the views are real?",
      answer:
        "All content links are public, and we provide platform-specific analytics that you can verify. You can see actual engagement metrics from the platforms where the content is posted.",
    },
    {
      question: "What type of creators are on the platform?",
      answer:
        "Our platform hosts a diverse range of creators across different niches including lifestyle, tech, beauty, fitness, food, gaming, and more. We have creators with followings ranging from micro-influencers to those with larger audiences, ensuring you can find the perfect match for your brand's voice and target audience.",
    },
    {
      question: "How long does a typical contest run?",
      answer:
        "Most contests run for 7-14 days, which gives creators enough time to develop quality content while maintaining momentum and excitement. However, you have flexibility to set shorter or longer timeframes depending on your specific goals and campaign urgency.",
    },
    {
      question: "Can I run multiple contests simultaneously?",
      answer:
        "Yes! Depending on your subscription plan, you can run multiple contests at the same time. This is perfect for testing different content approaches, targeting various audience segments, or launching campaigns across multiple products simultaneously.",
    },
  ];

  // Company logos (placeholders - should be replaced with actual logos)
  const companyLogos = [
    "/logos/logo1.svg",
    "/logos/logo2.svg",
    "/logos/logo3.svg",
    "/logos/logo4.svg",
    "/logos/logo5.svg",
    "/logos/logo6.svg",
  ];

  // Add getPlanIcon and getPlanColor helpers
  const getPlanIcon = (planName: string) => {
    if (!planName) return <Trophy className="h-5 w-5" />;
    const name = planName.toUpperCase();
    if (name === "CHAMPION" || name === "CHAMPION PLAN")
      return <Crown className="h-5 w-5" />;
    if (name === "BUILDER" || name === "BUILDER PLAN")
      return <Star className="h-5 w-5" />;
    if (name === "STARTER" || name === "STARTER PLAN")
      return <Zap className="h-5 w-5" />;
    if (name === "EXPLORER" || name === "EXPLORER PLAN" || name === "FREE")
      return <Trophy className="h-5 w-5" />;
    return <Trophy className="h-5 w-5" />;
  };
  const getPlanColor = (planName: string) => {
    if (!planName) return "from-gray-500 to-gray-600";
    const name = planName.toUpperCase();
    if (name === "CHAMPION" || name === "CHAMPION PLAN")
      return "from-yellow-500 to-orange-600";
    if (name === "BUILDER" || name === "BUILDER PLAN")
      return "from-purple-500 to-blue-600";
    if (name === "STARTER" || name === "STARTER PLAN")
      return "from-orange-500 to-red-600";
    if (name === "EXPLORER" || name === "EXPLORER PLAN" || name === "FREE")
      return "from-green-500 to-teal-600";
    return "from-gray-500 to-gray-600";
  };

  // Show loading state while checking user authentication
  if (isLoadingUser) {
    return (
      <div className="container min-h-screen bg-[#000825] flex items-center justify-center">
        {/* <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          <p className="text-gray-300 text-lg">Loading...</p>
        </div> */}
       <PageLoadingSpinner mode="dark" />
      </div>
    );
  }

  // Show creator message if logged in as creator
  if (user && userType === "creator") {
    return (
      <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
        {/* <div className="text-center mb-8">
            <div className="mx-auto p-4 rounded-full bg-blue-100 w-fit mb-4">
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Creator Account Detected
            </h1>
            <p className="text-lg text-gray-600 mb-6">
              This pricing page is designed for brands and advertisers who want
              to launch creator contests.
            </p>
          </div> */}
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
          {/* Strategic Background Elements */}

          {/* Floating Creative Elements */}
          <div className="inset-0 z-10 pointer-events-none">
            <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
            <Sparkles
              className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
              style={{ animationDelay: "1s" }}
            />
            <Star
              className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
              style={{ animationDelay: "2s" }}
            />
            <Heart
              className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
              style={{ animationDelay: "0.5s" }}
            />
            <Palette
              className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
              style={{ animationDelay: "1.5s" }}
            />
            <Trophy
              className="absolute bottom-32 right-20 h-9 w-9 text-amber-400/40 animate-bounce"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          {/* Orange Ellipse Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1100px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 bg-[#FFFFFF1A] rounded-full px-4 py-2 sm:px-6 sm:py-3 mb-8 flex-wrap">
              <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              <span className="text-base sm:text-lg font-semibold bg-white bg-clip-text text-transparent text-center">
                #1 Gamified Creator Marketing Platform
              </span>
            </div>

            {/* Enhanced Social Icons */}
            <div className="flex justify-center mb-8">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <Image
                    src={socialPair}
                    alt="Social Media Icons"
                    width={150}
                    height={40}
                    className="relative z-10"
                  />
                </div>
              </div>
            </div>

            {/* Massive Gaming Title */}
            <h1
              className="text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl flex flex-wrap justify-center gap-x-2 gap-y-1 mb-6 leading-tight text-center slide-up"
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Creator Account
              </span>

              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                <span className="relative">
                  <span
                    className="bg-clip-text text-transparent"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, #7F39EC 34.91%, #BC83FA 78.79%)",
                    }}
                  >
                    Detected
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              This pricing page is designed for brands and advertisers who want
              to launch creator contests.
            </p>
          </div>
        </section>

        <Alert className="max-w-7xl mx-auto border border-yellow-400 bg-yellow-500/20 text-yellow-500 rounded-md shadow-sm">
          <AlertTriangle className="h-5 w-5" color="#facc15" />
          <AlertDescription className="mt-[2px] text-md">
            <strong>For Creators:</strong> You don't need a subscription to
            participate in contests. Simply browse available opportunities and
            submit your content to win prizes!
          </AlertDescription>
        </Alert>

        <div className="max-w-[1250px] py-12 mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-[#000825] rounded-2xl text-white hover:bg-[#B16FF43D] hover:shadow-lg hover:scale-105 transition border-2 border-[#7F39EC] hover:border-2 hover:border-[#7F39EC] cursor-pointer">
            <CardHeader className="mb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="rounded-full p-2 border flex items-center justify-center">
                  <Trophy className="h-6 w-6 text-white" />
                </div>
                How It Works for Creators
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                "Browse available contests",
                "Submit your content",
                "Win prizes based on performance",
                "No subscription required",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="rounded-full p-3 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                    }}
                  >
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-lg">{text}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[#000825] rounded-2xl text-white hover:bg-[#B16FF43D] border-2 border-[#7F39EC] hover:shadow-lg hover:scale-105 transition hover:border-2 hover:border-[#7F39EC] cursor-pointer">
            <CardHeader className="mb-2">
              <CardTitle className="flex items-center gap-3">
                <div className="rounded-full p-2 border flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                For Brands & Advertisers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                "Launch creator contests",
                "Access to 5,000+ creators",
                "Full content ownership",
                "Subscription plans available",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="rounded-full p-3 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                    }}
                  >
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-lg">{text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="pb-16 text-center">
          <Button
            asChild
            className="rounded-3xl mt-8 relative text-white text-white font-bold px-8 py-6 text-lg overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
            }}
          >
            <div className="scan-line"></div>
            <Link href="/dashboard/opportunities">
              Browse Available Contests
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
      {/* Hero Section */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
        {/* Strategic Background Elements */}

        {/* Floating Creative Elements */}
        <div className="inset-0 z-10 pointer-events-none">
          <Sparkles className="absolute top-20 left-10 h-8 w-8 text-amber-400/30 animate-pulse" />
          <Sparkles
            className="absolute top-32 right-20 h-9 w-9 text-violet-400/40 animate-bounce"
            style={{ animationDelay: "1s" }}
          />
          <Star
            className="absolute top-40 left-1/4 h-9 w-9 text-purple-400/30 animate-pulse"
            style={{ animationDelay: "2s" }}
          />
          <Heart
            className="absolute top-60 right-1/3 h-5 w-5 text-pink-400/40 animate-bounce"
            style={{ animationDelay: "0.5s" }}
          />
          <Palette
            className="absolute bottom-40 left-16 h-6 w-6 text-indigo-400/30 animate-pulse"
            style={{ animationDelay: "1.5s" }}
          />
          <Trophy
            className="absolute bottom-32 right-20 h-9 w-9 text-amber-400/40 animate-bounce"
            style={{ animationDelay: "0.8s" }}
          />
        </div>
        {/* Orange Ellipse Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1100px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

        <div className="container mx-auto px-4 text-center relative z-10">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 bg-[#FFFFFF1A] rounded-full px-4 py-2 sm:px-6 sm:py-3 mb-8 flex-wrap">
            <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            <span className="text-base sm:text-lg font-semibold bg-white bg-clip-text text-transparent text-center">
              #1 Gamified Creator Marketing Platform
            </span>
          </div>

          {/* Enhanced Social Icons */}
          <div className="flex justify-center mb-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <Image
                  src={socialPair}
                  alt="Social Media Icons"
                  width={150}
                  height={40}
                  className="relative z-10"
                />
              </div>
            </div>
          </div>

          {/* Massive Gaming Title */}
          <h1
            className="text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl flex flex-wrap justify-center gap-x-2 gap-y-1 mb-6 leading-tight text-center slide-up"
            style={{ animationDelay: "1s" }}
          >
            <span
              className="font-semibold text-white drop-shadow-2xl"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Game Of Creators
            </span>

            <span
              className="font-semibold text-white drop-shadow-2xl"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              <span className="relative">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, #7F39EC 34.91%, #BC83FA 78.79%)",
                  }}
                >
                  Pricing
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
              </span>
            </span>
          </h1>

          {/* Strategic Subtitle */}
          <p
            className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
            style={{ animationDelay: "2s" }}
          >
            The World's First Platform to Democratise Brand Deals
          </p>
        </div>
      </section>

      {/* All Pricing Plans */}
      <div id="pricing" className="scroll-mt-20 px-4">
        {/* Show subscription management for authenticated advertisers */}
        {user && userType === "advertiser" ? (
          <div className="mx-auto">
            <div className="text-center pt-16 mb-12">
              {/* <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">
                Manage Your Subscription
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upgrade, downgrade, or manage your current subscription plan
              </p> */}

              <h2
                className="text-3xl md:text-5xl slide-up font-semibold transition-all duration-700 mb-4 ease-out transform"
                style={{ animationDelay: "1s" }}
              >
                Manage Your{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",

                    display: "inline",
                  }}
                >
                  Subscription
                </span>
              </h2>
              <p
                className="text-lg slide-left md:text-xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg"
                style={{ animationDelay: "1.5s" }}
              >
                Upgrade, downgrade, or manage your current subscription plan
              </p>
            </div>
            <SubscriptionManagement />
          </div>
        ) : (
          <>
            <div ref={section1Ref} className="text-center mt-10 mb-10">
              {/* Header with Image */}
              <div className="flex items-center justify-center gap-2 bg-[#121230] inline-flex px-4 py-2 rounded-full mb-4">
                <img
                  src="/images/Vector.png" // ← replace with your actual image path
                  alt="Payment Plan"
                  className="w-5 h-5"
                />
                <span className="text-sm">Select the ideal payment plan</span>
              </div>
              <h2
                className={`text-3xl md:text-5xl font-bold mb-4 ${section1Visible ? "slide-up" : "opacity-0"
                  }`}
              >
                Choose Your Game <span className="text-purple-400">Plan</span>
              </h2>
              <p
                className={`${section1Visible ? "slide-left" : "opacity-0"
                  } text-gray-300 text-lg md:text-xl mb-8`}
              >
                Select the perfect plan to start winning with creator contests
              </p>

              {/* Not logged in message */}
              {/* {!user && (
                <Alert className="mt-6 max-w-2xl mx-auto">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      <strong>Not logged in?</strong> You'll need to create a
                      Brand account to subscribe to a plan.
                    </span>
                    <Button
                      onClick={() => {
                        localStorage.setItem("signupRole", "brand");
                        router.push("/auth/signup");
                      }}
                      className="ml-4 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white font-medium px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 border-0"
                    >
                      Sign up here
                    </Button>
                  </AlertDescription>
                </Alert>
              )} */}

              <div className="mt-6 flex justify-center">
                <div className="flex items-center gap-4  px-4 py-2 rounded-full">
                  {/* Monthly label */}
                  <span
                    className={`cursor-pointer text-lg font-medium transition-colors ${billingCycle === "monthly"
                      ? "text-white"
                      : "text-gray-400"
                      }`}
                    onClick={() => setBillingCycle("monthly")}
                  >
                    Monthly Subscription
                  </span>

                  {/* Toggle switch */}
                  <button
                    onClick={handleToggle}
                    className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === "monthly"
                      ? "bg-gray-600"
                      : "bg-purple-500"
                      }`}
                  >
                    <span
                      className={`absolute top-1 text-lg left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${billingCycle === "yearly"
                        ? "translate-x-7"
                        : "translate-x-0"
                        }`}
                    />
                  </button>

                  {/* Yearly label with badge */}
                  <span
                    className={`cursor-pointer text-lg font-medium flex items-center gap-1 transition-colors ${billingCycle === "yearly" ? "text-white" : "text-gray-400"
                      }`}
                    onClick={() => setBillingCycle("yearly")}
                  >
                    Yearly Subscription
                    <span className="hidden sm:block ml-1 border border-gray-300 text-gray-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                      Save 20% now!
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center h-[64vh]">
                 <PageLoadingSpinner mode="dark"/>
                  <p className="text-gray-600">Loading pricing plans...</p>
               
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <Alert variant="destructive" className="mb-12 max-w-2xl mx-auto">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Display Plans only if not loading and no error */}
            {!isLoading && !error && (
              <div className="max-w-[1350px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 justify-items-center">
                {dbSubscriptionPlans.map((plan) => {
                  const isMostPopular = plan.name.toUpperCase() === "BUILDER";
                  const isFree = plan.price === 0;
                  return (
                    <div
                      key={plan.id}
                      className={`relative flex flex-col rounded-xl w-full max-w-sm mx-auto p-6 hover:shadow-lg hover:scale-105 transition 
                      ${isMostPopular
                          ? "border-2 border-purple-500 shadow-xl"
                          : "border border-gray-700 shadow-sm"
                        }
                      bg-gradient-to-b from-purple-900/10 to-purple-900/3`}
                    >
                      {isMostPopular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-purple-600 text-white">
                            Most Popular
                          </Badge>
                        </div>
                      )}
                      <CardHeader className="text-center">
                        <div
                          className={`mx-auto p-3 rounded-xl bg-gradient-to-r ${getPlanColor(
                            plan.name
                          )} text-white w-fit`}
                        >
                          {getPlanIcon(plan.name)}
                        </div>
                        <CardTitle className="text-xl">
                          {plan.displayName || plan.name}
                        </CardTitle>
                        <div className="text-3xl font-bold">
                          {formatCurrencyFromCents(
                            billingCycle === "monthly"
                              ? plan.price
                              : getDiscountedPrice(plan.price)
                          )}
                          <span className="text-sm font-normal text-gray-300">
                            /{billingCycle === "monthly" ? "month" : "year"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">
                          {plan.features.description}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-grow">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            {plan.features.maxActiveContests} active contests
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            Min. budget{" "}
                            {formatCurrencyFromCents(
                              plan.features.minContestBudget
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            Up to {plan.features.maxWinnersPerContest} winners
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">
                            {plan.features.commissionPercentage}% commission
                          </span>
                        </div>
                        {plan.features.contestTypes && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">
                              {plan.features.contestTypes.includes("cpm") ? (
                                <>
                                  Leaderboard & CPM-based contests
                                  <span className="text-xs text-green-600 block mt-0.5 font-medium">
                                    ✓ Both contest types available
                                  </span>
                                </>
                              ) : (
                                <>
                                  Leaderboard-based contests only
                                  {plan.name.toUpperCase() === "EXPLORER" && (
                                    <span className="text-xs text-gray-500 block mt-0.5">
                                      CPM contests available in paid plans
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        )}
                        {plan.features.analytics && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">
                              {plan.features.analytics === "basic"
                                ? "Basic analytics & insights"
                                : plan.features.analytics === "advanced"
                                  ? "Advanced analytics & reports"
                                  : plan.features.analytics === "comprehensive"
                                    ? "Comprehensive analytics dashboard"
                                    : plan.features.analytics}
                            </span>
                          </div>
                        )}
                        {plan.features.support &&
                          plan.features.support !== "basic" && (
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-500" />
                              <span className="text-sm">
                                {plan.features.support === "priority"
                                  ? "Prioritized customer support"
                                  : plan.features.support === "premium"
                                    ? "Premium 24/7 dedicated support"
                                    : plan.features.support}
                              </span>
                            </div>
                          )}
                        <Separator />
                      </CardContent>
                      <div className="flex items-end justify-center flex-grow">
                        <Button
                          className="w-full rounded-3xl mt-8 relative text-white text-white font-bold px-8 py-5 text-lg overflow-hidden"
                          style={{
                            background:
                              "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                          }}
                          asChild
                        >
                          <div className="scan-line"></div>
                          <Link href={`/signup?plan=${String(plan.id)}`}>
                            {isFree ? "Start Free" : "Subscribe"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* All Plans Include Section */}
      {/* <div className="my-16 px-4">
        <h3 className="text-xl font-semibold text-center mb-10">
          What's Included in Every Plan
        </h3>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Lifetime Access to Winning Content
                </h4>
                <p className="text-sm text-gray-600">
                  Keep all the winning content from contests to use in your
                  campaigns forever.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Organic Content Validation
                </h4>
                <p className="text-sm text-gray-600">
                  Test and validate your content with real, engaged audiences to
                  find what works best.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Authentic Creator Network
                </h4>
                <p className="text-sm text-gray-600">
                  Access to our growing community of verified creators across
                  all platforms.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">
                  Secure Payment Processing
                </h4>
                <p className="text-sm text-gray-600">
                  Safe and secure payment handling for all contest prizes and
                  platform fees.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      <section ref={section2Ref}>
        <div className="bg-[#0b0e26] text-white py-16 px-6">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2
              className={`text-3xl md:text-5xl font-semibold transition-all duration-700 mb-4 ease-out transform ${section2Visible ? "slide-up" : "opacity-0"
                }`}
            >
              What's Included in{" "}
              <span
                style={{
                  background:
                    "linear-gradient(180deg, #7F39EC 26.04%, #AD6BF3 81.25%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",

                  display: "inline",
                }}
              >
                Every Plan
              </span>
            </h2>
            <p
              className={`${section2Visible ? "slide-left" : "opacity-0"
                } text-lg md:text-xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg`}
            >
              Essential Elements for Your Influencer Marketing Strategy
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 mb-14">
              {plans.map((value, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-xl p-9 hover:bg-[#B16FF43D] border-2 border-[#7F39EC] hover:border-2 hover:border-[#7F39EC] cursor-pointer" // gradient border wrapper
                >
                  <div
                    className="rounded-full p-5 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                    }}
                  >
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold">{value.title}</h3>
                    <p className="text-gray-300 text-xl mt-5">
                      {value.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16" ref={storyRef}>
        <div className="bg-[#040921] flex justify-center items-center py-12 px-4">
          <div className="relative  rounded-2xl p-6 md:p-12 flex flex-col md:flex-row items-center gap-8 shadow-lg max-w-7xl w-full border border-gray-600">
            {/* Purple Glow in Background */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-purple-500/20 to-transparent blur-2xl pointer-events-none"></div>

            {/* Text Section */}
            <div className="flex-1 relative z-10">
              <h2
                className={`text-4xl md:text-5xl ${visible ? "slide-up" : ""}`}
                style={{ animationDelay: "0.5s" }}
              >
                Not sure which<span className="text-purple-400"> plan </span>is
                right for you?
              </h2>
              <p
                className={`text-base md:text-xl leading-relaxed text-gray-300 mt-4 ${visible ? "slide-left" : ""
                  }`}
                style={{ animationDelay: "1s" }}
              >
                Book a demo with{" "}
                <span className="font-semibold text-purple-300">Vishesh,</span>{" "}
                Founder of Game Of Creators
              </p>
              <p
                className={`text-base md:text-xl leading-relaxed text-gray-300 mt-4 ${visible ? "slide-left" : ""
                  }`}
                style={{ animationDelay: "1.5s" }}
              >
                Join hundreds of businesses driving success with Game Of
                Creators! Book your free consultation today to get all your
                questions answered and start launching impactful campaigns.
              </p>

              <a
  href="https://calendly.com/guptavishesh2/30min"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 justify-center rounded-3xl mt-8 relative text-white font-bold px-8 py-3 text-lg overflow-hidden"
  style={{
    background:
      "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
  }}
>
  <div className="scan-line pointer-events-none"></div>
  Book a Demo
  <ArrowRight className="h-5 w-5" />
</a>

            </div>

            {/* Image Section */}
            <div className="flex-1 h-[350px] flex justify-center relative z-10">
              <Image
                src={startdemo}
                alt="Phone Illustration"
                className="max-w-[350px] w-full"
              />
            </div>
          </div>
        </div>
      </section>
      {/* Book a Demo Section */}
      {/* <div id="demo" className="my-16 scroll-mt-20">
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-rose-50 p-8 rounded-xl border border-purple-100 max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Not sure which plan is right for you?
          </h2>
          <h3 className="text-xl font-medium mb-4 text-purple-700">
            Book a demo with Vishesh, Founder of Game Of Creators
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Join hundreds of businesses driving success with Game Of Creators!
            Book your free consultation today to get all your questions answered
            and start launching impactful campaigns.
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700"
            asChild
          >
            <a
              href="https://calendly.com/guptavishesh2/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 justify-center"
            >
              <Calendar className="w-5 h-5" />
              Book a Demo
            </a>
          </Button>
        </div>
      </div> */}

      {/* FAQ Section */}
      {/* <div className="mb-16">
                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
                    Frequently Asked Questions
                </h2>
                <div className="max-w-3xl mx-auto">
                    <Accordion type="single" collapsible className="w-full">
                        {faqItems.map((item, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                                <AccordionContent className="text-gray-600">{item.answer}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </div> */}

      {/* <FAQ /> */}
    </div>
  );
}

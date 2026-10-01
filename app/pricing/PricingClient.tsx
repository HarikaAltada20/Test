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
  CheckCircle2,
  Gem,
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
      className={`text-lg md:text-xl text-gray-600 mb-6 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
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
const getFormattedFeaturesList = (plan: SubscriptionPlan) => {
  const name = plan.name.toUpperCase();
  const minBudgetFormatted = formatCurrencyFromCents(plan.features.minContestBudget);

  const list: string[] = [
    `Min. budget ${minBudgetFormatted}`,
    `Up to ${plan.features.maxWinnersPerContest} winners`,
    `${plan.features.commissionPercentage}% commission`,
  ];

  if (name === "EXPLORER") {
    list.push("Leaderboard-based campaigns only");
    list.push("CPM, Milestone & Dual Rewards campaigns in paid plans");
    list.push("Advanced");
  } else if (name === "STARTER") {
    list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
    list.push("All campaign types available");
    list.push("Advanced");
  } else if (name === "BUILDER") {
    list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
    list.push("All campaign types available");
    list.push("Prioritized customer support");
  } else if (name === "CHAMPION") {
    list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
    list.push("All campaign types available");
    list.push("Premium 24/7 dedicated support");
  } else {
    if (plan.features.contestTypes?.includes("cpm") || (plan.features.contestTypes && plan.features.contestTypes.length > 1)) {
      list.push("Leaderboard, CPM, Milestone & Dual Rewards campaigns");
      list.push("All campaign types available");
    } else {
      list.push("Leaderboard-based campaigns only");
      list.push("CPM, Milestone & Dual Rewards campaigns in paid plans");
    }
    if (plan.features.support === "priority") {
      list.push("Prioritized customer support");
    } else if (plan.features.support === "premium") {
      list.push("Premium 24/7 dedicated support");
    } else {
      list.push("Advanced");
    }
  }

  return list;
};

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
        "We have a fast-growing network of 5,000+ active creators across various niches. When you launch a campaign, it goes live to all eligible creators through our dashboard and email system—ensuring visibility and participation.",
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
      <div className="min-h-screen w-full bg-black text-white flex items-center justify-center">
        <PageLoadingSpinner mode="dark" />
      </div>
    );
  }

  // Show creator message if logged in as creator
  if (user && userType === "creator") {
    return (
      <div className="min-h-screen bg-black text-white overflow-hidden ">
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
        
         
          <div className="container mx-auto px-4 text-center relative z-10">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#FFFFFF1A] rounded-full px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 mb-6 sm:mb-8 flex-wrap justify-center max-w-full">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
              <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold bg-white bg-clip-text text-transparent text-center leading-tight">
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
              className="bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent text-3xl sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl flex flex-wrap justify-center gap-x-2 gap-y-1 mb-6 leading-tight text-center slide-up "
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
                   
                  >
                    Detected
                  </span>
                
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-400 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              This pricing page is designed for brands and advertisers who want
              to launch creator contests.
            </p>
          </div>
        </section>

        <Alert className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border border-yellow-400 bg-yellow-500/20 text-yellow-500 rounded-md shadow-sm">
          <AlertTriangle
            className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0"
            color="#facc15"
          />
          <AlertDescription className="mt-[2px] text-sm sm:text-base md:text-md">
            <strong>For Creators:</strong> You don't need a subscription to
            participate in contests. Simply browse available opportunities and
            submit your content to win prizes!
          </AlertDescription>
        </Alert>

        <div className="max-w-[1250px] py-6 sm:py-8 md:py-10 lg:py-12 px-4 sm:px-6 lg:px-8 mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          <Card className="bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] rounded-xl sm:rounded-2xl text-white hover:shadow-lg hover:scale-[1.02] md:hover:scale-105 transition border border-white/10 hover:border-white/20 cursor-pointer">
            <CardHeader className="mb-2 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
                <div className="rounded-full p-1.5 sm:p-2 border border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                </div>
                <span className="leading-tight">How It Works for Creators</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
              {[
                "Browse available contests",
                "Submit your content",
                "Win prizes based on performance",
                "No subscription required",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-2 sm:gap-3">
                  <div
                    className="rounded-full p-2 sm:p-2.5 md:p-3 flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/20"
                  >
                    <Check
                      className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white"
                      strokeWidth={3}
                    />
                  </div>
                  <span className="text-sm sm:text-base md:text-lg leading-relaxed text-[#8E8E8E]">
                    {text}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] rounded-xl sm:rounded-2xl text-white border border-white/10 hover:shadow-lg hover:scale-[1.02] md:hover:scale-105 transition hover:border-white/20 cursor-pointer">
            <CardHeader className="mb-2 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg md:text-xl">
                <div className="rounded-full p-1.5 sm:p-2 border border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white" />
                </div>
                <span className="leading-tight">For Brands & Advertisers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
              {[
                "Launch creator contests",
                "Access to 5,000+ creators",
                "Full content ownership",
                "Subscription plans available",
              ].map((text, idx) => (
                <div key={idx} className="flex items-center gap-2 sm:gap-3">
                  <div
                    className="rounded-full p-2 sm:p-2.5 md:p-3 flex items-center justify-center flex-shrink-0 bg-white/10 border border-white/20"
                  >
                    <Check
                      className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white"
                      strokeWidth={3}
                    />
                  </div>
                  <span className="text-sm sm:text-base md:text-lg leading-relaxed text-[#8E8E8E]">
                    {text}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="pb-8 sm:pb-12 md:pb-16 px-4 sm:px-6 text-center">
          <Button
            asChild
            className="rounded-2xl sm:rounded-3xl mt-4 sm:mt-6 md:mt-8 relative border border-white/20 text-white font-bold px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 text-sm sm:text-base md:text-lg overflow-hidden w-full sm:w-auto bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300"
          >
            <div className="scan-line opacity-50"></div>
            <Link href="/dashboard/opportunities" className="w-full sm:w-auto">
              Browse Available Contests
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-[10px] overflow-hidden">
      {/* Hero Section */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-24 relative overflow-hidden">
        <div className="container mx-auto px-4 text-center relative z-10">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#FFFFFF1A] rounded-full px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 md:py-3 mb-6 sm:mb-8 flex-wrap justify-center max-w-full">
            <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-white flex-shrink-0" />
            <span className="text-xs sm:text-sm md:text-base lg:text-lg font-semibold bg-white bg-clip-text text-transparent text-center leading-tight">
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

          {/* Massive Title */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent mb-6 text-center slide-up"
            style={{ animationDelay: "1s", fontFamily: "Montserrat, sans-serif" }}
          >
            Game Of Creators Pricing
          </h1>

          {/* Strategic Subtitle */}
          <p
            className="text-lg md:text-2xl text-[#8E8E8E] max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
            style={{ animationDelay: "2s" }}
          >
            The World's First Platform to Democratise Brand Deals
          </p>
        </div>
      </section>

      {/* All Pricing Plans */}
      <div id="pricing" className="scroll-mt-20 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
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
                className="text-3xl md:text-5xl text-white slide-up font-semibold transition-all duration-700 mb-4 ease-out transform"
                style={{ animationDelay: "1s" }}
              >
                Manage Your{" "}
                <span
                
                >
                  Subscription
                </span>
              </h2>
              <p
                className="text-lg slide-left md:text-xl text-slate-400 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg"
                style={{ animationDelay: "1.5s" }}
              >
                Upgrade, downgrade, or manage your current subscription plan
              </p>
            </div>
            <SubscriptionManagement />
          </div>
        ) : (
          <>
            <div ref={section1Ref} className="text-center mt-10 mb-12">
              <h2
                className={`text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-3 tracking-tight ${
                  section1Visible ? "slide-up" : "opacity-0"
                }`}
              >
                Choose your Game Plan
              </h2>
              <p
                className={`${
                  section1Visible ? "slide-left" : "opacity-0"
                } text-gray-400 text-sm md:text-base max-w-2xl mx-auto mb-8 leading-relaxed`}
              >
                Set your campaign, your brief, and your budget. Game of Creators puts it in front of a creator network, and pays out on verified performance
              </p>

              {/* Monthly / Yearly Toggle */}
              <div className="flex justify-center">
                <div className="inline-flex items-center p-1 bg-[#141416] border border-neutral-800 rounded-full">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider transition-all ${
                      billingCycle === "monthly"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    MONTHLY
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-5 py-2 rounded-full text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                      billingCycle === "yearly"
                        ? "bg-neutral-800 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <span>YEARLY</span>
                    <span className="text-[10px] font-semibold text-[#22c55e] border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-0.5 rounded-full lowercase first-letter:uppercase">
                      Save 20% now
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center h-[64vh]">
                <PageLoadingSpinner mode="dark" />
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
              <div className="max-w-[1320px] w-full mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 justify-items-center items-stretch">
                {dbSubscriptionPlans.map((plan) => {
                  const isMostPopular = plan.name.toUpperCase() === "BUILDER";
                  const isFree = plan.price === 0;
                  const formattedFeatures = getFormattedFeaturesList(plan);

                  if (isMostPopular) {
                    return (
                      <div
                        key={plan.id}
                        className="w-full max-w-[317px] p-[2px] rounded-[26px] bg-[linear-gradient(180deg,#8B5CF6_0%,#8B5CF6_35%,rgba(139,92,246,0.5)_60%,transparent_85%)] transition-all duration-300 flex flex-col"
                      >
                        <div className="w-full h-full rounded-[24px] bg-violet-600 flex flex-col overflow-hidden">
                          {/* Top Header Section */}
                          <div className="w-full pt-3 pb-5 bg-violet-600 rounded-t-[24px] flex items-center justify-center shadow-[inset_2px_2px_5px_0px_rgba(255,255,255,0.50)]">
                            <span className="text-white text-base font-semibold font-['Inter'] leading-6">
                              MOST POPULAR
                            </span>
                          </div>

                          {/* Dark Card Body */}
                          <div className="w-full p-[26px_16px] rounded-t-[22px] rounded-b-[24px] -mt-3 bg-[linear-gradient(180deg,#353535_0%,#000000_100%)] flex flex-col justify-between items-center gap-8 flex-1 relative z-10">
                            {/* Top Header Section */}
                            <div className="w-[288px] max-w-full flex flex-col items-center gap-[17px]">
                              {/* Plan Pill Badge */}
                              <div className="px-4 py-2.5 rounded-[103px] bg-[linear-gradient(90deg,#212121_0%,#131313_100%)] border-[0.6px] border-solid shadow-[inset_0_-4px_8px_0_#FFFFFF14] flex items-center justify-center gap-2">
                                <span className="text-white text-[12px] font-semibold font-sans leading-[16.8px]">
                                  {plan.displayName || `${plan.name} Plan`}
                                </span>
                              </div>

                              {/* Price & Description Container */}
                              <div className="w-full flex flex-col items-center gap-3">
                                <div className="flex items-baseline justify-center gap-1">
                                  <span className="text-white text-[30px] font-semibold leading-[42px]">
                                    {formatCurrencyFromCents(
                                      billingCycle === "monthly"
                                        ? plan.price
                                        : getDiscountedPrice(plan.price)
                                    )}
                                  </span>
                                  <span className="text-white/60 text-base font-medium pb-1">
                                    /month
                                  </span>
                                </div>
                                <p className="w-[267px] max-w-full text-center text-white/60 text-sm font-normal leading-[19.6px]">
                                  {plan.features.description}
                                </p>
                              </div>
                            </div>

                            {/* Divider Line */}
                            <div className="w-full h-px bg-white/10"></div>

                            {/* Features List Section */}
                            <div className="w-full flex flex-col items-start gap-6 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div className="w-[19px] h-[19px] flex items-center justify-center flex-shrink-0">
                                  <Gem className="w-[17px] h-[17px] text-white" />
                                </div>
                                <span className="text-white text-[18px] font-medium leading-[18px]">
                                  {plan.features.maxActiveContests} active contests
                                </span>
                              </div>

                              <div className="w-full flex flex-col items-start gap-3">
                                {formattedFeatures.map((feat, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-left">
                                    <div className="w-5 h-5 rounded-full bg-[linear-gradient(180deg,rgba(52,229,0,0.15)_0%,rgba(204,228,8,0.15)_49%,rgba(251,228,2,0.15)_100%)] flex items-center justify-center flex-shrink-0">
                                      <div className="w-[14.3px] h-[14.3px] rounded-full bg-[#00FF6C] flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
                                      </div>
                                    </div>
                                    <span className="text-white/70 text-sm font-normal leading-[19.6px]">
                                      {feat}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* CTA Button */}
                            <div className="w-full p-[1px] bg-[linear-gradient(180deg,#434343_0%,#212121_100%)] rounded-[15px] overflow-hidden mt-auto">
                              <Button
                                className="w-full py-[14px] px-4 bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] hover:opacity-90 rounded-[14px] flex flex-row items-center justify-center gap-2 text-white text-base font-semibold border-0 shadow-none h-auto whitespace-nowrap"
                                asChild
                              >
                                <Link href={`/signup?plan=${String(plan.id)}`} className="inline-flex flex-row items-center justify-center gap-2 w-full whitespace-nowrap text-white">
                                  <span>{isFree ? "Start Free" : "Subscribe"}</span>
                                  <ArrowRight className="w-4 h-4 shrink-0" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={plan.id}
                      className="w-full max-w-[317px] mt-[50px] p-[26px_16px] rounded-[24px] bg-[linear-gradient(180deg,#353535_0%,#000000_100%)] border border-[#434343] flex flex-col justify-between items-center gap-8 transition-all duration-300"
                    >
                      {/* Top Header Section */}
                      <div className="w-[288px] max-w-full flex flex-col items-center gap-[17px]">
                        {/* Plan Pill Badge */}
                        <div className="px-4 py-2.5 rounded-[103px] bg-[linear-gradient(90deg,#212121_0%,#131313_100%)] border-[0.6px] border-solid shadow-[inset_0_-4px_8px_0_#FFFFFF14] flex items-center justify-center gap-2">
                          <span className="text-white text-[12px] font-semibold font-sans leading-[16.8px]">
                            {plan.displayName || `${plan.name} Plan`}
                          </span>
                        </div>

                        {/* Price & Description Container */}
                        <div className="w-full flex flex-col items-center gap-3">
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-white text-[30px] font-semibold leading-[42px]">
                              {formatCurrencyFromCents(
                                billingCycle === "monthly"
                                  ? plan.price
                                  : getDiscountedPrice(plan.price)
                              )}
                            </span>
                            <span className="text-white/60 text-base font-medium pb-1">
                              /month
                            </span>
                          </div>
                          <p className="w-[267px] max-w-full text-center text-white/60 text-sm font-normal leading-[19.6px]">
                            {plan.features.description}
                          </p>
                        </div>
                      </div>

                      {/* Divider Line */}
                      <div className="w-full h-px bg-white/10"></div>

                      {/* Features List Section */}
                      <div className="w-full flex flex-col items-start gap-6 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-[19px] h-[19px] flex items-center justify-center flex-shrink-0">
                            <Gem className="w-[17px] h-[17px] text-white" />
                          </div>
                          <span className="text-white text-[18px] font-medium leading-[18px]">
                            {plan.features.maxActiveContests} active contests
                          </span>
                        </div>

                        <div className="w-full flex flex-col items-start gap-3">
                          {formattedFeatures.map((feat, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-left">
                              <div className="w-5 h-5 rounded-full bg-[linear-gradient(180deg,rgba(52,229,0,0.15)_0%,rgba(204,228,8,0.15)_49%,rgba(251,228,2,0.15)_100%)] flex items-center justify-center flex-shrink-0">
                                <div className="w-[14.3px] h-[14.3px] rounded-full bg-[#00FF6C] flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-black stroke-[3.5]" />
                                </div>
                              </div>
                              <span className="text-white/70 text-sm font-normal leading-[19.6px]">
                                {feat}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="w-full p-[1px] bg-[linear-gradient(180deg,#434343_0%,#212121_100%)] rounded-[15px] overflow-hidden mt-auto">
                        <Button
                          className="w-full py-[14px] px-4 bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] hover:opacity-90 rounded-[14px] flex flex-row items-center justify-center gap-2 text-white text-base font-semibold border-0 shadow-none h-auto whitespace-nowrap"
                          asChild
                        >
                          <Link href={`/signup?plan=${String(plan.id)}`} className="inline-flex flex-row items-center justify-center gap-2 w-full whitespace-nowrap text-white">
                            <span>{isFree ? "Start Free" : "Subscribe"}</span>
                            <ArrowRight className="w-4 h-4 shrink-0" />
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

      <section ref={section2Ref} className="bg-black py-[100px] px-4 sm:px-8 lg:px-[120px] flex flex-col justify-center items-center gap-7 ">
        <div className="w-full max-w-[1200px] flex flex-col justify-center items-center gap-[56px]">
          {/* Header */}
          <div className="flex flex-col justify-start items-center gap-4 text-center">
            <h2
              className={`text-3xl sm:text-4xl md:text-[45px] font-bold text-white leading-[1.1] transition-all duration-700 ${
                section2Visible ? "slide-up" : "opacity-0"
              }`}
            >
              What’s Included in every plan
            </h2>
            <p
              className={`max-w-[654px] text-center text-[#8E8E8E] text-base md:text-[20px] font-medium leading-[30px] transition-all duration-700 ${
                section2Visible ? "slide-left" : "opacity-0"
              }`}
            >
              Essential Elements for Your Influencer Marketing Strategy
            </p>
          </div>

          {/* 2-Column Cards Grid */}
          <div className="w-full max-w-[1100px] grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((value, index) => (
              <div
                key={index}
                className="w-full p-[24px_28px] bg-[#171717] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)] rounded-[16px] flex flex-col justify-start items-start gap-4 text-left transition-all duration-300 hover:border-white/20 border border-transparent"
              >
                {/* Icon Container */}
                <div className="w-[36px] h-[36px] relative bg-[#535353] shadow-[0px_0.5px_1px_#636363] overflow-hidden rounded-[42px] flex items-center justify-center shrink-0">
                  <div className="w-5 h-5 relative flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                </div>

                {/* Text Content */}
                <div className="w-full flex flex-col justify-start items-start gap-[2px]">
                  <h3 className="text-white text-[20px] font-semibold leading-[30px]">
                    {value.title}
                  </h3>
                  <p className="text-[#757575] text-[15px] font-medium leading-[22.5px]">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16" ref={storyRef}>
        <div className="bg-black flex justify-center items-center py-12 px-4">
          <div className="relative rounded-2xl p-6 md:p-12 flex flex-col md:flex-row items-center gap-8 shadow-lg max-w-7xl w-full border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)]">
            {/* Text Section */}
            <div className="flex-1 relative z-10">
              <h2
                className={`text-4xl md:text-5xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent ${visible ? "slide-up" : ""}`}
                style={{ animationDelay: "0.5s" }}
              >
                Not sure which plan is right for you?
              </h2>
              <p
                className={`text-base md:text-xl leading-relaxed text-[#8E8E8E] mt-4 ${
                  visible ? "slide-left" : ""
                }`}
                style={{ animationDelay: "1s" }}
              >
                Book a demo with{" "}
                <span className="font-semibold text-white">Vishesh,</span>{" "}
                Founder of Game Of Creators
              </p>
              <p
                className={`text-base md:text-xl leading-relaxed text-[#8E8E8E] mt-4 ${
                  visible ? "slide-left" : ""
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
                className="inline-flex items-center gap-2 justify-center rounded-[20px] mt-8 relative border border-white/20 text-white font-bold px-8 py-3 text-lg overflow-hidden bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] hover:bg-white/10 transition-all duration-300"
              >
                <div className="scan-line opacity-50 pointer-events-none"></div>
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

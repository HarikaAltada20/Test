"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Info, Trophy, Star, Zap, Users, Crown } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClient } from "@/utils/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { SubscriptionManagement } from "@/components/SubscriptionManagement";

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
    "Where Creators and Brands Win Together"
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
      className={`text-lg md:text-xl text-gray-600 mb-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
        }`}
    >
      {taglines[currentTagline]}
    </p>
  );
};

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [user, setUser] = useState<any>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const supabase = createClient(); // Initialize Supabase client

  // State for fetched plans, loading, and error
  const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for authenticated user
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);

        // Get user type
        const { data: userData } = await supabase
          .from('users')
          .select('user_type')
          .eq('id', authUser.id)
          .single();

        if (userData) {
          setUserType(userData.user_type);
        }
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
        const { subscriptionPlans } = await import('@/constants/subscriptionPlans');

        // Convert to the format expected by the UI
        const mappedPlans: SubscriptionPlan[] = subscriptionPlans.map((plan) => ({
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
        }));

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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-sm bg-purple-50 text-purple-700 border-purple-200">
            #1 Gamified Creator Marketing Platform
          </Badge>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
            Game Of Creators Pricing
          </h1>
          <RotatingTagline />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
              Launch Creator Contests That Drive Results
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Launch creator contests, get authentic content that performs, and
              own all rights to winning submissions.
            </p>

            <div className="bg-gradient-to-br from-purple-50 to-rose-50 border border-purple-100 p-6 rounded-xl mb-6">
              <div className="flex items-center mb-4">
                <Crown className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-xl font-bold text-purple-700">
                  Starting at {formatCurrencyFromCents(50000)}/month
                </h3>
              </div>
              <ul className="space-y-2">
                {coreFeatures.map((feature, i) => (
                  <li key={i} className="flex items-start">
                    <Check className="h-4 w-4 text-purple-600 mr-2 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white"
                asChild
              >
                <Link href="/signup">Start Your Free Trial</Link>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="#pricing">See All Plans</Link>
              </Button>
              <Button variant="ghost" className="flex-1" asChild>
                <Link href="#demo">Book a Demo</Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:block relative">
            <div className="bg-gradient-to-br from-purple-100 to-rose-100 rounded-xl h-80 w-full relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Zap className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Dashboard Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trusted By Section */}
      <div className="my-16 text-center">
        <h2 className="text-xl font-semibold mb-6 text-gray-700">
          Trusted by over 100 companies
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-center grayscale opacity-70">
          {companyLogos.map((logo, index) => (
            <div key={index} className="flex items-center justify-center h-8">
              <div className="bg-gray-200 w-full h-6 rounded"></div>
              {/* Replace with actual logos */}
              {/* <Image src={logo} alt="Company logo" width={120} height={40} /> */}
            </div>
          ))}
        </div>
      </div>

      {/* All Pricing Plans */}
      <div id="pricing" className="scroll-mt-20 px-4">
        {/* Show subscription management for authenticated advertisers */}
        {user && userType === 'advertiser' ? (
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">
                Manage Your Subscription
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upgrade, downgrade, or manage your current subscription plan
              </p>
            </div>
            <SubscriptionManagement />
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-3">
                Choose Your Game Plan
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Select the perfect plan to start winning with creator contests
              </p>

              <div className="mt-6 flex justify-center">
                <Tabs
                  defaultValue="monthly"
                  value={billingCycle}
                  onValueChange={handleBillingCycleChange}
                  className="w-fit"
                >
                  <TabsList className="grid w-[280px] grid-cols-2">
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly">
                      Yearly
                      <Badge
                        variant="outline"
                        className="ml-2 bg-green-100 text-green-800 border-green-200 text-xs"
                      >
                        Save 20%
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-8">
                <div className="animate-pulse">
                  <p className="text-gray-600">Loading pricing plans...</p>
                </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 justify-items-center">
                {dbSubscriptionPlans.map((plan) => {
                  // Determine if this plan is the 'most popular' (e.g., by name or a specific ID)
                  const isMostPopular = plan.name.toUpperCase() === "BUILDER"; // Builder plan is most popular

                  // Determine background color based on plan name/id
                  const getPlanBgColor = (planName: string) => {
                    const nameUpper = planName.toUpperCase();
                    if (nameUpper === "EXPLORER") return "bg-gray-500";
                    if (nameUpper === "STARTER") return "bg-orange-500";
                    if (nameUpper === "BUILDER") return "bg-purple-600";
                    if (nameUpper === "CHAMPION") return "bg-yellow-500";
                    return "bg-gray-500"; // Default
                  };

                  const getPlanIcon = (planName: string) => {
                    const nameUpper = planName.toUpperCase();
                    if (nameUpper === "CHAMPION") return <Crown className="h-5 w-5 text-white" />;
                    return <Trophy className="h-5 w-5 text-white" />;
                  };

                  return (
                    <Card
                      key={plan.id}
                      className={`flex flex-col border-2 relative w-full max-w-sm mx-auto ${isMostPopular
                        ? "border-purple-500 shadow-lg scale-105"
                        : "border-gray-200"
                        }`}
                    >
                      {isMostPopular && (
                        <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-1 bg-gradient-to-r from-purple-600 to-rose-600 text-white text-xs font-medium rounded-full">
                          Most Popular
                        </div>
                      )}
                      <CardHeader className="pb-4">
                        <div className="flex justify-center mb-3">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center ${getPlanBgColor(
                              plan.name
                            )}`}
                          >
                            {getPlanIcon(plan.name)}
                          </div>
                        </div>
                        <CardTitle className="text-center text-lg">
                          {plan.displayName || `${plan.name} Plan`}
                        </CardTitle>
                        <div className="mt-3 text-center">
                          <span className="text-2xl font-bold">
                            {formatCurrencyFromCents(
                              billingCycle === "monthly"
                                ? plan.price
                                : getDiscountedPrice(plan.price)
                            )}
                          </span>
                          <span className="text-gray-600 text-sm ml-1">
                            /{billingCycle === "monthly" ? "month" : "year"}
                          </span>
                        </div>
                        <CardDescription className="text-center mt-2 text-sm h-8">
                          {plan.name.toUpperCase() === "EXPLORER" &&
                            "Perfect for testing the platform"}
                          {plan.name.toUpperCase() === "STARTER" &&
                            "Great for small businesses"}
                          {plan.name.toUpperCase() === "BUILDER" &&
                            "Best for scaling brands"}
                          {plan.name.toUpperCase() === "CHAMPION" &&
                            "Enterprise-grade solution"}
                          {![
                            "EXPLORER",
                            "STARTER",
                            "BUILDER",
                            "CHAMPION",
                          ].includes(plan.name.toUpperCase()) &&
                            "Custom plan features"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow pt-0">
                        <ul className="space-y-2.5">
                          <li className="flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">
                              {plan.features.maxActiveContests} active contest
                              {plan.features.maxActiveContests !== 1 ? "s" : ""}
                            </span>
                          </li>
                          <li className="flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                            <span className="text-sm">
                              Min. budget{" "}
                              <span className="font-medium">
                                {formatCurrencyFromCents(plan.features.minContestBudget)}
                              </span>
                            </span>
                          </li>
                          <li className="flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                            <span className="text-sm">
                              Up to <span className="font-medium">{plan.features.maxWinnersPerContest}</span> winner
                              {plan.features.maxWinnersPerContest !== 1 ? "s" : ""} (Leaderboard contests)
                            </span>
                          </li>
                          <li className="flex items-start">
                            <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                            <span className="text-sm">
                              <span className="font-medium">{plan.features.commissionPercentage}%</span> commission
                            </span>
                          </li>

                          <div className="border-t pt-2 mt-3">
                            <li className="flex items-start mb-2">
                              <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                              <span className="text-sm">
                                {plan.features.contestTypes && plan.features.contestTypes.includes('cpm') ? (
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
                            </li>
                            {plan.features.analytics && (
                              <li className="flex items-start mb-2">
                                <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                                <span className="text-sm">
                                  {plan.features.analytics === 'basic' && 'Basic analytics & insights'}
                                  {plan.features.analytics === 'advanced' && 'Advanced analytics & reports'}
                                  {plan.features.analytics === 'comprehensive' && 'Comprehensive analytics dashboard'}
                                </span>
                              </li>
                            )}
                            {plan.features.support && plan.features.support !== 'basic' && (
                              <li className="flex items-start mb-2">
                                <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                                <span className="text-sm">
                                  {plan.features.support === 'priority' && 'Prioritized customer support'}
                                  {plan.features.support === 'premium' && 'Premium 24/7 dedicated support'}
                                </span>
                              </li>
                            )}

                            {/* Common features for all plans */}
                            <li className="flex items-start mb-2">
                              <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                              <span className="text-sm">Lifetime access to winning content</span>
                            </li>
                            <li className="flex items-start">
                              <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                              <span className="text-sm">Organic content validation</span>
                            </li>
                          </div>
                        </ul>
                      </CardContent>
                      <CardFooter className="pt-4">
                        <Button
                          className={`w-full text-sm ${isMostPopular
                            ? "bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700"
                            : ""
                            }`}
                          asChild
                        >
                          <Link href={`/signup?plan=${String(plan.id)}`}>
                            {plan.name.toUpperCase() === "EXPLORER"
                              ? "Start Free"
                              : isMostPopular
                                ? "Start Free Trial"
                                : "Get Started"}
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* All Plans Include Section */}
      <div className="my-16 px-4">
        <h3 className="text-xl font-semibold text-center mb-10">What's Included in Every Plan</h3>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Lifetime Access to Winning Content</h4>
                <p className="text-sm text-gray-600">Keep all the winning content from contests to use in your campaigns forever.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Organic Content Validation</h4>
                <p className="text-sm text-gray-600">Test and validate your content with real, engaged audiences to find what works best.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Authentic Creator Network</h4>
                <p className="text-sm text-gray-600">Access to our growing community of verified creators across all platforms.</p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3 shrink-0">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-1">Secure Payment Processing</h4>
                <p className="text-sm text-gray-600">Safe and secure payment handling for all contest prizes and platform fees.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Book a Demo Section */}
      <div id="demo" className="my-16 scroll-mt-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-gradient-to-br from-purple-50 to-rose-50 p-6 rounded-xl border border-purple-100">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              Not sure which plan is right for you?
            </h2>
            <h3 className="text-xl font-medium mb-4 text-purple-700">
              Book a demo with Vishesh, Founder of Game Of Creators
            </h3>
            <p className="text-gray-600 mb-4 text-sm">
              Join hundreds of businesses driving success with Game Of Creators!
              Book your free consultation today to get all your questions
              answered and start launching impactful campaigns.
            </p>
            <p className="text-gray-600 mb-6 text-sm">
              Discover how Vishesh scaled his mobile app to over 800,000 users
              using the same winning strategies that Game Of Creators delivers.
            </p>
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700">
              Book a Demo
            </Button>
          </div>
          <div className="flex justify-center">
            <div className="bg-white rounded-full h-48 w-48 flex items-center justify-center border-4 border-white shadow-lg">
              <Users className="h-16 w-16 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
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
      </div>

      <Separator className="my-12" />

      {/* CTA Section */}
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-3">Ready to Game Of Creators?</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
          Join thousands of brands leveraging creator contests to generate
          authentic, high-performing content
        </p>
        <Button size="lg" className="bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700" asChild>
          <Link href="/signup">Start Your Free Trial</Link>
        </Button>
      </div>
    </div>
  );
}

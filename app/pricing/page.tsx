"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Info, Trophy, Star, Zap, Users, Crown, Calendar } from "lucide-react";
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
import { EnhancedTabs as Tabs, EnhancedTabsList as TabsList, EnhancedTabsTrigger as TabsTrigger } from "@/components/ui/enhanced-tabs";
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

  // Add getPlanIcon and getPlanColor helpers
  const getPlanIcon = (planName: string) => {
    if (!planName) return <Trophy className="h-5 w-5" />;
    const name = planName.toUpperCase();
    if (name === 'CHAMPION' || name === 'CHAMPION PLAN') return <Crown className="h-5 w-5" />;
    if (name === 'BUILDER' || name === 'BUILDER PLAN') return <Star className="h-5 w-5" />;
    if (name === 'STARTER' || name === 'STARTER PLAN') return <Zap className="h-5 w-5" />;
    if (name === 'EXPLORER' || name === 'EXPLORER PLAN' || name === 'FREE') return <Trophy className="h-5 w-5" />;
    return <Trophy className="h-5 w-5" />;
  };
  const getPlanColor = (planName: string) => {
    if (!planName) return 'from-gray-500 to-gray-600';
    const name = planName.toUpperCase();
    if (name === 'CHAMPION' || name === 'CHAMPION PLAN') return 'from-yellow-500 to-orange-600';
    if (name === 'BUILDER' || name === 'BUILDER PLAN') return 'from-purple-500 to-blue-600';
    if (name === 'STARTER' || name === 'STARTER PLAN') return 'from-orange-500 to-red-600';
    if (name === 'EXPLORER' || name === 'EXPLORER PLAN' || name === 'FREE') return 'from-green-500 to-teal-600';
    return 'from-gray-500 to-gray-600';
  };

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
          {/* <RotatingTagline /> */}
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
                  const isMostPopular = plan.name.toUpperCase() === "BUILDER";
                  const isFree = plan.price === 0;
                  return (
                    <Card
                      key={plan.id}
                      className={`relative flex flex-col w-full max-w-sm mx-auto hover:shadow-lg hover:scale-105 transition ${isMostPopular ? 'border-purple-500 shadow-lg' : 'border-gray-200'}`}
                    >
                      {isMostPopular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-purple-600 text-white">Most Popular</Badge>
                        </div>
                      )}
                      <CardHeader className="text-center">
                        <div className={`mx-auto p-3 rounded-xl bg-gradient-to-r ${getPlanColor(plan.name)} text-white w-fit`}>
                          {getPlanIcon(plan.name)}
                        </div>
                        <CardTitle className="text-xl">{plan.displayName || plan.name}</CardTitle>
                        <div className="text-3xl font-bold">
                          {formatCurrencyFromCents(billingCycle === "monthly" ? plan.price : getDiscountedPrice(plan.price))}
                          <span className="text-sm font-normal text-gray-600">
                            /{billingCycle === "monthly" ? "month" : "year"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{plan.features.description}</p>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-grow">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{plan.features.maxActiveContests} active contests</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Min. budget {formatCurrencyFromCents(plan.features.minContestBudget)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Up to {plan.features.maxWinnersPerContest} winners</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{plan.features.commissionPercentage}% commission</span>
                        </div>
                        {plan.features.contestTypes && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">
                              {plan.features.contestTypes.includes('cpm') ? (
                                <>
                                  Leaderboard & CPM-based contests
                                  <span className="text-xs text-green-600 block mt-0.5 font-medium">✓ Both contest types available</span>
                                </>
                              ) : (
                                <>
                                  Leaderboard-based contests only
                                  {plan.name.toUpperCase() === "EXPLORER" && (
                                    <span className="text-xs text-gray-500 block mt-0.5">CPM contests available in paid plans</span>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        )}
                        {plan.features.analytics && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{plan.features.analytics === 'basic' ? 'Basic analytics & insights' : plan.features.analytics === 'advanced' ? 'Advanced analytics & reports' : plan.features.analytics === 'comprehensive' ? 'Comprehensive analytics dashboard' : plan.features.analytics}</span>
                          </div>
                        )}
                        {plan.features.support && plan.features.support !== 'basic' && (
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{plan.features.support === 'priority' ? 'Prioritized customer support' : plan.features.support === 'premium' ? 'Premium 24/7 dedicated support' : plan.features.support}</span>
                          </div>
                        )}
                        <Separator />
                      </CardContent>
                      <div className="flex items-end justify-center flex-grow">
                        <Button
                          className={`w-full text-sm mt-6 ${isFree ? '' : isMostPopular ? 'bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700' : ''}`}
                          asChild
                        >
                          <Link href={`/signup?plan=${String(plan.id)}`}>
                            {isFree ? 'Start Free' : 'Subscribe'}
                          </Link>
                        </Button>
                      </div>
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
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 to-rose-50 p-8 rounded-xl border border-purple-100 max-w-2xl mx-auto text-center">
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
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-rose-600 hover:from-purple-700 hover:to-rose-700" asChild>
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


    </div>
  );
}

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

// Define PlanFeatures and SubscriptionPlan types (ensure consistency)
type PlanFeatures = {
  maxActiveContests: number;
  minContestBudget: number;
  maxWinnersPerContest: number;
  commisionPercentage: number;
};

type SubscriptionPlan = {
  id: string;
  name: string;
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
  const supabase = createClient(); // Initialize Supabase client

  // State for fetched plans, loading, and error
  const [dbSubscriptionPlans, setDbSubscriptionPlans] = useState<
    SubscriptionPlan[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription plans on component mount
  useEffect(() => {
    const fetchSubscriptionPlans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch plans ordered by price (optional, but good for display)
        const { data: plansData, error: plansError } = await supabase
          .from("subscription_plans")
          .select("id, name, price, json_features")
          .order("price", { ascending: true }); // Order by price

        if (plansError) {
          throw plansError;
        }

        if (plansData) {
          const mappedPlans: SubscriptionPlan[] = plansData.map(
            (plan: any) => ({
              id: plan.id,
              name: plan.name,
              price: plan.price, // Use price directly from DB (assume cents)
              features: {
                // Safely access nested properties, provide defaults
                maxActiveContests: plan.json_features?.maxActiveContests ?? 1,
                minContestBudget: plan.json_features?.minContestBudget ?? 10000,
                maxWinnersPerContest:
                  plan.json_features?.maxWinnersPerContest ?? 10,
                commisionPercentage:
                  plan.json_features?.commisionPercentage ?? 40,
              },
            })
          );
          setDbSubscriptionPlans(mappedPlans);
        } else {
          setDbSubscriptionPlans([]);
          setError("No subscription plans found."); // Inform user if no plans are configured
        }
      } catch (error: any) {
        console.error("Error fetching subscription plans:", error);
        setError(`Failed to load pricing plans: ${error.message}`);
        setDbSubscriptionPlans([]); // Ensure state is empty on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptionPlans();
  }, [supabase]); // Dependency array includes supabase client



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
      <div id="pricing" className="scroll-mt-20">
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            {dbSubscriptionPlans.map((plan) => {
              // Determine if this plan is the 'most popular' (e.g., by name or a specific ID)
              const isMostPopular = plan.name.toUpperCase() === "DIAMOND"; // Example logic

              // Determine background color based on plan name/id
              const getPlanBgColor = (planName: string) => {
                const nameUpper = planName.toUpperCase();
                if (nameUpper === "BRONZE") return "bg-orange-500";
                if (nameUpper === "SILVER") return "bg-gray-400";
                if (nameUpper === "GOLD") return "bg-yellow-500";
                if (nameUpper === "PLATINUM") return "bg-indigo-500";
                if (nameUpper === "DIAMOND") return "bg-purple-600";
                return "bg-gray-500"; // Default for FREE or others
              };

              const getPlanIcon = (planName: string) => {
                const nameUpper = planName.toUpperCase();
                if (nameUpper === "DIAMOND") return <Crown className="h-5 w-5 text-white" />;
                return <Trophy className="h-5 w-5 text-white" />;
              };

              return (
                <Card
                  key={plan.id}
                  className={`flex flex-col border-2 relative ${isMostPopular
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
                    <CardTitle className="text-center text-lg">{plan.name}</CardTitle>
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
                      {plan.name.toUpperCase() === "FREE" &&
                        "Get started for free"}
                      {plan.name.toUpperCase() === "BRONZE" &&
                        "Perfect for getting started"}
                      {plan.name.toUpperCase() === "SILVER" &&
                        "Best for growing brands"}
                      {plan.name.toUpperCase() === "GOLD" &&
                        "For established businesses"}
                      {plan.name.toUpperCase() === "PLATINUM" &&
                        "For scaling content strategy"}
                      {plan.name.toUpperCase() === "DIAMOND" &&
                        "Enterprise-grade solution"}
                      {![
                        "FREE",
                        "BRONZE",
                        "SILVER",
                        "GOLD",
                        "PLATINUM",
                        "DIAMOND",
                      ].includes(plan.name.toUpperCase()) &&
                        "Custom plan features"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow pt-0">
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {plan.features.maxActiveContests} active contest
                          {plan.features.maxActiveContests !== 1 ? "s" : ""}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">
                          Min. budget{" "}
                          {formatCurrencyFromCents(plan.features.minContestBudget)}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">
                          Up to {plan.features.maxWinnersPerContest} winner
                          {plan.features.maxWinnersPerContest !== 1 ? "s" : ""}
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {plan.features.commisionPercentage}% commission
                        </span>
                      </li>
                      <li className="flex items-start">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0 mt-0.5" />
                        <span className="text-sm">Access to 5,000+ creators</span>
                      </li>
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
                        {isMostPopular ? "Start Free Trial" : "Get Started"}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
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

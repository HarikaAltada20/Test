"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Check, Info, Trophy, Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { subscriptionPlans } from "@/constants/subscriptionPlans"

export default function PricingPage() {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

    const handleBillingCycleChange = (value: string) => {
        setBillingCycle(value as "monthly" | "yearly")
    }

    // Calculate yearly pricing (20% discount)
    const getDiscountedPrice = (price: number) => {
        return Math.round(price * 12 * 0.8)
    }

    // Featured plan - Diamond plan
    const featuredPlan = subscriptionPlans.find(plan => plan.id === 'diamond')

    // Core features shown in the hero section
    const coreFeatures = [
        "Run creator contests",
        "Access to 5,000+ creators",
        "Full content ownership",
        "Analytics dashboard",
        "Branded contest pages"
    ]

    // FAQ items from the FAQ data
    const faqItems = [
        {
            question: "How are the creator payouts / prizes structured?",
            answer: "You control how the prize pool is split. For example: 3 winners: $500 / $300 / $200, or 5 winners: $400 / $250 / $150 / $100 / $100. You define this upfront in your contest brief, and creators compete to win based on real engagement."
        },
        {
            question: "What if my contest gets no views?",
            answer: "Creators are incentivized to promote their content because views = prizes. This means they actively push their posts to friends, followers, and beyond to maximize reach. It's like having a motivated marketing team built in. If results fall short, we can help you optimize your brief or strategy for next time—at no extra cost."
        },
        {
            question: "How many creators are on Go Viral?",
            answer: "We have a fast-growing network of 5,000+ active creators across various niches. When you launch a contest, it goes live to all eligible creators through our dashboard and email system—ensuring visibility and participation."
        },
        {
            question: "How much should I run a contest for?",
            answer: "It depends on your goal: $1,000–$2,000 for a range of quality UGC entries, $500+ for niche campaigns or specific messaging, higher payouts attract creators with larger audiences. We'll help you structure it based on your goals—whether that's more entries, more reach, or better-quality content."
        },
        {
            question: "Do I own the content?",
            answer: "Yes, once a contest ends and winners are announced, you get full rights to download and repurpose all winning content for your brand's marketing use—including ads, social posts, website use, etc. Non-winning content may still be available upon request or with creator permission, depending on your use case."
        },
        {
            question: "How do you help me find my content-market fit?",
            answer: "We help you test different content styles and creator personalities to see what resonates with your audience. This process of testing various approaches helps you discover the most effective way to present your product or service to your target market."
        },
        {
            question: "How do I know the views are real?",
            answer: "All content links are public, and we provide platform-specific analytics that you can verify. You can see actual engagement metrics from the platforms where the content is posted."
        },
        {
            question: "What type of creators are on the platform?",
            answer: "Our platform hosts a diverse range of creators across different niches including lifestyle, tech, beauty, fitness, food, gaming, and more. We have creators with followings ranging from micro-influencers to those with larger audiences, ensuring you can find the perfect match for your brand's voice and target audience."
        },
        {
            question: "How long does a typical contest run?",
            answer: "Most contests run for 7-14 days, which gives creators enough time to develop quality content while maintaining momentum and excitement. However, you have flexibility to set shorter or longer timeframes depending on your specific goals and campaign urgency."
        },
        {
            question: "Can I run multiple contests simultaneously?",
            answer: "Yes! Depending on your subscription plan, you can run multiple contests at the same time. This is perfect for testing different content approaches, targeting various audience segments, or launching campaigns across multiple products simultaneously."
        }
    ]

    // Company logos (placeholders - should be replaced with actual logos)
    const companyLogos = [
        "/logos/logo1.svg",
        "/logos/logo2.svg",
        "/logos/logo3.svg",
        "/logos/logo4.svg",
        "/logos/logo5.svg",
        "/logos/logo6.svg",
    ]

    return (
        <div className="container mx-auto py-12 px-4">
            {/* Hero Section */}
            <div className="max-w-5xl mx-auto mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
                            Go Viral with Creator-Generated Content
                        </h1>
                        <p className="text-xl text-gray-600 mb-8">
                            Launch creator contests, get authentic content that performs, and own all rights to winning submissions.
                        </p>

                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-xl mb-8">
                            <div className="flex items-center mb-4">
                                <Star className="h-6 w-6 text-rose-500 mr-2" />
                                <h3 className="text-2xl font-bold text-rose-700">$500/month</h3>
                            </div>
                            <ul className="space-y-3">
                                {coreFeatures.map((feature, i) => (
                                    <li key={i} className="flex items-start">
                                        <Check className="h-5 w-5 text-rose-500 mr-2 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                            <Button size="lg" className="w-full mt-6 bg-rose-600 hover:bg-rose-700" asChild>
                                <Link href="/signup">Start Your Free Trial</Link>
                            </Button>
                        </div>

                        <div className="flex items-center">
                            <Button variant="outline" className="mr-4" asChild>
                                <Link href="#pricing">See All Plans</Link>
                            </Button>
                            <Button variant="ghost" asChild>
                                <Link href="#demo">Book a Demo</Link>
                            </Button>
                        </div>
                    </div>
                    <div className="hidden md:block relative">
                        <div className="bg-gray-100 rounded-xl h-96 w-full">
                            {/* Replace with actual hero image */}
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                                Dashboard Preview Image
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Trusted By Section */}
            <div className="my-20 text-center">
                <h2 className="text-2xl font-semibold mb-8 text-gray-700">Trusted by over 100 companies</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-8 items-center grayscale opacity-70">
                    {companyLogos.map((logo, index) => (
                        <div key={index} className="flex items-center justify-center h-12">
                            <div className="bg-gray-200 w-full h-8 rounded"></div>
                            {/* Replace with actual logos */}
                            {/* <Image src={logo} alt="Company logo" width={120} height={40} /> */}
                        </div>
                    ))}
                </div>
            </div>

            {/* All Pricing Plans */}
            <div id="pricing" className="scroll-mt-20">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold tracking-tight mb-4">Choose Your Plan</h2>
                    <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                        Select the perfect plan for your business needs
                    </p>

                    <div className="mt-8 flex justify-center">
                        <Tabs
                            defaultValue="monthly"
                            value={billingCycle}
                            onValueChange={handleBillingCycleChange}
                            className="w-fit"
                        >
                            <TabsList className="grid w-[300px] grid-cols-2">
                                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                                <TabsTrigger value="yearly">
                                    Yearly
                                    <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-200">
                                        Save 20%
                                    </Badge>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-16">
                    {subscriptionPlans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`flex flex-col border-2 ${plan.id === 'diamond'
                                ? 'border-rose-500 relative shadow-lg'
                                : 'border-gray-200'
                                }`}
                        >
                            {plan.id === 'diamond' && (
                                <div className="absolute -top-4 left-0 right-0 mx-auto w-fit px-3 py-1 bg-rose-600 text-white text-sm font-medium rounded">
                                    Most Popular
                                </div>
                            )}
                            <CardHeader>
                                <div className="flex justify-center mb-4">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ${plan.id === 'bronze' ? 'bg-orange-500' :
                                        plan.id === 'silver' ? 'bg-gray-300' :
                                            plan.id === 'gold' ? 'bg-yellow-400' :
                                                plan.id === 'platinum' ? 'bg-indigo-400' :
                                                    'bg-blue-300'
                                        }`}>
                                        <Trophy className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                                <CardTitle className="text-center">{plan.name}</CardTitle>
                                <div className="mt-4 text-center">
                                    <span className="text-3xl font-bold">
                                        ${billingCycle === "monthly" ? plan.price : getDiscountedPrice(plan.price)}
                                    </span>
                                    <span className="text-gray-600 ml-1">
                                        /{billingCycle === "monthly" ? "month" : "year"}
                                    </span>
                                </div>
                                <CardDescription className="text-center mt-2">
                                    {plan.id === 'bronze' && "Perfect for getting started"}
                                    {plan.id === 'silver' && "Best for growing brands"}
                                    {plan.id === 'gold' && "For established businesses"}
                                    {plan.id === 'platinum' && "For scaling content strategy"}
                                    {plan.id === 'diamond' && "Enterprise-grade solution"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <ul className="space-y-2">
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>{plan.features.maxActiveContests === Infinity ? 'Unlimited' : plan.features.maxActiveContests} active contests</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>Min. ${plan.features.minContestBudget} per contest</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>Up to {plan.features.maxWinnersPerContest === Infinity ? 'unlimited' : plan.features.maxWinnersPerContest} winners</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>Access to 5,000+ creators</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>{plan.features.contestBranding}</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>Analytics dashboard</span>
                                    </li>
                                    <li className="flex items-start">
                                        <Check className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                        <span>{plan.features.support} support</span>
                                    </li>
                                </ul>
                            </CardContent>
                            <CardFooter className="pt-6">
                                <Button
                                    className={`w-full ${plan.id === 'diamond'
                                        ? 'bg-rose-600 hover:bg-rose-700'
                                        : ''
                                        }`}
                                    asChild
                                >
                                    <Link href={`/signup?plan=${plan.id}`}>
                                        {plan.id === 'diamond' ? 'Start Free Trial' : 'Get Started'}
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Book a Demo Section */}
            <div id="demo" className="my-20 scroll-mt-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-gray-50 p-8 rounded-xl">
                    <div>
                        <h2 className="text-3xl font-bold mb-4">Not sure which plan is right for you?</h2>
                        <h3 className="text-2xl font-medium mb-6">Book a demo with Vishesh, Founder of Go Viral</h3>
                        <p className="text-gray-600 mb-6">
                            Join hundreds of businesses driving success with Go Viral! Book your free consultation today to get all your
                            questions answered and start launching impactful campaigns.
                        </p>
                        <p className="text-gray-600 mb-8">
                            Discover how Vishesh scaled his mobile app to over 800,000 users using the same winning strategies that
                            Go Viral delivers.
                        </p>
                        <Button size="lg" className="bg-rose-600 hover:bg-rose-700">
                            Book a Demo
                        </Button>
                    </div>
                    <div className="flex justify-center">
                        <div className="bg-white rounded-full h-64 w-64 flex items-center justify-center border-8 border-white shadow-xl">
                            {/* Placeholder for founder image */}
                            <span className="text-gray-400">Founder Image</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="mb-20">
                <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
                <div className="max-w-3xl mx-auto">
                    <Accordion type="single" collapsible className="w-full">
                        {faqItems.map((item, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger>{item.question}</AccordionTrigger>
                                <AccordionContent>{item.answer}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </div>

            <Separator className="my-16" />

            {/* CTA Section */}
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">Ready to go viral?</h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                    Join thousands of brands leveraging creator contests to generate authentic, high-performing content
                </p>
                <Button size="lg" className="bg-rose-600 hover:bg-rose-700" asChild>
                    <Link href="/signup">Start Your Free Trial</Link>
                </Button>
            </div>
        </div>
    )
} 
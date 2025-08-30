"use client";

import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Trophy,
    DollarSign,
    Video,
    Play,
    CheckCircle,
    MessageCircle,
    Phone,
    Users,
    TrendingUp,
    Award,
    Star,
    Shield
} from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { SOCIAL_LINKS } from "@/constants/socialLinks";

interface GettingStartedClientProps {
    user: User;
}

export default function GettingStartedClient({ user }: GettingStartedClientProps) {
    const [userType, setUserType] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const fetchUserType = async () => {
            const { data: profile } = await supabase
                .from("advertiser_profiles")
                .select("id")
                .eq("id", user.id)
                .single();

            if (profile) {
                setUserType("advertiser");
            } else {
                setUserType("creator");
            }
        };

        fetchUserType();
    }, [user.id, supabase]);

    if (!userType) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header Section */}
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Getting Started with Game Of Creators
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                    {userType === "advertiser"
                        ? "Learn how to create engaging content campaigns"
                        : "Learn how to participate and earn from contests"
                    }
                </p>
            </div>

            {userType === "advertiser" ? (
                // BRAND/ADVERTISER CONTENT
                <div className="space-y-8">
                    {/* Platform Overview Section */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Welcome to Game Of Creators
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                                    <strong>Game Of Creators</strong> connects brands with talented content creators through engaging video contests.
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Launch campaigns, get viral content, and reach new audiences. Simple and effective.
                                </p>
                            </div>

                            {/* Platform Benefits */}
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Viral Content</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Get authentic, engaging videos that resonate with your target audience
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Reach New Audiences</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Tap into creators' existing audiences and expand your brand reach
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Cost Effective</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Pay only for performance with flexible budget options
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* How It Works Section */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                    <Play className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    How It Works
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Simple Steps */}
                            <div className="grid md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Create Contest</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Set your brief, budget, and contest type (Leaderboard or CPM)
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-purple-600 dark:text-purple-400 font-bold">2</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Creators Submit</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Talented creators create and submit videos based on your brief
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-orange-600 dark:text-orange-400 font-bold">3</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Content Review</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        We review submissions to ensure quality and brand safety
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-green-600 dark:text-green-400 font-bold">4</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Get Results</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Receive viral content and pay creators based on performance
                                    </p>
                                </div>
                            </div>

                            <div className="text-center pt-4">
                                <Link href="/dashboard/contests/create">
                                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                                        <Play className="w-4 h-4 mr-2" />
                                        Create Your First Contest
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contest Types Section */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Choose Your Contest Type
                            </h2>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Leaderboard Contest Section */}
                                <div className="p-6 border border-purple-200 dark:border-purple-800 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                            <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <h3 className="font-bold text-lg">Leaderboard Contests</h3>
                                    </div>
                                    <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-600 dark:text-purple-300 mb-4">
                                        Competition Based
                                    </Badge>

                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                        Set a fixed prize pool and let creators compete for the top spots.
                                    </p>

                                    {/* Visual Process */}
                                    <div className="text-center mb-4">
                                        <div className="inline-block p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mb-1">
                                                Set Prize Pool → Creators Compete → Winners Get Paid
                                            </div>
                                            <div className="text-sm text-purple-500 dark:text-purple-300">
                                                Example: $1000 total, 3 winners get $500, $300, $200
                                            </div>
                                        </div>
                                    </div>

                                    {/* Benefits */}
                                    <div className="space-y-2">
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Fixed budget - know your total cost upfront</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">High competition drives quality content</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Own winning videos forever</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Perfect for viral marketing & brand awareness</span>
                                        </div>
                                    </div>

                                    <div className="text-center pt-4">
                                        <Link href="/dashboard/contests/create">
                                            <Button className="bg-purple-600 hover:bg-purple-700 text-white w-full">
                                                <Trophy className="w-4 h-4 mr-2" />
                                                Create Leaderboard Contest
                                            </Button>
                                        </Link>
                                    </div>
                                </div>

                                {/* CPM Contest Section */}
                                <div className="p-6 border border-blue-200 dark:border-blue-800 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="font-bold text-lg">CPM Contests</h3>
                                    </div>
                                    <Badge variant="outline" className="border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-300 mb-4">
                                        Pay Per 1000 Views
                                    </Badge>

                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                        Pay only for actual views. More views = more marketing reach for your brand.
                                    </p>

                                    {/* Visual Process */}
                                    <div className="text-center mb-4">
                                        <div className="inline-block p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-1">
                                                Set CPM Rate → Creators Post → Pay Per Views
                                            </div>
                                            <div className="text-sm text-blue-500 dark:text-blue-300">
                                                Example: $5 per 1K views, 50K views = $250 payment
                                            </div>
                                        </div>
                                    </div>

                                    {/* Benefits */}
                                    <div className="space-y-2">
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Pay only for performance - no wasted budget</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Scalable - more views = more marketing</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Set max budget & CPM rate for control</span>
                                        </div>
                                        <div className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">Perfect for ongoing marketing & paid advertising</span>
                                        </div>
                                    </div>

                                    <div className="text-center pt-4">
                                        <Link href="/dashboard/contests/create">
                                            <Button className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                                                <DollarSign className="w-4 h-4 mr-2" />
                                                Create CPM Contest
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Quality & Safety */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                                    <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Content Quality & Safety
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-gray-600 dark:text-gray-300">
                                    We ensure all content meets high quality standards and brand safety requirements.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950">
                                    <h3 className="font-semibold mb-3 text-green-800 dark:text-green-200">Quality Review:</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Content follows your brief and guidelines</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Video quality and production standards</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Brand safety and compliance checks</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950">
                                    <h3 className="font-semibold mb-3 text-blue-800 dark:text-blue-200">What You Get:</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <span>Verified, high-quality content</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <span>Performance metrics and analytics</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <span>Usage rights for winning content</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 border border-purple-200 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-950">
                                    <h3 className="font-semibold mb-3 text-purple-800 dark:text-purple-200">Platform Support:</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                            <span>Dedicated campaign management</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                            <span>Creator community access</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                            <span>24/7 support and guidance</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                                        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Pro Tip:</h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            <strong>Create clear, detailed briefs</strong> to get the best content. Include your brand guidelines, target audience, and specific requirements for better results.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                // CREATOR CONTENT
                <div className="space-y-8">
                    {/* Platform Overview Section */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Welcome to Game Of Creators
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                                    <strong>Game Of Creators</strong> connects content creators with brands through video contests.
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Create videos, compete for prizes, or get paid per view. Simple as that.
                                </p>
                            </div>

                            {/* Platform Benefits */}
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Earn Money</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Get paid for your creativity through contests and CPM-based earnings
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Build Portfolio</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Create professional content for real brands to showcase your skills
                                    </p>
                                </div>
                                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Grow Audience</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Reach new audiences through brand collaborations and contests
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* How to Participate Section */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                    <Video className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    How to Participate
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Simple Steps */}
                            <div className="grid md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-blue-600 dark:text-blue-400 font-bold">1</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Browse Contests</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Find contests that match your content style and audience
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-purple-600 dark:text-purple-400 font-bold">2</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Create & Submit</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Make your video following the contest brief, rules and submit
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-orange-600 dark:text-orange-400 font-bold">3</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Content Review</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Your content is reviewed to ensure it follows all guidelines
                                    </p>
                                </div>
                                <div className="text-center">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-green-600 dark:text-green-400 font-bold">4</span>
                                    </div>
                                    <h3 className="font-semibold mb-2">Earn Money</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        Get paid based on performance or ranking & win real cash & prizes
                                    </p>
                                </div>
                            </div>

                            <div className="text-center pt-4">
                                <Link href="/dashboard/opportunities">
                                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                                        <Video className="w-4 h-4 mr-2" />
                                        Browse Contests
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contest Types for Creators */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                Contest Types
                            </h2>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Leaderboard for Creators */}
                                <div className="p-6 border border-purple-200 dark:border-purple-800 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                            <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <h3 className="font-bold text-lg">Leaderboard Contests</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                        Compete with other creators for prizes. Winners determined by views and engagement.
                                    </p>

                                    {/* Visual Prize Breakdown */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                                                    <span className="text-white font-bold text-sm">1</span>
                                                </div>
                                                <span className="font-medium">1st Place</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$500</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                                                    <span className="text-white font-bold text-sm">2</span>
                                                </div>
                                                <span className="font-medium">2nd Place</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$300</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                                                    <span className="text-white font-bold text-sm">3</span>
                                                </div>
                                                <span className="font-medium">3rd Place</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$200</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-center">
                                        <div className="inline-block px-3 py-1 bg-purple-100 dark:bg-purple-900 rounded-full">
                                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Example Prize Pool</span>
                                        </div>
                                    </div>
                                </div>

                                {/* CPM for Creators */}
                                <div className="p-6 border border-blue-200 dark:border-blue-800 rounded-lg bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                            <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <h3 className="font-bold text-lg">CPM Contests</h3>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                                        Get paid per 1000 views. More views = more money. No competition needed.
                                    </p>

                                    {/* Visual Rate Display */}
                                    <div className="text-center mb-4">
                                        <div className="inline-block p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">$5.00</div>
                                            <div className="text-sm text-gray-500">per 1,000 views</div>
                                        </div>
                                    </div>

                                    {/* Visual Earnings Examples */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                    <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-medium">10K views</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$50</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                    <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-medium">50K views</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$250</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-700">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                                    <Video className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <span className="font-medium">100K views</span>
                                            </div>
                                            <span className="font-bold text-green-600 text-lg">$500</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 text-center">
                                        <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                                            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Example Earnings</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Content Verification Process */}
                    <Card className="border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center pb-4">
                            <div className="flex items-center justify-center space-x-3 mb-2">
                                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                                    <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Content Verification Process
                                </h2>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="text-center mb-6">
                                <p className="text-gray-600 dark:text-gray-300">
                                    After you submit your content, it goes through a verification process to ensure quality and compliance.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-950">
                                    <h3 className="font-semibold mb-3 text-orange-800 dark:text-orange-200">What We Review:</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Content follows contest brief, rules and guidelines</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Video quality and brand safety compliance</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Platform rules and policy adherence</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950">
                                    <h3 className="font-semibold mb-3 text-green-800 dark:text-green-200">If Approved (Verified):</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Content is marked as "Verified" if approved</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Your video becomes eligible for payment</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>Performance tracking continues for contest rankings</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <span>If you win the contest you will get paid</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950">
                                    <h3 className="font-semibold mb-3 text-red-800 dark:text-red-200">If Not Approved (Rejected):</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>You will not qualify for that contest</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>You will be removed from leaderboard</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>But you can still see all your submissions in "My Submissions" section</span>
                                        </li>

                                        <li className="flex items-start space-x-2">
                                            <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>You will not be eligible for any winnings for that contest</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                <div className="flex items-start space-x-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                                        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Pro Tip:</h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-300">
                                            <strong>Follow the contest brief and guidelines carefully.</strong> This ensures faster verification and better performance. Quality content = more money!
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Next Steps Section */}
            {userType === "advertiser" ? (
                // BRAND/ADVERTISER READY TO START
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 border-0 mt-8">
                    <CardContent className="p-6">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Ready to Start?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Start creating contests and campaigns
                            </p>
                        </div>

                        <div className="text-center">
                            <Link href="/dashboard/contests/create">
                                <Button className="bg-green-600 hover:bg-green-700 text-white py-3 px-8 text-lg">
                                    <Video className="w-5 h-5 mr-2" />
                                    Create Contest
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                // CREATOR READY TO START (original simple layout)
                <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900 dark:to-blue-900 border-0 mt-8">
                    <CardContent className="p-6">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                Ready to Start?
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300">
                                Start participating in contests and earning money
                            </p>
                        </div>

                        <div className="text-center flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Link href="/dashboard/opportunities">
                                <Button className="bg-green-600 hover:bg-green-700 text-white py-3 px-8 text-lg">
                                    <Video className="w-5 h-5 mr-2" />
                                    Browse Contests
                                </Button>
                            </Link>
                            <a href={SOCIAL_LINKS.discord} target="_blank" rel="noopener noreferrer">
                                <Button className="bg-[#5865F2] hover:bg-[#4752C4] text-white py-3 px-8 text-lg">
                                    <FaDiscord className="w-5 h-5 mr-2" />
                                    Join Creator Community
                                </Button>
                            </a>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 
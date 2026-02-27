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
  Shield,
  Check,
  Info,
} from "lucide-react";
import { FaDiscord, FaWhatsapp } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { useState, useEffect } from "react";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { useSearchParams } from "next/navigation";
import { DiscordOnboardingModal } from "@/components/DiscordOnboardingModal";
import { PageLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";

interface GettingStartedClientProps {
  user: User;
}

export default function GettingStartedClient({
  user,
}: GettingStartedClientProps) {
  const [userType, setUserType] = useState<string | null>(null);
  const [showDiscordModal, setShowDiscordModal] = useState(false);
  const supabase = createClient();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const searchParams = useSearchParams();

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

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

  // Show Discord onboarding modal for creators after signup/first visit
  useEffect(() => {
    if (!userType) return;
    const flag = searchParams.get("welcome");
    const isCreator = userType === "creator";
    try {
      const alreadyShown =
        typeof window !== "undefined" &&
        localStorage.getItem("discordOnboardingShown") === "1";
      if (isCreator && (flag === "1" || flag === "true") && !alreadyShown) {
        setShowDiscordModal(true);
        // Clean the query param so refresh doesn't reopen
        const url = new URL(window.location.href);
        url.searchParams.delete("welcome");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {}
  }, [userType, searchParams]);

  if (!userType) {
    return (
      <div className="flex items-center justify-center h-[76vh]">
        <PageLoadingSpinner mode="light" />
      </div>
    );
  }
  const isDark = mode === "dark";
  const panelClass = cn(
    "rounded-2xl border",
    isDark
      ? "bg-[#22074A]/85 border border-[#B897F5]/45 text-white shadow-[0_16px_30px_-20px_rgba(194,125,255,0.55)]"
      : "bg-white border border-[#EFE4FF] text-black shadow-[0_16px_30px_-22px_rgba(95,43,177,0.35)]",
  );
  const primaryButtonClass = cn(
    "text-white rounded-xl bg-gradient-to-r font-semibold transition-all duration-200 hover:-translate-y-0.5",
    isDark
      ? "from-[#8752E8] to-[#5F2BB1] hover:from-[#9562EE] hover:to-[#6A34C2]"
      : "from-[#6A31CC] to-[#4A00BE] hover:from-[#7441D4] hover:to-[#5B1AC8]",
  );

  return (
    <div className="container mx-auto px-2 py-3 md:px-4 md:py-8 max-w-[1100px]">
      {/* Header Section */}
      <div className="mb-8 text-center">
        <h1
          className={cn(
            "text-2xl md:text-4xl font-bold mb-2",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Getting Started with Game Of Creators
        </h1>
        <p className={cn("text-lg", isDark ? "text-white" : "text-gray-900")}>
          {userType === "advertiser"
            ? "Learn how to create engaging content campaigns"
            : "Learn how to participate and earn from contests"}
        </p>
      </div>

      {/* How it works video */}
      <div className="mb-8">
        <div className="rounded-2xl overflow-hidden shadow-[0px_5px_20px_0px_#0000000D] bg-white">
          <div className="aspect-video w-full">
            <iframe
              src={
                (userType === "advertiser"
                  ? "https://www.youtube.com/embed/kV4dXlWR8sY"
                  : "https://www.youtube.com/embed/KrtpC2DB9zk") + "?rel=0"
              }
              title="How it works"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>
        <div className="text-center text-sm text-gray-600 mt-2">
          Watch a quick video overview of how it works
        </div>
      </div>

      {userType === "advertiser" ? (
        // BRAND/ADVERTISER CONTENT

        <div>
          <div
            className={cn(
              "border-b text-center px-6 rounded-tl-2xl rounded-tr-2xl pt-6 pb-4",
              isDark
                ? "bg-[#170337] border-[#8A5CE6]/45"
                : "bg-white border-[#E3D1FF]",
            )}
          >
            <div className="flex justify-start space-x-3">
              {/* <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div> */}
              <h2
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-[#7F39EC]",
                )}
              >
                Welcome to Game Of Creators
              </h2>
            </div>
          </div>

          <div
            className={cn(
              "space-y-8 min-h-screen shadow-xl px-2 py-6",
              isDark ? "bg-[#170337]" : "bg-white",
            )}
          >
            {/* Platform Overview Section */}
            <div>
              <CardContent className="space-y-6">
                <div className="text-start mb-6">
                  <p
                    className={cn(
                      "text-lg mb-4",
                      isDark ? "text-white" : "text-black",
                    )}
                  >
                    <strong>Game Of Creators</strong> connects brands with
                    talented content creators through engaging video contests.
                  </p>
                  <p
                    className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-black",
                    )}
                  >
                    Launch campaigns, get viral content, and reach new
                    audiences. Simple and effective.
                  </p>
                </div>

                {/* Platform Benefits */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_12px_28px_-16px_rgba(127,57,236,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">
                      Viral Content
                    </h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Get authentic, engaging videos that resonate with your
                      target audience
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_12px_28px_-16px_rgba(127,57,236,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Users className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">
                      Reach New Audiences
                    </h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Tap into creators' existing audiences and expand your
                      brand reach
                    </p>
                  </div>
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_12px_28px_-16px_rgba(127,57,236,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">
                      Cost Effective
                    </h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-white" : "text-gray-600",
                      )}
                    >
                      Pay only for performance with flexible budget options
                    </p>
                  </div>
                </div>
              </CardContent>
            </div>

            {/* How It Works Section */}
            <div className="">
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center space-x-3 mb-2">
                  {/* <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                    <Play className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div> */}
                  <h2
                    className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    How It Works
                  </h2>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Simple Steps */}
                {/* <div className="grid md:grid-cols-4 gap-6">
                                <div className="text-center p-4 p-6 rounded-2xl shadow-[0px_5px_20px_0px_#0000000D]">
                                    <div className="w-12 h-12 bg-[#D8C3FF] rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-[#4A00BE] font-bold">1</span>
                                    </div>
                                    <h3 className="font-semibold text-xl mb-2">Create Contest</h3>
                                    <p className="text-md text-gray-600 dark:text-gray-300">
                                        Set your brief, budget, and contest type (Leaderboard or CPM)
                                    </p>
                                </div>
                                <div className="text-center p-4 p-6 rounded-2xl shadow-[0px_5px_20px_0px_#0000000D]">
                                    <div className="w-12 h-12  bg-[#D8C3FF] rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-[#4A00BE] font-bold">2</span>
                                    </div>
                                    <h3 className="font-semibold text-xl mb-2">Creators Submit</h3>
                                    <p className="text-md text-gray-600 dark:text-gray-300">
                                        Talented creators create and submit videos based on your brief
                                    </p>
                                </div>
                                <div className="text-center p-4 p-6 rounded-2xl shadow-[0px_5px_20px_0px_#0000000D]">
                                    <div className="w-12 h-12  bg-[#D8C3FF] rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-[#4A00BE] font-bold">3</span>
                                    </div>
                                    <h3 className="font-semibold text-xl mb-2">Content Review</h3>
                                    <p className="text-md text-gray-600 dark:text-gray-300">
                                        We review submissions to ensure quality and brand safety
                                    </p>
                                </div>
                                <div className="text-center p-4 p-6 rounded-2xl shadow-[0px_5px_20px_0px_#0000000D]">
                                    <div className="w-12 h-12 bg-[#D8C3FF] rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="text-[#4A00BE] font-bold">4</span>
                                    </div>
                                    <h3 className="font-semibold text-xl mb-2">Get Results</h3>
                                    <p className="text-md text-gray-600 dark:text-gray-300">
                                        Receive viral content and pay creators based on performance
                                    </p>
                                </div> 
                                </div>*/}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      step: "1",
                      title: "Create Contest",
                      desc: "Set your brief, budget, and contest type (Leaderboard or CPM)",
                      image: "/images/equity-1.png",
                    },
                    {
                      step: "2",
                      title: "Creators Submit",
                      desc: "Talented creators create and submit videos based on your brief",
                      image: "/images/uploading.png",
                    },
                    {
                      step: "3",
                      title: "Content Review",
                      desc: "We review submissions to ensure quality and brand safety",
                      image: "/images/likes.png",
                    },
                    {
                      step: "4",
                      title: "Get Results",
                      desc: "Receive viral content and pay creators based on performance",
                      image: "/images/video.png",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "relative text-center p-6 pt-8",
                        panelClass,
                        "shadow-[0px_12px_28px_-16px_rgba(127,57,236,0.75)]",
                      )}
                    >
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border-2",
                            isDark
                              ? "bg-[#D8C3FF] border-[#2A0F56]"
                              : "bg-[#D8C3FF] border-white",
                          )}
                        >
                          <span className="text-[#4A00BE] text-md font-bold">
                            {item.step}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "relative h-24 w-full mb-4 rounded-xl overflow-hidden",
                  
                        )}
                      >
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                      <h3 className="font-semibold text-lg sm:text-xl mb-2">
                        {item.title}
                      </h3>
                      <p
                        className={cn(
                          "text-md",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="text-center pt-4">
                  <Link href="/dashboard/contests">
                    <Button
                      className={cn(
                        "text-md text-white",
                        isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]",
                      )}
                    >
                      {/* <Play className="w-4 h-4 mr-2" /> */}
                      Create Your First Contest
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </div>

            {/* Contest Types Section */}
            <div>
              <div className="text-center pb-4">
                <h2
                  className={cn(
                    "text-2xl font-bold",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  Choose Your Contest Type
                </h2>
              </div>

              <div className="p-2 md:px-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Leaderboard Contest Section */}
                  <div
                    className={cn(
                      "p-6 rounded-2xl border shadow-[0px_18px_34px_-24px_rgba(127,57,236,0.65)] transition-all duration-200 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#22074A] border-[#B994F8]/45 text-white"
                        : "bg-white border-[#E9D8FF] text-[#2D1B4E]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div
                        className={cn(
                          "p-2 rounded-full",
                          isDark ? "bg-[#D8C3FF]" : "bg-[#D8C3FF]",
                        )}
                      >
                        <Trophy className="w-5 h-5 text-[#4A00BE]" />
                      </div>
                      <h3 className="font-bold text-lg">
                        Leaderboard Contests
                      </h3>

                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-purple-700",
                          isDark
                            ? "bg-[#2E1160] border-[#B994F8]/55 text-[#E7D5FF]"
                            : "bg-[#ECE1FC] border-[#DABFFF]",
                        )}
                      >
                        Competition Based
                      </Badge>
                    </div>

                    <p
                      className={cn(
                        "text-md mb-4",
                        isDark ? "text-[#D8C7F5]" : "text-gray-600",
                      )}
                    >
                      Set a fixed prize pool and let creators compete for the
                      top spots.
                    </p>

                    {/* Visual Process */}
                    <div className="text-center mb-4">
                      <div
                        className={cn(
                          "inline-block p-4 border rounded-lg",
                          isDark
                            ? "bg-[#2A0C5A] border-[#B994F8]/50 text-[#F5EEFF]"
                            : "bg-[#F7F1FF] border-[#D6B6FF] text-black",
                        )}
                      >
                        <div className="text-lg font-bold mb-1">
                          Set Prize Pool → Creators Compete → Winners Get Paid
                        </div>
                        <div className="text-sm">
                          Example: $1000 total, 3 winners get $500, $300, $200
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4">
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Fixed budget - know your total cost upfront
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          High competition drives quality content
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Own winning videos forever
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Perfect for viral marketing & brand awareness
                        </span>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <Link href="/dashboard/contests">
                        <Button
                          className={cn(
                            "text-md text-white w-full",
                            isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]",
                          )}
                        >
                          <Trophy className="w-4 h-4" />
                          Create Leaderboard Contest
                        </Button>
                      </Link>
                    </div>
                  </div>

                  {/* CPM Contest Section */}
                  <div
                    className={cn(
                      "p-6 rounded-2xl border shadow-[0px_18px_34px_-24px_rgba(127,57,236,0.65)] transition-all duration-200 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#22074A] border-[#B994F8]/45 text-white"
                        : "bg-white border-[#E9D8FF] text-[#2D1B4E]",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <div className="p-2 bg-[#D8C3FF]  rounded-full">
                        <DollarSign className="w-5 h-5 text-[#4A00BE]" />
                      </div>
                      <h3 className="font-bold text-lg flex items-center">
                        CPM Contests
                        {/* Info Icon with hover tooltip */}
                        {/* <div className="ml-2 relative group">
                          <Info className="w-4 h-4 text-black cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            <strong>CPM</strong> stands for{" "}
                            <em>COST PER MILE</em>
                          </div>
                        </div> */}
                      </h3>

                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-purple-700",
                          isDark
                            ? "bg-[#2E1160] border-[#B994F8]/55 text-[#E7D5FF]"
                            : "bg-[#ECE1FC] border-[#DABFFF]",
                        )}
                      >
                        Pay Per 1000 Views
                      </Badge>
                    </div>

                    <p
                      className={cn(
                        "text-md mb-4",
                        isDark ? "text-[#D8C7F5]" : "text-gray-600",
                      )}
                    >
                      Pay only for actual views. More views = more marketing
                      reach for your brand.
                    </p>

                    {/* Visual Process */}
                    <div className="text-center mb-4">
                      <div
                        className={cn(
                          "inline-block p-4 border rounded-lg",
                          isDark
                            ? "bg-[#2A0C5A] border-[#B994F8]/50 text-[#F5EEFF]"
                            : "bg-[#F7F1FF] border-[#D6B6FF] text-black",
                        )}
                      >
                        <div className="text-lg font-bold mb-2">
                          Set CPM Rate → Creators Post → Pay Per Views
                        </div>
                        <div className="text-md">
                          Example: $5 per 1K views, 50K views = $250 payment
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4">
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Pay only for performance - no wasted budget
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Scalable - more views = more marketing
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Set max budget & CPM rate for control
                        </span>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            isDark ? "text-[#D0AAFF]" : "text-[#6A30CC]",
                          )}
                        />
                        <span
                          className={cn(
                            "text-md",
                            isDark ? "text-[#E7DAFF]" : "text-gray-700",
                          )}
                        >
                          Perfect for ongoing marketing & paid advertising
                        </span>
                      </div>
                    </div>

                    <div className="text-center pt-4">
                      <Link href="/dashboard/contests">
                        <Button
                          className={cn(
                            "text-md text-white w-full",
                            isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]",
                          )}
                        >
                          <DollarSign className="w-4 h-4" />
                          Create CPM Contest
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Quality & Safety */}
            <div>
              <div className="text-center pb-5">
                <div className="flex items-center justify-center space-x-3">
                  <h2
                    className={cn(
                      "text-2xl md:text-3xl font-bold tracking-tight",
                      isDark ? "text-white" : "text-[#220044]",
                    )}
                  >
                    Content Quality & Safety
                  </h2>
                </div>
              </div>

              <CardContent className="space-y-6">
                <div className="text-center mb-6">
                  <p
                    className={cn(
                      "text-base md:text-lg",
                      isDark ? "text-[#DCC7FF]" : "text-[#5F4B7C]",
                    )}
                  >
                    We ensure all content meets high quality standards and brand
                    safety requirements.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50 text-white"
                        : "bg-white border-[#E9D8FF] text-black",
                    )}
                  >
                    <h3 className="font-semibold text-xl mb-4">
                      Quality Review:
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[13px]",
                        isDark ? "text-white" : "text-gray-700",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Content follows your brief and guidelines</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Video quality and production standards</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Brand safety and compliance checks</span>
                      </li>
                    </ul>
                  </div>

                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50 text-white"
                        : "bg-white border-[#E9D8FF] text-black",
                    )}
                  >
                    <h3 className="font-semibold text-xl mb-4">
                      What You Get:
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[14px]",
                        isDark
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Verified, high-quality content</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Performance metrics and analytics</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Usage rights for winning content</span>
                      </li>
                    </ul>
                  </div>

                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50 text-white"
                        : "bg-white border-[#E9D8FF] text-black",
                    )}
                  >
                    <h3 className="font-semibold mb-4 text-xl">
                      Platform Support:
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[14px]",
                        isDark
                          ? "text-white"
                          : "text-gray-700 dark:text-gray-300",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Dedicated campaign management</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Creator community access</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>24/7 support and guidance</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div
                  className={cn(
                    "p-5 rounded-2xl border",
                    isDark
                      ? "bg-gradient-to-r from-[#2A0D58] to-[#1C083D] border-[#B994F8]/55"
                      : "bg-gradient-to-r from-[#F7EFFF] to-[#FDFBFF] border-[#D8B9FF]",
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {/* <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                                        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div> */}
                    <div>
                      <h4
                        className={cn(
                          "font-semibold text-lg mb-2",
                          isDark ? "text-white" : "text-[#301454]",
                        )}
                      >
                        Pro Tip:
                      </h4>
                      <p
                        className={cn(
                          "text-md",
                          isDark ? "text-[#E6D5FF]" : "text-[#3B2A57]",
                        )}
                      >
                        <strong>Create clear, detailed briefs</strong> to get
                        the best content. Include your brand guidelines, target
                        audience, and specific requirements for better results.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </div>
          </div>
        </div>
      ) : (
        // CREATOR CONTENT
        <div>
          {/* Platform Overview Section */}
          <div
            className={cn(
              "border-b text-center shadow-xl px-6 rounded-tl-xl rounded-tr-xl pt-6 pb-4",
              isDark
                ? "bg-[#170337] border-gray-600"
                : "bg-white border-gray-300",
            )}
          >
            <div className="flex justify-start space-x-3">
              {/* <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                    <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div> */}
              <h2
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-[#7F39EC]",
                )}
              >
                Welcome to Game Of Creators
              </h2>
            </div>
          </div>
          <div
            className={cn(
              "space-y-8 shadow-lg bg-white px-6 pt-6 pb-6",
              isDark ? "bg-[#170337] text-white" : "bg-white text-black",
            )}
          >
            <div className="md:px-2">
              <div className="space-y-6">
                <div className="text-start mb-6">
                  <p
                    className={cn(
                      "text-lg mb-4",
                      isDark ? "text-white" : "text-gray-700",
                    )}
                  >
                    <strong>Game Of Creators</strong> connects content creators
                    with brands through video contests.
                  </p>
                  <p
                    className={cn(
                      "text-gray-600 dark:text-gray-400",
                      isDark ? "text-white" : "text-gray-600",
                    )}
                  >
                    Create videos, compete for prizes, or get paid per view.
                    Simple as that.
                  </p>
                </div>

                {/* Platform Benefits */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_22px_36px_-24px_rgba(169,118,255,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">Earn Money</h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    >
                      Get paid for your creativity through contests and
                      CPM-based earnings
                    </p>
                  </div>
                  {/* <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Earn Money</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get paid for your creativity through contests and CPM-based
                    earnings
                  </p>
                </div> */}
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_22px_36px_-24px_rgba(169,118,255,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Users className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">
                      Build Portfolio
                    </h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    >
                      Create professional content for real brands to showcase
                      your skills
                    </p>
                  </div>
                  {/* <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Build Portfolio</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Create professional content for real brands to showcase your
                    skills
                  </p>
                </div> */}
                  <div
                    className={cn(
                      "text-center p-6 rounded-3xl border transition-all duration-300 hover:-translate-y-1",
                      isDark
                        ? "bg-[#22074A] border-[#C7A3FF]/45 text-white shadow-[0px_22px_36px_-24px_rgba(169,118,255,0.75)]"
                        : "bg-white border-[#EAD9FF] text-black shadow-[0px_22px_36px_-24px_rgba(95,43,177,0.5)]",
                    )}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-[#EFE1FF] to-[#D9C0FF] rounded-xl flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-6 h-6 text-[#4A00BE]" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">
                      Grow Audience
                    </h3>
                    <p
                      className={cn(
                        "text-md",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    >
                      Reach new audiences through brand collaborations and
                      contests
                    </p>
                  </div>
                  {/* <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-semibold mb-2">Grow Audience</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Reach new audiences through brand collaborations and
                    contests
                  </p>
                </div> */}
                </div>
              </div>
            </div>

            {/* How to Participate Section */}
            <div className="md:px-2 mt-12">
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center space-x-3 mb-5">
                  {/* <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Video className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div> */}
                  <h2
                    className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    How to Participate
                  </h2>
                </div>
              </CardHeader>

              <div className="space-y-12">
                {/* Simple Steps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      step: "1",
                      title: "Browse Contests",
                      desc: "Find contests that match your content style and audience",
                      image: "/images/play (1).png",
                    },
                    {
                      step: "2",
                      title: "Create & Submit",
                      desc: "Make your video following the contest brief, rules and submit",
                      image: "/images/uploading.png",
                    },
                    {
                      step: "3",
                      title: "Content Review",
                      desc: "Your content is reviewed to ensure it follows all guidelines",
                      image: "/images/likes.png",
                    },
                    {
                      step: "4",
                      title: "Earn Money",
                      desc: "Get paid based on performance or ranking & win real cash & prizes",
                      image: "/images/money.png",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "relative text-center p-6 pt-8",
                        panelClass,
                        "shadow-[0px_12px_28px_-16px_rgba(127,57,236,0.75)]",
                      )}
                    >
                      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center border-2",
                            isDark
                              ? "bg-[#D8C3FF] border-[#2A0F56]"
                              : "bg-[#D8C3FF] border-white",
                          )}
                        >
                          <span className="text-[#4A00BE] text-sm font-bold">
                            {item.step}
                          </span>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "relative h-24 w-full mb-4 rounded-xl overflow-hidden",
                         
                        )}
                      >
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                      <h3 className="font-semibold text-lg sm:text-xl mb-2">
                        {item.title}
                      </h3>
                      <p
                        className={cn(
                          "text-md",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        {item.desc}
                      </p>
                    </div>
                  ))}
                  {/* <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      1
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">Browse Contests</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Find contests that match your content style and audience
                  </p>
                </div> */}
                  {/* <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      2
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">Create & Submit</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Make your video following the contest brief, rules and
                    submit
                  </p>
                </div> */}
                  {/* <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-orange-600 dark:text-orange-400 font-bold">
                      3
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">Content Review</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Your content is reviewed to ensure it follows all guidelines
                  </p>
                </div> */}
                  {/* <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-600 dark:text-green-400 font-bold">
                      4
                    </span>
                  </div>
                  <h3 className="font-semibold mb-2">Earn Money</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get paid based on performance or ranking & win real cash &
                    prizes
                  </p>
                </div> */}
                </div>

                <div className="text-center pt-3">
                  <Link href="/dashboard/opportunities">
                    <Button
                      className={cn("text-md text-white px-6 py-5", primaryButtonClass)}
                    >
                      <Video className="w-4 h-4" />
                      Browse Contests
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Contest Types for Creators */}
            <div className="mt-3">
              <CardHeader className="text-center pb-8">
                <h2
                  className={cn(
                    "text-2xl font-bold",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  Contest Types
                </h2>
              </CardHeader>

              <div className="p-0 md:px-4 ">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Leaderboard for Creators */}
                  <div
                    className={cn(
                      "w-full rounded-2xl p-6 flex flex-col justify-between border shadow-[0px_18px_34px_-24px_rgba(127,57,236,0.65)]",
                      isDark
                        ? "bg-[#22074A] border-[#B994F8]/45 text-white"
                        : "bg-white border-[#E9D8FF] text-[#2D1B4E]",
                    )}
                  >
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2.5 bg-[#D8C3FF] rounded-full">
                          <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h3 className="font-bold text-lg">
                          Leaderboard Contests
                        </h3>
                      </div>
                      <p
                        className={cn(
                          "text-md mb-4",
                          isDark ? "text-gray-300" : "text-black",
                        )}
                      >
                        Compete with other creators for prizes. Winners
                        determined by views and engagement.
                      </p>

                      {/* Visual Prize Breakdown */}
                      <div className="space-y-4 mt-8">
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                              <span
                                className={cn(
                                  "text-black font-bold text-sm",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                1
                              </span>
                            </div>
                            <span className="font-medium">1st Place</span>
                          </div>
                          <span
                            className={cn(
                              "font-bold text-lg",
                              isDark ? "text-gray-300" : "text-black",
                            )}
                          >
                            $500
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                              <span
                                className={cn(
                                  "text-black font-bold text-sm",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                2
                              </span>
                            </div>
                            <span className="font-medium">2nd Place</span>
                          </div>
                          <span
                            className={cn(
                              "font-bold text-lg",
                              isDark ? "text-gray-300" : "text-black",
                            )}
                          >
                            $300
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                              <span
                                className={cn(
                                  "text-black font-bold text-sm",
                                  isDark ? "text-white" : "text-black",
                                )}
                              >
                                3
                              </span>
                            </div>
                            <span className="font-medium">3rd Place</span>
                          </div>
                          <span
                            className={cn(
                              "font-bold text-lg",
                              isDark ? "text-gray-300" : "text-black",
                            )}
                          >
                            $200
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <div
                        className={cn(
                          "inline-block px-5 py-2 border rounded-xl",
                          isDark
                            ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                            : "bg-[#D8C3FF54] border-[#7F39EC]",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isDark ? "text-white" : "text-[#7F39EC]",
                          )}
                        >
                          Example Prize Pool
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* CPM for Creators */}
                  <div
                    className={cn(
                      "w-full rounded-2xl border p-6 shadow-[0px_18px_34px_-24px_rgba(127,57,236,0.65)]",
                      isDark
                        ? "bg-[#22074A] border-[#B994F8]/45 text-white"
                        : "bg-white border-[#E9D8FF] text-[#2D1B4E]",
                    )}
                  >
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2.5 bg-[#D8C3FF] rounded-full">
                        <DollarSign className="w-6 h-6 text-purple-600" />
                      </div>
                      <h3 className="font-bold text-lg">CPM Contests</h3>
                    </div>
                    <p
                      className={cn(
                        "text-md mb-2",
                        isDark ? "text-gray-300" : "text-black",
                      )}
                    >
                      Get paid per 1000 views. More views = more money. No
                      competition needed.
                    </p>

                    {/* Visual Rate Display */}
                    <div className="text-center mb-4">
                      <div
                        className={cn(
                          "inline-block px-4 py-2 rounded-xl",
                          isDark
                            ? "border border-[#7F39EC] bg-[#D9C0FF26]"
                            : "bg-[#4A00BE]",
                        )}
                      >
                        <div className="text-xl font-bold text-white">
                          $5.00
                        </div>
                        <div className="text-sm text-white">
                          per 1,000 views
                        </div>
                      </div>
                    </div>

                    {/* Visual Earnings Examples */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                            <Video
                              className={cn(
                                "w-5 h-5",
                                isDark ? "text-white" : "text-black",
                              )}
                            />
                          </div>
                          <span className="font-medium">10K views</span>
                        </div>
                        <span
                          className={cn(
                            "font-bold text-lg",
                            isDark ? "text-gray-300" : "text-black",
                          )}
                        >
                          $50
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                            <Video
                              className={cn(
                                "w-5 h-5",
                                isDark ? "text-white" : "text-black",
                              )}
                            />
                          </div>
                          <span className="font-medium">50K views</span>
                        </div>
                        <span
                          className={cn(
                            "font-bold text-lg",
                            isDark ? "text-gray-300" : "text-black",
                          )}
                        >
                          $250
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-400">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 border border-gray-500 rounded-full flex items-center justify-center">
                            <Video
                              className={cn(
                                "w-5 h-5",
                                isDark ? "text-white" : "text-black",
                              )}
                            />
                          </div>
                          <span className="font-medium">100K views</span>
                        </div>
                        <span
                          className={cn(
                            "font-bold text-lg",
                            isDark ? "text-gray-300" : "text-black",
                          )}
                        >
                          $500
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 text-center">
                      <div
                        className={cn(
                          "inline-block px-5 py-2 border rounded-xl",
                          isDark
                            ? "bg-[#C9A7FF26] border-[#C9A7FF]"
                            : "bg-[#D8C3FF54] border-[#7F39EC]",
                        )}
                      >
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isDark ? "text-white" : "text-[#7F39EC]",
                          )}
                        >
                          Example Earnings
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Verification Process */}
            <div className="mt-8">
              <CardHeader className="text-center pb-4">
                <div className="flex flex-col items-center justify-center space-x-3">
                  {/* <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                    <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div> */}
                  <h2
                    className={cn(
                      "text-2xl md:text-3xl font-bold tracking-tight",
                      isDark ? "text-white" : "text-[#220044]",
                    )}
                  >
                    Content Verification Process
                  </h2>
                  <div className="text-md text-center mb-6">
                    <p
                      className={cn(
                        "mt-4",
                        isDark ? "text-[#DCC7FF]" : "text-[#5F4B7C]",
                      )}
                    >
                      After you submit your content, it goes through a
                      verification process to ensure quality and compliance.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <div className="space-y-6 md:px-2 mb-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div
                    className={cn(
                      "text-center text-start p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50"
                        : "bg-white border-[#E9D8FF]",
                    )}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-center text-xl mb-3",
                        isDark ? "text-white" : "text-black",
                      )}
                    >
                      What We Review:
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[13px]",
                        isDark ? "text-gray-300" : "text-gray-700",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>
                          {" "}
                          Content follows contest brief, rules and guidelines
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Video quality and brand safety compliance</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Platform rules and policy adherence</span>
                      </li>
                    </ul>
                  </div>
                  {/* <div className="p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-950">
                    <h3 className="font-semibold mb-3 text-orange-800 dark:text-orange-200">
                      What We Review:
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>
                          Content follows contest brief, rules and guidelines
                        </span>
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
                  </div> */}
                  <div
                    className={cn(
                      "p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50"
                        : "bg-white border-[#E9D8FF]",
                    )}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-center text-xl mb-3",
                        isDark ? "text-white" : "text-black",
                      )}
                    >
                      If Approved (Verified):
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[13px]",
                        isDark ? "text-gray-300" : "text-gray-700",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Content is marked as "Verified" if approved</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>Your video becomes eligible for payment</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>
                          Performance tracking continues for contest rankings
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>If you win the contest you will get paid</span>
                      </li>
                    </ul>
                  </div>
                  {/* <div className="p-4 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950">
                    <h3 className="font-semibold mb-3 text-green-800 dark:text-green-200">
                      If Approved (Verified):
                    </h3>
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
                        <span>
                          Performance tracking continues for contest rankings
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>If you win the contest you will get paid</span>
                      </li>
                    </ul>
                  </div> */}

                  <div
                    className={cn(
                      "p-6 rounded-3xl border shadow-[0px_18px_34px_-24px_rgba(106,48,204,0.6)] transition-all duration-300 hover:-translate-y-0.5",
                      isDark
                        ? "bg-[#21094A] border-[#B994F8]/50"
                        : "bg-white border-[#E9D8FF]",
                    )}
                  >
                    <h3
                      className={cn(
                        "font-semibold text-center text-xl mb-3",
                        isDark ? "text-white" : "text-black",
                      )}
                    >
                      If Not Approved (Rejected):
                    </h3>
                    <ul
                      className={cn(
                        "space-y-3 text-[13px]",
                        isDark ? "text-gray-300" : "text-gray-700",
                      )}
                    >
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>You will not qualify for that contest</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>You will be removed from leaderboard</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>
                          But you can still see all your submissions in "My
                          Submissions" section
                        </span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <Check className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>
                          {" "}
                          You will not be eligible for any winnings for that
                          contest
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* <div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950">
                    <h3 className="font-semibold mb-3 text-red-800 dark:text-red-200">
                      If Not Approved (Rejected):
                    </h3>
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
                        <span>
                          But you can still see all your submissions in "My
                          Submissions" section
                        </span>
                      </li>

                      <li className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <span>
                          You will not be eligible for any winnings for that
                          contest
                        </span>
                      </li>
                    </ul>
                  </div> */}
                </div>

                <div
                  className={cn(
                    "p-5 rounded-2xl border",
                    isDark
                      ? "bg-gradient-to-r from-[#2A0D58] to-[#1C083D] border-[#B994F8]/55"
                      : "bg-gradient-to-r from-[#F7EFFF] to-[#FDFBFF] border-[#D8B9FF]",
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {/* <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div> */}
                    <div>
                      <h4
                        className={cn(
                          "font-semibold text-lg",
                          isDark ? "text-white" : "text-[#301454]",
                        )}
                      >
                        Pro Tip:
                      </h4>
                      <p
                        className={cn(
                          "text-md mt-2",
                          isDark ? "text-[#E6D5FF]" : "text-[#3B2A57]",
                        )}
                      >
                        <strong>
                          Follow the contest brief and guidelines carefully.
                        </strong>{" "}
                        This ensures faster verification and better performance.
                        Quality content = more money!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Next Steps Section */}
      {userType === "advertiser" ? (
        // BRAND/ADVERTISER READY TO START
        <div
          className={cn(
            "space-y-8 rounded-bl-xl rounded-br-xl shadow-lg px-6 pb-6",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black",
          )}
        >
          <CardContent
            className={cn(
              "p-6 border border-[#7F39EC] rounded-2xl",
              isDark ? "bg-[#170337] text-white" : "bg-[#D9C0FF26]",
            )}
          >
            <div className="text-center mb-6">
              <h3
                className={cn(
                  "text-2xl font-bold mb-2",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Ready to Start?
              </h3>
              <p className={cn(isDark ? "text-gray-300" : "text-gray-600")}>
                Start creating contests and campaigns
              </p>
            </div>

            <div className="text-center">
              <Link href="/dashboard/contests">
                <Button
                  className={cn(
                    "w-full py-3 px-8 text-lg",
                    isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE]",
                  )}
                >
                  <Video className="w-6 h-6" />
                  Create Contest
                </Button>
              </Link>
            </div>
          </CardContent>
        </div>
      ) : (
        // CREATOR READY TO START (original simple layout)
        <div
          className={cn(
            "space-y-8 rounded-bl-xl rounded-br-xl shadow-lg bg-white px-6 pb-6",
            isDark ? "bg-[#170337] text-white" : "bg-white text-black",
          )}
        >
          <CardContent
            className={cn(
              "p-6 border border-[#7F39EC] rounded-2xl",
              isDark ? "bg-[#170337]" : "bg-[#D9C0FF26]",
            )}
          >
            <div className="text-center mb-6">
              <h3
                className={cn(
                  "text-2xl font-bold",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Ready to Start?
              </h3>
              <p
                className={cn(
                  "mt-2",
                  isDark ? "text-gray-300" : "text-gray-600",
                )}
              >
                Start participating in contests and earning money
              </p>
            </div>

            <div className="text-center flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/dashboard/opportunities">
                <Button
                  className={cn(
                    "w-full py-3 px-8 text-lg",
                    primaryButtonClass,
                  )}
                >
                  <Video className="w-5 h-5" />
                  Browse Contests
                </Button>
              </Link>
              <a
                href={SOCIAL_LINKS.discord}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className={cn(
                    "w-full py-3 px-8 text-lg",
                    primaryButtonClass,
                  )}
                >
                  <FaDiscord className="w-5 h-5" />
                  Join Community
                </Button>
              </a>
              <a
                href={SOCIAL_LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className={cn(
                    "w-full py-3 px-8 text-lg",
                    primaryButtonClass,
                  )}
                >
                  <FaWhatsapp className="w-5 h-5" />
                  Join Community
                </Button>
              </a>
            </div>
          </CardContent>
        </div>
      )}

      {/* Discord Onboarding Modal */}
      <DiscordOnboardingModal
        isOpen={showDiscordModal}
        onClose={() => setShowDiscordModal(false)}
      />
    </div>
  );
}

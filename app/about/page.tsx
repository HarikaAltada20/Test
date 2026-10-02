"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Star, Trophy, Palette,ArrowRight, Camera, Heart, Sparkles, Check, Crown, Upload, Wallet, BarChart3 } from "lucide-react";
import socialMediaIcon from "@/public/images/social_pair.avif";
import phoneIllustration from "@/public/images/phoneIllustration.avif";
import { cn } from "@/lib/utils";
import CtcBanner from "@/components/CtcBanner";

const howItWorksData = [
  {
    title: "For Brands",
    description:
      "Launch a campaign with clear guidelines, set prize pools, and watch as creators submit their best content featuring your products or services.",
    image: "/images/rafiki.avif",
  },
  {
    title: "For Creators",
    description:
      "Browse available campaigns, create content for brands you're passionate about, and earn rewards when your content performs well.",
    image: "/images/rafiki-2.avif",
  },
  {
    title: "The Results",
    description:
      "Brands receive authentic content at scale, while creators foster relationships and expand their audiences through collaborations.",
    image: "/images/amico.avif",
  },
];
const values = [
  {
    title: "Authenticity",
    description:
      "We believe in the power of genuine content that resonates with real audiences.",
  },
  {
    title: "Innovation",
    description:
      "We're constantly evolving our platform to meet the changing needs of both brands and creators.",
  },
  {
    title: "Opportunity",
    description:
      "We're committed to creating fair opportunities for creators of all sizes and backgrounds.",
  },
  {
    title: "Community",
    description:
      "We foster a supportive community where both brands and creators can grow together.",
  },
];
export default function AboutPage() {
  const storyRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const howItWorksRef = useRef<HTMLHeadingElement>(null);
  const valuesRef = useRef<HTMLHeadingElement>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry], observerInstance) => {
        if (entry.isIntersecting) {
          // How It Works section
          if (entry.target === howItWorksRef.current) {
            setShowHowItWorks(true);
            observerInstance.unobserve(entry.target);
          }

          // Values section
          if (entry.target === valuesRef.current) {
            setShowValues(true);
            observerInstance.unobserve(entry.target);
          }

          // Story section
          if (entry.target === storyRef.current) {
            setVisible(true);
            observerInstance.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.3 } // Use the lower threshold to cover both cases
    );

    // Observe all refs if they exist
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);
    if (valuesRef.current) observer.observe(valuesRef.current);
    if (storyRef.current) observer.observe(storyRef.current);

    return () => {
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
      if (valuesRef.current) observer.unobserve(valuesRef.current);
      if (storyRef.current) observer.unobserve(storyRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pt-[10px] overflow-hidden">
      <div className="relative z-20">
     

        <section className="py-20 px-4 sm:px-8 lg:px-28 bg-black flex flex-col items-center justify-center text-center" ref={storyRef}>
          <div className="flex flex-col items-center justify-center gap-4 max-w-[806px] mx-auto">
            {/* Pill Badge */}
            <div className="inline-flex items-center justify-center px-3.5 py-1 bg-[#353535] rounded-[16px] border border-[#434343]">
              <span className="text-[#C4C4C4] text-[15px] font-normal leading-[21px]">
                About us
              </span>
            </div>

            {/* Title & Description */}
            <div className="flex flex-col items-center gap-4 mt-2">
              <h1 className="font-['Inter'] font-bold text-3xl sm:text-[4xl] md:text-[50px] leading-[110%] tracking-[-4%] text-center bg-gradient-to-b from-white via-white/90 to-neutral-400 bg-clip-text text-transparent leading-[110%] tracking-tight px-2 py-1">
                Our Story
              </h1>
              <p className="text-[#8E8E8E] text-base sm:text-lg md:text-[20px] font-medium leading-[150%] md:leading-[30px] text-center">
                Launched in{" "}
                <span className="text-white font-medium">2024</span>, Game Of Creators addresses a key challenge: brands often struggle to produce engaging content, while creators seek meaningful collaborations. Our platform serves as a campaign marketplace, enabling brands to host content creation contests and allowing creators to showcase their talents for prizes and recognition.
              </p>
            </div>
          </div>
        </section>

     

        <section className="bg-black py-[60px] md:py-[90px] px-6 sm:px-12 lg:px-[120px] flex flex-col items-center justify-center">
          <div className="w-full max-w-[1100px] flex flex-col items-center gap-8 md:gap-[56px]">
            <div className="flex flex-col items-center gap-4">
              <h2
                // ref={valuesRef}
                className="text-center text-white text-3xl sm:text-4xl md:text-[52px] font-bold leading-[110%] tracking-tight transition-all duration-700 ease-out transform"
                //   showValues
                //     ? "translate-y-0 opacity-100"
                //     : "translate-y-10 opacity-0"
                // }`}
              >
                Our Value
              </h2>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="bg-[#171717] rounded-[16px] p-6 sm:p-7 flex flex-col items-start gap-4 shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)] border border-white/10 hover:border-white/20 transition-all duration-300"
                >
                  <div className="w-9 h-9 rounded-full bg-[#535353] shadow-[0px_0.5px_1px_#636363] flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col items-start gap-[2px] text-left">
                    <h3 className="text-white text-lg sm:text-[20px] font-semibold leading-[30px]">
                      {value.title}
                    </h3>
                    <p className="text-[#757575] text-sm sm:text-[15px] font-medium leading-[22.5px]">
                      {value.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* Campaign Process Cards */}
        <section className="relative py-14 sm:py-20 md:py-28 bg-[#030405] transition-colors duration-300">
          <div className="relative mx-auto max-w-[1200px] px-4 sm:px-5">
            {/* Heading */}
            <div className="mb-10 text-center sm:mb-16">
              <h2 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl lg:text-[52px] text-white">
                How it works
              </h2>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 min-[700px]:grid-cols-2 min-[900px]:grid-cols-3">
              {/* Card 1 */}
              <div className="relative min-h-[460px] overflow-hidden rounded-[20px] sm:min-h-[515px] border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]">
                {/* BACKGROUND DETAILS FORM (MASK GROUP) */}
                <div
                  className="absolute left-3 right-3 top-3 h-[240px] overflow-hidden sm:left-5 sm:right-5 sm:top-12 sm:h-[240px]"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse 75% 75% at 60% 40%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "radial-gradient(ellipse 75% 75% at 60% 40%, rgba(0,0,0,1) 55%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <div className="relative flex h-full w-full justify-center pt-2">
                    {/* Details Card Frame */}
                    <div
                      data-layer="Frame"
                      className="Frame flex h-[200px] w-[280px] sm:h-[244.83px] sm:w-[365.41px] flex-col justify-start gap-[9.72px] rounded-[9.72px] p-[11.66px] transition-colors duration-300 bg-[#131313] outline-[0.49px] outline-[#A890F9] outline-offset-[-0.49px] text-white"
                    >
                      {/* Section Header */}
                      <div className="flex items-center justify-between pb-[5.83px]">
                        <div className="flex items-center gap-[5.83px]">
                          <div className="flex h-[13.6px] w-[13.6px] items-center justify-center rounded-[5.83px] bg-[#2E2E2E] text-white">
                            <span className="text-[5.83px] font-medium">1</span>
                          </div>
                          <span className="text-[9.51px] font-medium text-white">
                            Details
                          </span>
                        </div>
                      </div>

                      {/* Campaign Title Field */}
                      <div className="flex flex-col gap-[3.89px]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-[1.94px]">
                            <span className="text-[6.32px] font-medium text-[#F1EEF5]">
                              Campaign title
                            </span>
                            <span className="text-[6.32px] font-medium text-[#EF4444]">*</span>
                          </div>
                          <span className="text-[5.83px] font-normal text-[#9E9AA6]">
                            0/100
                          </span>
                        </div>
                        <div className="flex items-center rounded-[3.89px] px-[7.77px] py-[5.83px] bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px] text-[#9E9AA6]">
                          <span className="text-[6.8px] font-normal">
                            e.g., Create a Viral shorts/video for our New App
                          </span>
                        </div>
                      </div>

                      {/* Platform + Content Type Row */}
                      <div className="flex gap-[7.77px]">
                        {/* Platform */}
                        <div className="flex flex-1 flex-col gap-[3.89px]">
                          <div className="flex items-start gap-[1.94px]">
                            <span className="text-[6.32px] font-medium text-[#F1EEF5]">
                              Platform
                            </span>
                            <span className="text-[6.32px] font-medium text-[#EF4444]">*</span>
                          </div>
                          <div className="flex items-center justify-between rounded-[3.89px] px-[7.77px] py-[5.83px] bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px] text-[#F1EEF5]">
                            <div className="flex items-center gap-[3.89px]">
                              <div className="flex h-[8px] w-[11px] items-center justify-center rounded-[2.5px] bg-[#737373]">
                                <span className="text-[4px] leading-none text-white">▶</span>
                              </div>
                              <span className="text-[6.8px] font-normal text-[#9E9AA6]">YouTube</span>
                            </div>
                            <span className="text-[6px] opacity-60">▼</span>
                          </div>
                        </div>

                        {/* Content Type (optional) */}
                        <div className="flex flex-1 flex-col gap-[3.89px]">
                          <div className="flex items-start gap-[1.94px]">
                            <span className="text-[6.32px] font-medium text-[#F1EEF5]">
                              Content Type (optional)
                            </span>
                          </div>
                          <div className="flex items-center justify-between rounded-[3.89px] px-[7.77px] py-[5.83px] bg-[#222222] outline-[0.49px] outline-[#252332] outline-offset-[-0.49px] text-[#F1EEF5]">
                            <span className="text-[6.8px] font-normal">Select content type</span>
                            <span className="text-[6px] opacity-60">▼</span>
                          </div>
                        </div>
                      </div>

                      {/* Thumbnail Field */}
                      <div className="flex flex-col gap-[3.89px]">
                        <span className="text-[6.32px] font-medium text-[#F1EEF5]">
                          Thumbnail
                        </span>
                        <div className="flex flex-col items-center justify-center rounded-[3.89px] p-[9.72px] bg-[#222222] outline-[0.49px] outline-[#353535] outline-offset-[-0.49px]">
                          <div className="flex flex-col items-center gap-[3.89px]">
                            <Upload size={11.66} className="text-[#737373]" />
                            <p className="text-[6.8px] font-normal">
                              <span className="text-[#F1EEF5]">Drag, drop or </span>
                              <span className="underline text-[#F1EEF5]">
                                browse thumbnail
                              </span>
                            </p>
                            <span className="text-[5.83px] font-normal text-[#9E9AA6]">
                              Max file size: 5MB
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Soft edge shade overlays */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#171717] via-[#171717]/70 to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#171717] via-[#171717]/70 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#171717] via-[#171717]/60 to-transparent" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-[#171717] via-[#171717]/85 to-transparent" />
                </div>

                {/* SHADE / OVERLAY */}
                <div className="absolute inset-0 bg-black/35" />
                <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-black/30 via-black/20 to-transparent" />
                <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-[#D9D9D9]/25 blur-[90px]" />

                {/* BUDGET CARD */}
                <div className="absolute right-6 top-6 z-10 transition-colors duration-300 opacity-[0.85]">
                  {/* Purple glow behind card */}
                  <div className="absolute -inset-[2px] rounded-[14px] blur-md bg-[radial-gradient(circle,rgba(200,145,255,0.25),transparent_75%)]" />

                  {/* Outer Budget Container */}
                  <div className="relative flex flex-col justify-start gap-[6px] rounded-[12px] p-[8px] overflow-hidden transition-all duration-300 bg-[#131313] outline-[0.60px] outline-[#C891FF] outline-offset-[-0.60px] text-white">
                    {/* Header Row: Wallet Icon + Budget Title */}
                    <div className="flex items-center gap-[6px]">
                      <Wallet size={14} className="text-white" />
                      <span className="text-[12px] font-medium leading-[14.40px] text-white">
                        Budget
                      </span>
                    </div>

                    {/* Value Field */}
                    <div className="flex items-center justify-start rounded-[5.72px] px-[12px] py-[4px] w-[150px] bg-[#222222] outline-[0.72px] outline-[#353535] outline-offset-[-0.72px] text-[#757575]">
                      <span className="text-[12px] font-medium text-[#757575]">
                        $ 24000
                      </span>
                    </div>
                  </div>
                </div>

                {/* BOTTOM GRADIENT */}
                <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#191919] via-[#191919]/95 to-transparent" />

                {/* TABS */}
                <div className="absolute left-3 right-3 top-[255px] z-20 flex justify-center sm:left-4 sm:right-4 min-[1150px]:left-7 min-[1150px]:right-auto min-[1150px]:justify-start sm:top-[295px]">
                  <div className="flex w-full max-w-[440px] items-center justify-between min-[1150px]:w-max min-[1150px]:max-w-none rounded-full p-0.5 sm:p-1 min-[1150px]:p-1.5 backdrop-blur-lg gap-0.5 min-[1150px]:gap-2 border border-white/10 bg-[#2a2a2a]/90">
                    <button className="flex-1 min-[1150px]:flex-initial rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-1.5 py-1 min-[360px]:px-2 min-[360px]:py-1 min-[1150px]:px-4 min-[1150px]:py-1.5 text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-sm text-white shadow-[0_4px_18px_rgba(124,58,237,0.55)] shrink-0 font-medium text-center whitespace-nowrap">
                      CPM
                    </button>

                    <button className="flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0 text-gray-400">
                      Leaderboard
                    </button>

                    <button className="flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0 text-gray-400">
                      Milestone
                    </button>

                    <button className="flex-1 min-[1150px]:flex-initial text-[9.5px] min-[360px]:text-[10.5px] min-[1150px]:text-[12px] text-center whitespace-nowrap px-1 py-1 min-[360px]:px-1.5 min-[360px]:py-1 min-[1150px]:px-1.2 min-[1150px]:py-1.5 font-medium shrink-0 text-gray-400">
                      Dual Rewards
                    </button>
                  </div>
                </div>

                {/* CONTENT */}
                <div className="absolute bottom-10 left-7 right-7 z-20">
                  <h2 className="mb-3 text-2xl font-semibold text-[#d6d6d6]">
                    Set up your campaign
                  </h2>

                  <p className="text-md leading-[1.45] text-[#a8a8a8]">
                    Define your brief, content requirements, rules, platforms
                    and budget to tailor your campaign strategy.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="relative min-h-[515px] overflow-hidden rounded-[20px] border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]">
                {/* Campaign thumbnails sitting behind the reel */}
                <div className="absolute inset-0 scale-110 blur-[2px]">
                  <div className="relative h-1/2 w-full">
                    <Image
                      src="/images/1ad1c9f574ea6d160a89ed07d1b57719736a1741.png"
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="relative h-1/2 w-full">
                    <Image
                      src="/images/fa2936792bd0f4aac9c0930fabbd4e09bf1395f3.png"
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>

                <div className="absolute inset-0 bg-[#232020]/95" />

                {/* Soft haze behind center image */}
                <div className="pointer-events-none absolute inset-x-6 bottom-32 top-10 rounded-[48px] blur-[55px] bg-white/[0.12]" />
                <div className="pointer-events-none absolute -left-6 top-20 h-52 w-32 rounded-full blur-[55px] bg-white/20" />

                {/* Center creator image */}
                <div className="absolute inset-x-0 bottom-0 top-2">
                  <Image
                    src="/images/Mask group (1).png"
                    alt="Creator publishing a reel"
                    fill
                    className="object-contain object-top"
                  />
                  {/* Bottom shade on image */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#1b1b1b] via-[#1b1b1b]/70 to-transparent" />
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-[#1b1b1b]" />

                {/* Publish badge */}
                <div className="absolute right-9 top-7 z-10">
                  <div className="relative inline-flex items-center">
                    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#6840d8] to-[#865de8] px-4 py-2 text-sm font-medium text-white shadow-lg">
                      Publish
                    </span>
                    <div className="pointer-events-none absolute -bottom-3.5 -left-3.5 h-7 w-7">
                      <Image
                        src="/images/Icon.png"
                        alt="Click icon"
                        width={28}
                        height={28}
                        className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7 z-10">
                  <h3 className="mb-3 text-2xl font-semibold text-white">
                    Creators discover & publish
                  </h3>

                  <p className="text-base leading-6 text-gray-400">
                    Creators create content based on your brief, gets reviewed and goes live after your approval
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="relative min-h-[515px] overflow-hidden rounded-[20px] min-[700px]:col-span-2 min-[900px]:col-span-1 border border-[#FFFFFF1A] bg-[#171717] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]">
                {/* Top background image */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[350px]">
                  <Image
                    src="/images/image 239 (1).png"
                    alt="Background graphic"
                    fill
                    className="object-contain object-top"
                  />
                </div>

                {/* Rewards panel */}
                <div
                  className="absolute left-4 right-4 top-8 sm:left-6 sm:right-6 min-[900px]:left-4 min-[900px]:-right-3 min-[1100px]:left-6 min-[1100px]:-right-4 sm:top-16 rounded-2xl p-4 sm:p-5 transition-all duration-300 border border-[#353535] bg-[#1F1F1F]"
                  style={{
                    WebkitMaskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
                    maskImage:
                      "linear-gradient(to bottom, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)",
                  }}
                >
                  <h4 className="mb-5 text-base font-semibold text-white">
                    Rewards Paid
                  </h4>

                  {[
                    {
                      name: "@glow.with.me",
                      category: "Fashion & Lifestyle",
                      amount: "$420",
                      avatar: "/images/Ellipse 2355.avif",
                    },
                    {
                      name: "@editing.daily",
                      category: "Skincare",
                      amount: "$310",
                      avatar: "/images/Ellipse 2355 (1).avif",
                    },
                    {
                      name: "@thatgirl.routines",
                      category: "Beauty",
                      amount: "$950",
                      avatar: "/images/Ellipse 2355 (2).avif",
                    },
                  ].map((user) => (
                    <div
                      key={user.name}
                      className="flex items-center justify-between py-3 last:border-0 border-b border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full">
                          <Image
                            src={user.avatar}
                            alt={user.name}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>

                        <div>
                          <p className="text-xs text-gray-300">
                            {user.name}
                          </p>
                          <p className="text-[9px] text-gray-500">
                            {user.category}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-300">
                          {user.amount}
                        </span>

                        <span className="rounded-full px-2 py-1 text-[9px] bg-green-500/10 text-green-400">
                          ✓ Paid
                        </span>
                      </div>
                    </div>
                  ))}

                  <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[9px] font-medium text-gray-300">
                    <BarChart3 size={11} className="opacity-80" />
                    All payments are based on verified performance
                  </p>
                </div>

                {/* Content */}
                <div className="absolute bottom-8 left-7 right-7 z-10">
                  <h3 className="mb-3 text-2xl font-semibold text-white">
                    Verified results. Rewards paid.
                  </h3>

                  <p className="text-base leading-6 text-gray-400">
                    We track performance so creators get paid on results and you
                    see where your budget went.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

          <section className="py-16 px-4 sm:px-8 lg:px-24 bg-black flex justify-center items-center">
                <div className="relative w-full max-w-[1200px] min-h-[471px] py-16 px-6 sm:px-12 flex flex-col justify-center items-center overflow-hidden rounded-[28px] border border-[#3A3636] bg-[linear-gradient(360deg,#000000_0%,#353535_100%)] shadow-[inset_0px_0px_4px_rgba(255,255,255,0.25)]">
                  {/* Background Decorative Shapes */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[335px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-202px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                    {/* <div className="w-[990px] h-[441px] absolute left-[27px] top-[354px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-183px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[27px] top-[308px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-230px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[27px] top-[288px] -rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" />
                    <div className="w-[990px] h-[441px] absolute left-[267px] top-[-250px] rotate-[33deg] origin-top-left opacity-20 bg-[#2D2D2D] shadow-[0px_2px_0px_black] rounded-full border border-[#2D2D2D]" /> */}
                  </div>
        
                  {/* Main Content Box */}
                  <div className="relative z-10 max-w-[654px] mx-auto flex flex-col items-center text-center gap-9">
                    <div className="flex flex-col items-center gap-4">
                      <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium text-white leading-[130%] tracking-tight">
                        Not sure which plan is right for you?
                      </h2>
                      <p className="text-[15px] sm:text-[17px] font-medium text-[#8E8E8E] leading-[150%]">
                        Book a demo with{" "}
                        <span className="text-[#F1F1F1] font-semibold">Vishesh</span>
                        , Founder of Game Of Creators. Join hundreds of successful businesses. Get answers and start launching impactful campaigns with a free consultation.
                      </p>
                    </div>
        
                    <a
                      href="https://calendly.com/guptavishesh2/30min"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2.5 px-9 py-3 bg-[#DEDEDE] text-[#353535] hover:bg-white rounded-[14px] font-semibold text-base leading-[20px] transition-all duration-200 cursor-pointer shadow-md group"
                    >
                      <span>Book Call Now</span>
                      <ArrowRight className="w-4 h-4 text-[#353535] transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </div>
                </div>
              </section>
        <CtcBanner />
      </div>
    </div>
  );
}

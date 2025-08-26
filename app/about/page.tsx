"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Star, Trophy, Palette, Camera, Heart, Sparkles } from "lucide-react";
import socialMediaIcon from "@/public/images/social_pair.avif";
import { Check, Crown } from "lucide-react";
import phoneIllustration from "@/public/images/phoneIllustration.avif";

const howItWorksData = [
  {
    title: "For Brands",
    description:
      "Launch a contest with clear guidelines, set prize pools, and watch as creators submit their best content featuring your products or services.",
    image: "/images/rafiki.avif",
  },
  {
    title: "For Creators",
    description:
      "Browse available contests, create content for brands you're passionate about, and earn rewards when your content performs well.",
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
    title: "Opportunity",
    description:
      "We're committed to creating fair opportunities for creators of all sizes and backgrounds.",
  },
  {
    title: "Innovation",
    description:
      "We're constantly evolving our platform to meet the changing needs of both brands and creators.",
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
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden border-b border-[#A87313]">
      <div className="relative z-20">
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
              className="absolute bottom-32 right-12 h-9 w-9 text-amber-400/40 animate-bounce"
              style={{ animationDelay: "0.8s" }}
            />
          </div>
          {/* Orange Ellipse Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1200px] h-[500px] rounded-full blur-3xl opacity-50 pointer-events-none bg-blue-ellipse"></div>

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
                    src={socialMediaIcon}
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
              className="text-3xl sm:text-3xl md:text-5xl lg:text-6xl flex flex-wrap justify-center gap-x-2 sm:gap-x-3 text-center mb-7 leading-tight slide-up"
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                About Game Of
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
                        "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
                    }}
                  >
                    Creators
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              Game Of Creators connects brands with creators through contests,
              allowing brands to generate genuine content while creators earn
              and grow.
            </p>
          </div>
        </section>

        <section className="py-16" ref={storyRef}>
          <div className="flex justify-center items-center py-12 px-4">
            <div className="relative  rounded-2xl p-6 md:p-12 flex flex-col md:flex-row items-center gap-8 shadow-lg max-w-7xl w-full border border-gray-600">
              {/* Purple Glow in Background */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-purple-500/20 to-transparent blur-2xl pointer-events-none"></div>

              {/* Text Section */}
              <div className="flex-1 relative z-10">
                <h2
                  className={`text-5xl ${visible ? "slide-up" : ""}`}
                  style={{ animationDelay: "0.5s" }}
                >
                  Our <span className="text-purple-400">Story</span>
                </h2>
                <p
                  className={`text-base md:text-xl leading-relaxed text-gray-300 mt-4 ${visible ? "slide-left" : ""
                    }`}
                  style={{ animationDelay: "1s" }}
                >
                  Launched in{" "}
                  <span className="font-semibold text-purple-300">
                    2024, Game Of Creators
                  </span>{" "}
                  addresses a key challenge: brands often struggle to produce
                  engaging content, while creators seek meaningful
                  collaborations. Our platform serves as a contest marketplace,
                  enabling brands to host content creation contests and allowing
                  creators to showcase their talents for prizes and recognition.
                </p>
              </div>

              {/* Image Section */}
              <div
                className={`flex-1 h-[350px] flex justify-center relative z-10 ${visible ? "slide-right" : ""
                  }`}
                style={{ animationDelay: "1.5s" }}
              >
                <Image
                  src={phoneIllustration}
                  alt="Phone Illustration"
                  className="max-w-[350px] w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="text-white py-16">
          <div className="max-w-[1250px] mx-auto px-6">
            <h2
              ref={howItWorksRef}
              className={`text-center text-3xl md:text-5xl font-bold mb-12 transition-all duration-700 ease-out transform ${showHowItWorks
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
                }`}
            >
              How It{" "}
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
                Works
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {howItWorksData.map((item, index) => (
                <div
                  key={index}
                  className="bg-[#0B0F27] border border-gray-700 rounded-xl p-9 flex cursor-pointer flex-col items-center text-center hover:bg-[#B16FF43D] hover:border-2 hover:border-[#7F39EC]"
                >
                  <div className="mb-6">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={250}
                      height={200}
                    />
                  </div>
                  <h3 className="text-2xl font-semibold mb-5">{item.title}</h3>
                  <p className="text-gray-300 text-xl">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-white py-16 px-6">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2
              ref={valuesRef}
              className={`text-5xl font-semibold transition-all duration-700 ease-out transform ${showValues
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
                }`}
            >
              Our{" "}
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
                Value
              </span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 mb-14">
              {values.map((value, index) => (
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
      </div>
    </div>
  );
}

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
            <div className="flex flex-col items-center gap-4 mt-4">
              <h1 className="text-3xl sm:text-4xl md:text-[52px] font-bold bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent leading-[110%] tracking-tight">
                Our Story
              </h1>
              <p className="text-[#8E8E8E] text-base sm:text-lg md:text-[20px] font-medium leading-[150%] md:leading-[30px] text-center">
                Launched in{" "}
                <span className="text-white font-medium">2024</span>, Game Of Creators addresses a key challenge: brands often struggle to produce engaging content, while creators seek meaningful collaborations. Our platform serves as a campaign marketplace, enabling brands to host content creation contests and allowing creators to showcase their talents for prizes and recognition.
              </p>
            </div>
          </div>
        </section>

        <section className="text-white py-16">
          <div className="max-w-[1250px] mx-auto px-6">
            <h2
              ref={howItWorksRef}
              className={`text-center text-4xl sm:text-5xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent mb-12 transition-all duration-700 ease-out transform ${
                showHowItWorks
                  ? "translate-y-0 opacity-100"
                  : "translate-y-10 opacity-0"
              }`}
            >
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {howItWorksData.map((item, index) => (
                <div
                  key={index}
                  className="bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] border border-white/10 rounded-xl p-9 flex cursor-pointer flex-col items-center text-center hover:border-white/20 transition-all duration-300"
                >
                  <div className="mb-6">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={250}
                      height={200}
                    />
                  </div>
                  <h3 className="text-2xl font-semibold mb-5 text-white">{item.title}</h3>
                  <p className="text-[#8E8E8E] text-xl">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-white py-16 px-6">
          <div className="max-w-[1200px] mx-auto text-center">
            <h2
              ref={valuesRef}
              className={`text-4xl sm:text-5xl font-black bg-[radial-gradient(45.89%_93.18%_at_47.35%_50%,_#FFFFFF_0%,_#999999_100%)] bg-clip-text text-transparent transition-all duration-700 ease-out transform ${
                showValues
                  ? "translate-y-0 opacity-100"
                  : "translate-y-10 opacity-0"
              }`}
            >
              Our Values
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 mb-14">
              {values.map((value, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-xl p-9 border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.8)_100%)] hover:border-white/20 cursor-pointer transition-all duration-300" 
                >
                  <div
                    className="rounded-full p-5 flex items-center justify-center border border-white/20 bg-white/10"
                  >
                    <Check className="h-6 w-6 text-white" strokeWidth={3} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-2xl font-bold text-white">{value.title}</h3>
                    <p className="text-[#8E8E8E] text-xl mt-5">
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

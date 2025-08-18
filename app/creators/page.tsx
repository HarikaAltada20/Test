"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import NumbersSection from "@/components/NumberSection";
import {
  ArrowRight,
  Star,
  Users,
  Crown,
  Target,
  Trophy,
  Palette,
  Camera,
  Heart,
  Gift,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CtcBanner from "@/components/CtcBanner";
import Testimonials from "../../components/Testimonials";
import FAQ from "@/components/FAQ";
// Placeholder for social icons image - replace with actual path if different
import SocialPairPng from "@/public/images/social_pair.png";

// const creatorTestimonials = [
//   {
//     stars: 5,
//     quote:
//       "Finally, a platform that truly understands the creator economy. The opportunities are diverse, and the community is incredibly supportive.",
//     name: "Aisha Khan",
//     title: "Travel Vlogger & Influencer",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "As a new creator, Game Of Creators gave me the exposure I needed. I landed my first paid collaboration within a month of joining!",
//     name: "Chloe Dubois",
//     title: "Lifestyle Content Creator",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "The platform is intuitive, and the support team is always responsive. It made managing multiple brand deals so much simpler.",
//     name: "Kenji Tanaka",
//     title: "Gaming Streamer & YouTuber",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 4,
//     quote:
//       "Game Of Creators helped me turn my passion into a full-time income. The contest format pushes me to create my best work every time.",
//     name: "Marcus Rivera",
//     title: "Fitness Influencer & Coach",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "The quality of brands on this platform is incredible. I've worked with some amazing companies and built lasting relationships.",
//     name: "Sophie Williams",
//     title: "Beauty Content Creator",
//     avatar: "/images/avatar_placeholder.png",
//   },
//   {
//     stars: 5,
//     quote:
//       "From zero followers to 100K in 8 months thanks to the exposure from brand collaborations. This platform changed my life!",
//     name: "Alex Thompson",
//     title: "Tech Reviewer & YouTuber",
//     avatar: "/images/avatar_placeholder.png",
//   },
// ];
const creatorsteps = [
  {
    number: "1",
    title: "Create Your Creator Profile",
    description:
      "Sign up and build your profile showcasing your skills, previous work, and the platforms you create content for.",
    icon: <Users className="h-8 w-8" />,
    gradient: "from-violet-600 to-purple-600",
    color: "bg-[#7F39EC87] border-4 border-[#7F39EC]",
  },
  {
    number: "2",
    title: "Browse Available Contests",
    description:
      "Explore contests from brands looking for content creators. Filter by platform, deadline, and prize amount to find the perfect opportunity.",
    icon: <Target className="h-8 w-8" />,
    gradient: "from-blue-600 to-indigo-600",
    color: "bg-[#444DE787] border-4 border-[#454DE5]",
  },
  {
    number: "3",
    title: "Create & Submit Content",
    description:
      "Produce content according to the brand's brief and submit it through our platform to be considered for prizes and future opportunities.",
    icon: <Camera className="h-8 w-8" />,
    gradient: "from-amber-600 to-orange-600",
    color: "bg-[#E75D0D8F] border-4 border-[#E65D09]",
  },
  {
    number: "4",
    title: "Get Rewarded",
    description:
      "Win prizes based on your content's performance and quality. Build relationships with brands for ongoing collaborations.",
    icon: <Gift className="h-8 w-8" />,
    gradient: "from-emerald-600 to-teal-600",
    color: "bg-[#0C94825C] border-4 border-[#08947E]",
  },
];

const images: string[] = [
  "./images/Rectangle 2724.png",
  "./images/Property 1=Rectangle 2725.png",
  "./images/Property 1=Rectangle 2726.png",
];
export default function CreatorsPage() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fade, setFade] = useState<boolean>(true);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const animationRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const [howItWorksAnimated, setHowItWorksAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Section animation
            if (entry.target === sectionRef.current) {
              setAnimate(true);
              observerInstance.unobserve(entry.target);
            }

            // Animation block
            if (entry.target === animationRef.current) {
              setIsAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            // How it works section
            if (entry.target === howItWorksRef.current) {
              setHowItWorksAnimated(true);
              observerInstance.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.3 } // Use lower threshold to ensure all trigger
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    if (animationRef.current) observer.observe(animationRef.current);
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
      if (animationRef.current) observer.unobserve(animationRef.current);
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      // Immediately change image index and set fade true
      setCurrentIndex((prev) => (prev + 1) % images.length);
      setFade(true);
    }, 4000);

    return () => clearInterval(interval);
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
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[1250px] h-[600px] rounded-full blur-3xl opacity-50 pointer-events-none bg-orange-ellipse"></div>

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
                    src={SocialPairPng}
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
              className="text-4xl md:text-6xl lg:text-7xl mb-6 leading-tight slide-up"
              style={{ animationDelay: "1s" }}
            >
              <span
                className="font-semibold  text-white drop-shadow-2xl"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Turn Your Creativity Into
              </span>
              <span
                className="block font-semibold text-white drop-shadow-2xl"
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
                    Income
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl "></div>
                </span>
              </span>
            </h1>

            {/* Strategic Subtitle */}
            <p
              className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
              style={{ animationDelay: "2s" }}
            >
              Join Game Of Creators to find creative{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">
                opportunities
              </span>
              , collaborate with brands, and get paid for your{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                content
              </span>
            </p>

            {/* Epic CTA Button */}
            <div className="flex justify-center items-center mb-12">
              <Button className="rounded-3xl relative bg-gradient-to-r from-orange-500 to-orange-700 text-white text-white font-bold px-8 py-6 text-lg overflow-hidden">
                <div className="scan-line"></div>
                <Link
                  href="/auth/signup"
                  className="relative z-10 flex items-center gap-2"
                >
                  {/* Overlay gradient for animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-700 opacity-0"></div>

                  <Sparkles className="h-4 w-4" />
                  <span>Get Started</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Why Join as Creator - Gaming Style */}
        <section className="text-white py-16" ref={animationRef}>
          <div className="max-w-[1200px] mx-auto px-4 text-center">
            {/* Heading */}
            <h2
              className={`text-3xl md:text-5xl text-slate-300 max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{ animationDelay: "0.2s" }}
            >
              Why Join as a{" "}
              <span className="bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
                Creator
              </span>
            </h2>
            <p
              className={`text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-left" : "hide-before-animate"
              }`}
              style={{ animationDelay: "1s" }}
            >
              Unlock your creative potential and monetise your passion
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Earn Money",
                  description:
                    "Get paid for creating content for brands you love through contests and collaborations.",
                  number: "1",
                  image:
                    "./images/c89a26089c94c4806f6c5d35d5a13d7b9b4abe4d.png", // first card image
                },
                {
                  title: "Build Your Portfolio",
                  description:
                    "Create professional content for recognized brands to showcase in your portfolio.",
                  number: "2",
                  image:
                    "./images/6260ed20a17f3e1217628986a9525a3a5987b46f.png", // second card image
                },
                {
                  title: "Grow Your Audience",
                  description:
                    "Gain exposure when brands share and promote your content to their followers.",
                  number: "3",
                  image:
                    "./images/e8e9c22eb82571682f04cec79d2d2cb1276138fc.png", // third card image
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="cursor-pointer relative border border-gray-500 rounded-xl p-[40px] flex flex-col items-center text-center hover:shadow-lg transition overflow-hidden group"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      backgroundImage: `url(${item.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  ></div>

                  {/* Shade Overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b from-[#00000066] to-[#00000099]"></div>

                  <div
                    className="relative z-10 w-[50px] h-[50px] text-3xl flex items-center justify-center rounded-full text-white font-bold mb-4"
                    style={{
                      background:
                        "linear-gradient(180deg, #DC7308 0%, #FF652D 100%)",
                    }}
                  >
                    {item.number}
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 text-3xl mt-5 font-semibold mb-2">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-gray-300 mt-5 text-xl">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gaming How It Works */}
        <section className="py-16 px-4 text-white" ref={howItWorksRef}>
          <div className="container mx-auto max-w-[1250px]">
            <h2
              className={`text-center text-2xl md:text-4xl font-bold mb-[50px] ${
                howItWorksAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{ animationDelay: "0.1s" }}
            >
              How it works
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              {/* Steps */}
              <div className="space-y-[90px] relative z-10">
                {creatorsteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-6 relative">
                    {/* Circle */}
                    <div
                      className={`w-16 h-16 md:w-[90px] md:h-[90px] rounded-full flex items-center justify-center text-white font-bold text-lg md:text-2xl ${step.color} flex-shrink-0 relative z-10`}
                    >
                      {step.number}
                    </div>

                    {/* Dotted line - hidden on small screens */}
                    {index < creatorsteps.length - 1 && (
                      <div
                        className="absolute left-8 md:left-[45px] w-px border-l-2 border-dotted border-gray-500 z-0 hidden md:block"
                        style={{
                          top: "90px",
                          height:
                            index === 0
                              ? "150px"
                              : index === 1
                              ? "180px"
                              : index === 2
                              ? "180px"
                              : "40px",
                        }}
                      />
                    )}

                    <div>
                      {/* Icon box above title */}
                      <div className="mb-4 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center border border-white rounded-md">
                        <span className="text-white">{step.icon}</span>
                      </div>

                      <h3 className="font-bold text-xl md:text-3xl">
                        {step.title}
                      </h3>
                      <p className="mt-4 text-base md:text-lg text-gray-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Image */}
              <div className="relative w-full h-64 md:h-[900px] rounded-xl overflow-hidden">
                <Image
                  key={currentIndex}
                  src={images[currentIndex]}
                  alt={`Step Image ${currentIndex + 1}`}
                  layout="fill"
                  objectFit="cover"
                  className={`rounded-xl transition-opacity duration-500 ${
                    fade ? "opacity-100" : "opacity-0"
                  }`}
                  priority={true}
                />
              </div>
            </div>
          </div>
        </section>

        <NumbersSection
          items={[
            {
              numbers: [3000, 4000, 5000, 6000, 7000],
              label: "Creators on Platform",
            },
            {
              numbers: [100, 200, 300, 400, 500, 600],
              label: "Campaigns Delivered",
            },
            {
              numbers: [40, 50, 60, 70, 80],
              label: "Views Generated",
              suffix: "M",
            },
          ]}
        />

        {/* Epic Stats Section */}
        {/* <section className="py-20 md:py-32 relative">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { number: "3000+", label: "Creators on Platform", icon: <Users className="h-8 w-8" />, gradient: "from-violet-600 to-purple-600" },
                { number: "100+", label: "Campaigns Delivered", icon: <Rocket className="h-8 w-8" />, gradient: "from-blue-600 to-indigo-600" },
                { number: "80M+", label: "Views Generated", icon: <TrendingUp className="h-8 w-8" />, gradient: "from-amber-600 to-orange-600" },
              ].map((stat, index) => (
                <div key={index} className="group text-center">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-3xl blur-2xl opacity-20 transition-opacity duration-500 group-hover:opacity-40`}></div>
                    <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto mb-6`}>
                        {stat.icon}
                      </div>
                      <p className={`text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                        {stat.number}
                      </p>
                      <p className="text-xl text-slate-300 font-semibold">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}
        <Testimonials />
        {/* Gaming Testimonials Section */}
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                What Creators Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-amber-500 to-orange-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {creatorTestimonials.map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 to-orange-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-amber-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < testimonial.stars
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold mr-4">
                        {testimonial.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">
                          {testimonial.name}
                        </p>
                        <p className="text-sm text-slate-400">
                          {testimonial.title}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section> */}

        {/* Gaming FAQ Section */}
        <FAQ />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                  FAQ
                </h2>
                <p className="text-xl text-slate-300">
                  Here are some frequently asked questions
                </p>
              </div>

              <Accordion type="single" collapsible className="w-full space-y-4">
                {faqItems.map((item, index) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-0"
                  >
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-amber-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12">
                          {item.answer}
                        </div>
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section> */}

        {/* Epic Final CTA */}
        <CtcBanner />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-900/30 via-orange-900/30 to-yellow-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Sparkles className="h-16 w-16 text-amber-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  Creativity
                </span>
                ?
              </h2>

              <p className="text-xl text-slate-300 mb-12 leading-relaxed">
                Join thousands of creators and brands. Sign up today and unlock
                your potential!
              </p>

              <Button
                size="lg"
                className="group relative bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-600 hover:from-amber-500 hover:via-orange-500 hover:to-yellow-500 text-white font-bold px-10 py-5 rounded-2xl shadow-2xl shadow-amber-500/40 hover:shadow-amber-500/60 transition-all duration-300 hover:scale-110 border border-amber-400/30 text-lg overflow-hidden"
                asChild
              >
                <Link href="/auth/signup">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full transition-transform duration-700 group-hover:translate-x-full"></div>
                  <Sparkles className="mr-3 h-5 w-5" />
                  <span className="relative z-10">Join Game Of Creators</span>
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-2" />
                </Link>
              </Button>
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
}

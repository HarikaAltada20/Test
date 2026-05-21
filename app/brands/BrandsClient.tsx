"use client";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Heart,
  Palette,
  Star,
  Crown,
  Sparkles,
  Trophy,
  ArrowUpRight,
} from "lucide-react";
import CtcBanner from "@/components/CtcBanner";
import NumbersSection from "@/components/NumberSection";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
// Placeholder for social icons image - reuse from creators page
import SocialPair from "@/public/images/social_pair.avif";
import BrandGetStartedButton from "@/components/BrandGetStartedButton";

// const faqItemsBrands = [
//   {
//     id: "faq-brand-1",
//     question: "How do I create a contest for creators?",
//     answer:
//       "Our platform makes it easy. Simply define your campaign brief, set your prize pool, specify the type of content you're looking for (e.g., youtube videos, Instagram Reels), and launch. Creators in our network will then be able to see and participate in your contest.",
//   },
//   {
//     id: "faq-brand-2",
//     question: "How do I ensure content quality and brand alignment?",
//     answer:
//       "You provide a detailed brief outlining your brand guidelines, key messages, and content expectations. You can review submissions and provide feedback before selecting winners. Many brands also use contests to discover creators for longer-term collaborations.",
//   },
//   {
//     id: "faq-brand-3",
//     question: "What kind of results can I expect from creator contests?",
//     answer:
//       "Results vary, but brands typically receive a diverse range of authentic content pieces at a fraction of traditional production costs. This content can be used for social media, ads, and other marketing channels, often leading to increased engagement, brand awareness, and reach.",
//   },
//   {
//     id: "faq-brand-4",
//     question: "How are creators paid and how much does it cost?",
//     answer:
//       "You set the prize pool for your contest. Payments to winning creators are handled securely through our platform. Our pricing is transparent, typically involving a platform fee on top of the prize money you allocate for creators.",
//   },
// ];
const brandImages: string[] = [
  "/images/song-gpt.logo.avif",
  "/images/vows-streams-logo.avif",
  "/images/catch-phrase.avif",
  "/images/deepvid.avif",
  "/images/warner-music.avif",
  "/images/sony.avif",
  "/images/10k-projects.avif",
  "/images/ada.avif",
  "/images/artistpg.avif",
  "/images/capital-music.avif",
  "/images/create-music-group.avif",
  "/images/empire-distribution.avif",
];
interface BrandsClientProps {
  totalViews: number;
}

export default function BrandsClient({ totalViews }: BrandsClientProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [fade, setFade] = useState<boolean>(true);
  const [windowWidth, setWindowWidth] = useState<number>(0);

  const sectionRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const animationRef = useRef<HTMLDivElement>(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [servicesAnimated, setServicesAnimated] = useState(false);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const [howItWorksAnimated, setHowItWorksAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries, observerInstance) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === animationRef.current) {
              setIsAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === howItWorksRef.current) {
              setHowItWorksAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === servicesRef.current) {
              setServicesAnimated(true);
              observerInstance.unobserve(entry.target);
            }

            if (entry.target === sectionRef.current) {
              setAnimate(true);
              observerInstance.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.3 }, // Adjust if you want different triggers
    );

    if (animationRef.current) observer.observe(animationRef.current);
    if (howItWorksRef.current) observer.observe(howItWorksRef.current);
    if (servicesRef.current) observer.observe(servicesRef.current);
    if (sectionRef.current) observer.observe(sectionRef.current);

    return () => {
      if (animationRef.current) observer.unobserve(animationRef.current);
      if (howItWorksRef.current) observer.unobserve(howItWorksRef.current);
      if (servicesRef.current) observer.unobserve(servicesRef.current);
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  const servicesWeOffer = [
    {
      title: "CREATOR COLLABS",
      image: "/images/creator-collabs.avif",
      accent: "from-violet-500 to-purple-500",
    },
    {
      title: "MASS DISTRIBUTION",
      image: "/images/mass-distribution.avif",
      accent: "from-blue-500 to-cyan-400",
    },
    {
      title: "CONTENT CONSULTING",
      image: "/images/consultant.avif",
      accent: "from-emerald-500 to-lime-400",
    },
  ];

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // Immediately change image index and set fade true
  //     setCurrentIndex((prev) => (prev + 1) % images.length);
  //     setFade(true);
  //   }, 4000);

  //   return () => clearInterval(interval);
  // }, []);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-[#000825] text-white overflow-hidden">
      <div className="relative z-20">
        {/* Floating Gaming Elements */}
        <section className="pt-20 pb-20 relative overflow-hidden">
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

          <div className="container max-w-[1300px] mx-auto px-6 sm:px-10 lg:px-16 relative z-10">
            <div className="grid lg:grid-cols-2 gap-10 xl:gap-16 items-center">
              <div className="text-center lg:text-left">
                {/* Premium Badge */}
                <div className="inline-flex items-center gap-2.5 bg-[#FFFFFF0F] border border-[#FFFFFF1A] rounded-full px-4 py-2 sm:px-5 sm:py-2.5 mb-8 mx-auto lg:mx-0 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400"></span>
                  </span>
                  <span className="text-xs sm:text-base font-semibold text-white leading-tight">
                    <span className="text-purple-400">
                      {totalViews.toLocaleString("en-US")}+
                    </span>{" "}
                    views generated for brands
                  </span>
                </div>

                {/* Enhanced Social Icons */}
                <div className="flex justify-center lg:justify-start mb-8">
                  {/* <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 to-orange-600/20 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative">
                      <Image
                        src={SocialPair}
                        alt="Social Media Icons"
                        width={150}
                        height={40}
                        className="relative z-10"
                      />
                    </div>
                  </div> */}
                </div>

                {/* Massive Gaming Title */}
                <h1
                  className="
    text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl
    flex flex-wrap justify-center lg:justify-start gap-x-2 md:gap-x-3
    mb-6 leading-tight text-center lg:text-left slide-up
  "
                  style={{ animationDelay: "1s" }}
                >
                  <span
                    className="font-semibold text-white drop-shadow-2xl"
                    style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    Make your product
                  </span>

                  <span
                    className="font-semibold text-white drop-shadow-2xl whitespace-nowrap"
                    style={{ fontFamily: "Montserrat, sans-serif" }}
                  >
                    go{" "}
                    <span className="relative inline-block">
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
                        viral
                      </span>
                      <span className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 blur-3xl"></span>
                    </span>
                  </span>
                </h1>

                {/* Strategic Subtitle */}
                <p
                  className="text-base sm:text-lg md:text-2xl text-slate-300 max-w-3xl mx-auto lg:mx-0 mb-10 leading-relaxed drop-shadow-lg text-center lg:text-left slide-left"
                  style={{ animationDelay: "2s" }}
                >
                  Launch strategic{" "}
                  <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent font-semibold">
                    creator contests
                  </span>{" "}
                  and drive organic viral marketing with{" "}
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent font-semibold">
                    1000s of creators
                  </span>{" "}
                  producing content that scales your brand&apos;s reach.
                </p>

                {/* Call-to-Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center lg:justify-start items-center sm:items-start gap-4 mb-8">
                  <BrandGetStartedButton />

                  <Button
                    variant="outline"
                    className="w-auto rounded-3xl border-2 border-slate-400/40 text-slate-300 font-semibold px-8 py-6 text-lg hover:border-purple-400/50 hover:text-purple-400 transition-all duration-300 bg-transparent hover:bg-slate-800/20 hover:shadow-lg"
                    asChild
                  >
                    <a
                      href="https://www.youtube.com/watch?v=kV4dXlWR8sY"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Watch Demo
                    </a>
                  </Button>
                </div>

                {/* Social Proof */}
                <div className="flex justify-center lg:justify-start items-center text-base text-slate-300 mb-8">
                  <span className="font-medium">
                    Trusted by 1,000+ creators and brands
                  </span>
                </div>
              </div>

              <div className="flex justify-center items-center mt-2 lg:mt-0">
                <div className="relative w-full max-w-[320px] sm:max-w-[380px] md:max-w-[440px] lg:max-w-[520px] h-[320px] sm:h-[380px] md:h-[440px] lg:h-[520px]">
                  {/* <div className="absolute right-10 top-20 w-[280px] h-[280px] bg-[#1F88FF] rounded-[40%] blur-[2px] opacity-90"></div> */}

                  <div className="absolute left-2 sm:left-4 md:left-6 lg:left-8 top-2 sm:top-4 md:top-5 lg:top-6 w-[150px] h-[240px] sm:w-[180px] sm:h-[290px] md:w-[210px] md:h-[330px] lg:w-[240px] lg:h-[380px] rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] border-2 border-white/70 bg-slate-900/90 shadow-2xl -rotate-6 overflow-hidden">
                    <video
                      src="/videos/SnapInsta.to_AQN_SiDJU.mp4"
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  </div>

                  <div className="absolute right-2 sm:right-4 md:right-6 lg:right-8 top-16 sm:top-20 md:top-24 lg:top-28 w-[140px] h-[220px] sm:w-[165px] sm:h-[270px] md:w-[190px] md:h-[310px] lg:w-[220px] lg:h-[360px] rounded-[20px] sm:rounded-[24px] lg:rounded-[28px] border-2 border-white/70 bg-slate-900/90 shadow-2xl rotate-[8deg] overflow-hidden">
                    <video
                      src="/videos/SnapInsta.to_AQNTex61ndS.mp4"
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Infinite Scroll Images Section */}
        <section className="pb-12 overflow-hidden">
          <div className="overflow-hidden relative scroll-container-testimonials">
            <div className="flex justify-center items-center gap-6 animate-scroll-left">
              {[...brandImages, ...brandImages].map((image, index) => {
                const isLarge =
                  image === "/images/vows-streams-logo.avif" ||
                  image === "/images/song-gpt.logo.avif";
                const isCatchPhrase = image === "/images/catch-phrase.avif";
                const allImages = [...brandImages, ...brandImages];
                const nextImage =
                  index < allImages.length - 1 ? allImages[index + 1] : null;
                const isNextToLarge =
                  (isLarge || isCatchPhrase) &&
                  nextImage &&
                  (nextImage === "/images/vows-streams-logo.avif" ||
                    nextImage === "/images/song-gpt.logo.avif" ||
                    nextImage === "/images/catch-phrase.avif");
                return (
                  <div
                    key={index}
                    className={`flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${
                      isCatchPhrase
                        ? "w-[160px] h-[96px] md:w-[200px] md:h-[120px]"
                        : isLarge
                          ? "w-[180px] h-[108px] md:w-[240px] md:h-[190px]"
                          : "w-[120px] h-[72px] md:w-[150px] md:h-[90px]"
                    } ${isNextToLarge ? "-mr-4 md:-mr-8" : ""}`}
                  >
                    <Image
                      src={image}
                      alt={`Brand image ${index + 1}`}
                      width={isCatchPhrase ? 200 : isLarge ? 235 : 150}
                      height={isCatchPhrase ? 120 : isLarge ? 190 : 90}
                      className="w-full h-full object-contain"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-center items-center text-base text-slate-300 ">
            <span className="font-medium">Trusted by leading brands</span>
          </div>
        </section>

        {/* Why Brands Choose - Gaming Style */}
        <section className="text-white py-16" ref={animationRef}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-12 xl:px-4 text-center">
            {/* Heading */}

            <h1
              className={`text-2xl md:text-5xl text-slate-300 max-w-4xl mx-auto mb-6 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-up" : "hide-before-animate"
              }`}
            >
              <span className="text-white">Why Brands Choose </span>
              <span className="bg-gradient-to-r from-purple-500 to-purple-400 bg-clip-text text-transparent">
                Game
              </span>
              <span className="text-white"> of </span>
              <span className="bg-gradient-to-r from-orange-500 to-orange-300 bg-clip-text text-transparent">
                Creators
              </span>
            </h1>

            <p
              className={`text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg ${
                isAnimated ? "slide-left" : "hide-before-animate"
              }`}
              style={{ animationDelay: "1s" }}
            >
              Simple Steps to Launch your Influencer Marketing Campaign
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Content at Scale",
                  description:
                    "Generate dozens of unique content pieces for a fraction of the cost of traditional production.",
                  number: "1",
                  image:
                    "/images/64804a487ad8f0cf2e94705ec857e40cee3eae3f.avif",
                },
                {
                  title: "Authentic Creativity",
                  description:
                    "Tap into creator’s authentic voices and unique perspectives to connect with audiences.",
                  number: "2",
                  image:
                    "/images/b7d7011f7d816c367825ffaccca7846c99dbbfc7.avif",
                },
                {
                  title: "Performance Insights",
                  description:
                    "See exactly how your content performs and identify winners to scale through paid ads.",
                  number: "3",
                  image:
                    "/images/b4273c077c336d85dd75502201d73084ea5fba73.avif",
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
                        "linear-gradient(180deg, #7F39EC 0%, #4C238D 100%)",
                    }}
                  >
                    {item.number}
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 text-2xl md:text-3xl mt-5 font-semibold mb-2">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 text-gray-300 mt-5 text-lg md:text-xl">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* Services We Offer */}
        <section className="py-16 md:py-20" ref={servicesRef}>
          <div className="max-w-[1200px] mx-auto px-4 md:px-12 xl:px-4 text-center">
            {/* <p className="text-xs sm:text-sm tracking-[0.3em] text-slate-400 font-semibold mb-3">
              SERVICES
            </p> */}
            <h2
              className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${
                servicesAnimated ? "slide-up" : "hide-before-animate"
              }`}
            >
              <span className="text-white">The </span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Services
              </span>
              <span className="text-white"> We Offer</span>
            </h2>
            <p
              className={`text-slate-300 text-base sm:text-lg md:text-xl mb-10 ${
                servicesAnimated ? "slide-left" : "hide-before-animate"
              }`}
            >
              The tools to make your brand go viral.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {servicesWeOffer.map((service) => (
                <Link key={service.title} href="/get-started" className="block">
                  <article className="group relative rounded-[28px] border border-slate-700/80 bg-[#0B1234] p-4 sm:p-5 text-left overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-slate-500">
                    <div className="relative h-56 sm:h-64 md:h-72 w-full overflow-hidden rounded-2xl border border-slate-600/70">
                      <Image
                        src={service.image}
                        alt={service.title}
                        fill
                        className="h-full w-full object-cover bg-[#0A102D] p-4 transition-transform duration-500 group-hover:scale-105"
                        sizes="(min-width: 768px) 33vw, 100vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#00000099] via-transparent to-transparent" />
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-4">
                      <h3 className="text-xl sm:text-2xl font-extrabold leading-[1.05] tracking-tight text-white max-w-[12ch]">
                        {service.title}
                      </h3>

                      <span
                        className={`shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r ${service.accent} text-black transition-transform duration-300 group-hover:rotate-12`}
                      >
                        <ArrowUpRight size={20} strokeWidth={2.5} />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
        {/* Campaign Process Cards */}
        <section
          ref={howItWorksRef}
          className="py-12 sm:py-16 px-4 md:px-8 xl:px-4 text-white"
        >
          <div className="container mx-auto max-w-[1380px]">
            <h2
              className={`text-center text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-8 sm:mb-12 ${
                howItWorksAnimated ? "slide-up" : "hide-before-animate"
              }`}
              style={{ animationDelay: "0.1s" }}
            >
              How it Works
            </h2>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  id: "1",
                  title: "Create a Contest",
                  description:
                    "Set your brief, budget, duration, and payout model (Leaderboard or CPM or Milestone or Dual Rewards). Choose platforms like Instagram, YouTube, or Twitter (X).",
                  image: "/images/GoC How It Works - 1.png",
                  number: "1",
                },
                {
                  id: "2",
                  title: "Creators Publish Content",
                  description:
                    "Creators publish organic content on their own accounts, sharing videos on Instagram and YouTube and tweets on Twitter",
                  image: "/images/GoC How It Works - 2.png",
                  number: "2",
                },
                {
                  id: "3",
                  title: "Performance Is Tracked",
                  description:
                    "Performance is tracked automatically using platform APIs: views on Instagram and YouTube, and engagement points on Twitter based on likes, reposts, replies, and quotes.",
                  image: "/images/GoC How It Works - 3.png",
                  number: "3",
                },
                {
                  id: "4",
                  title: "Pay Only for Performance",
                  description:
                    "Leaderboard: Top creators get paid. CPM: Pay per 1K views (Instagram, YouTube, TikTok) or engagement points (Twitter). Milestone: Pay at view targets. Dual Rewards: CPM + milestones in one contest.",
                  image: "/images/GoC How It Works - 4.png",
                  number: "4",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-2xl border border-[#7F39EC]/70 bg-black/80 backdrop-blur-sm overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_26px_70px_rgba(76,35,141,0.6)] hover:border-[#7F39EC] hover:ring-2 hover:ring-[#7F39EC]/60"
                >
                  {/* subtle purple glow (stronger on hover) */}
                  <div className="pointer-events-none absolute inset-px rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_top,_rgba(127,57,236,0.32),_transparent_60%),radial-gradient(circle_at_bottom,_rgba(76,35,141,0.38),_transparent_55%)]" />

                  <div className="relative w-full h-full lg:h-64 bg-slate-900/10 overflow-hidden">
                    {/* light gradient only at bottom for text readability */}
                    <div className="pointer-events-none absolute inset-0" />
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full lg:object-contain xl:object-cover object-center group-hover:scale-[1.06] transition-transform duration-700 ease-out"
                      style={{
                        imageRendering: "auto",
                      }}
                    />
                  </div>

                  <div className="relative p-4 sm:p-5 lg:p-6 flex flex-col gap-3 sm:gap-4 flex-1">
                    {/* accent bar */}
                    <div className="h-0.5 w-10 rounded-full bg-gradient-to-r from-[#4C238D] via-[#7F39EC] to-fuchsia-400 mb-1 group-hover:w-16 transition-all duration-500" />

                    <h3 className="font-semibold text-sm sm:text-base lg:text-lg line-clamp-2 text-slate-50 group-hover:text-[#C4A3FF] transition-colors duration-300">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm lg:text-base text-slate-300/90 leading-relaxed line-clamp-4 sm:line-clamp-6 group-hover:text-slate-100 transition-colors">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* <NumbersSection
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
        /> */}

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
                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-3xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.gradient} bg-opacity-20 border border-violet-400/30 flex items-center justify-center text-violet-400 mx-auto mb-6`}>
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

        {/* Gaming Brand Testimonials Section */}
        <Testimonials />
        {/* <section className="py-20 md:py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-5xl font-black mb-6 text-white drop-shadow-xl">
                What Brands Say About Us
              </h2>
              <div className="w-20 h-1 bg-gradient-to-r from-violet-500 to-purple-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  stars: 5,
                  quote:
                    "Game Of Creators revolutionized our content strategy. We received over 50 unique content pieces in just two weeks, and our engagement rates went through the roof.",
                  name: "Sarah Johnson",
                  title: "Marketing Director, Fashion Brand",
                },
                {
                  stars: 5,
                  quote:
                    "Working with talented creators on this platform has been a breeze. The quality of content exceeded our expectations, and we saw a significant ROI.",
                  name: "Mike Chen",
                  title: "Founder, Tech Startup",
                },
                {
                  stars: 4,
                  quote:
                    "The contest feature is fantastic for discovering new talent. We've found some hidden gems who are now regular contributors to our brand.",
                  name: "David Miller",
                  title: "Head of Content, Food & Beverage Co.",
                },
                {
                  stars: 5,
                  quote:
                    "The platform's analytics helped us identify our best-performing content creators. We've scaled our campaigns 300% while reducing costs by 60%.",
                  name: "Emma Rodriguez",
                  title: "CMO, E-commerce Platform",
                },
                {
                  stars: 5,
                  quote:
                    "Game Of Creators delivered results beyond our expectations. The quality and authenticity of content from creators has transformed our brand presence.",
                  name: "James Wilson",
                  title: "Brand Manager, Consumer Goods",
                },
                {
                  stars: 4,
                  quote:
                    "Finally, a platform that understands both brand needs and creator capabilities. The collaboration process is seamless and results-driven.",
                  name: "Lisa Chen",
                  title: "Head of Digital Marketing, SaaS Company",
                },
              ].map((testimonial, index) => (
                <div key={index} className="group relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-purple-600/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"></div>

                  <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md p-8 rounded-2xl border border-slate-600/50 group-hover:border-violet-400/50 shadow-2xl transition-all duration-300 hover:scale-105 h-full flex flex-col">
                    <div className="flex mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-5 w-5 ${
                            i < testimonial.stars
                              ? "text-violet-400 fill-violet-400"
                              : "text-slate-600"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="italic text-slate-300 mb-6 flex-grow leading-relaxed">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center mt-auto">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold mr-4">
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
                {faqItemsBrands.map((item, index) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-0"
                  >
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/60 backdrop-blur-md rounded-2xl border border-slate-600/50 hover:border-violet-400/50 transition-all duration-300 overflow-hidden">
                      <AccordionTrigger className="text-left text-lg md:text-xl hover:no-underline px-8 py-6 text-white font-semibold">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {(index + 1).toString().padStart(2, "0")}
                          </span>
                          <span>{item.question}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-300 text-lg leading-relaxed px-8 pb-6">
                        <div className="pl-12">{item.answer}</div>
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
          <div className="absolute inset-0 bg-gradient-to-r from-violet-900/30 via-purple-900/30 to-indigo-900/30 backdrop-blur-sm"></div>

          <div className="relative container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-8">
                <Crown className="h-16 w-16 text-violet-400/60 mx-auto mb-6" />
              </div>

              <h2 className="text-4xl md:text-6xl font-black mb-8 text-white drop-shadow-2xl">
                Ready to Transform Your{" "}
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Content Strategy
                </span>
                ?
              </h2>

              <p className="text-xl text-slate-300 mb-12 leading-relaxed">
                Launch your first contest today and witness the power of
                creator-generated content.
              </p>

              <BrandLaunchContestButton />
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
}

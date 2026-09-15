"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

import {
  ArrowRight,
  ArrowLeft,
  Trophy,
  Users,
  Gamepad2,
  Headset,
  Sparkles,
  Crown,
  Globe,
  Rocket,
  Star,
  Palette,
  Heart,
  User,
  Users2,
  ShieldCheck,
} from "lucide-react";
import { useSwipeable } from "react-swipeable";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import CtcBanner from "./CtcBanner";
import NumbersSection from "./NumberSection";
const steps = [
  {
    step: 1,
    title: "Brands Create a Campaign",
    description:
      "Share your vision. Describe your product, set the rules, and offer a prize. Decide how you want creators to promote your brand or product.",
    image: "/images/da37f744f2ba86471c20ded62e5befaccbcabd69.avif",
    icon: <Trophy className="w-6 h-6 text-white" />,
  },
  {
    step: 2,
    title: "Open to Everyone",
    description:
      "Your follower count doesn't matter. Whether you have zero followers or millions, you can join any campaign that inspires you. Pick a challenge, showcase your talent, and stand out! ",

    image: "/images/4cb24974041cac85c7df83d9aaf0e54514c37f92.avif",
    icon: <Users className="w-6 h-6 text-white" />,
  },
  {
    step: 3,
    title: "Rewards & Results, Guaranteed",
    description:
      "A clear victory for both sides. Creators win cash prizes based on there performance and build their reputation. Brands get a library of high-impact, authentic content with full ownership and trackable results.",

    image: "/images/f4d15163b849dc0a3621c67aba3032911859d498.avif",
    icon: <Sparkles className="w-6 h-6 text-white" />,
  },
];
// const features = [
//   {
//     title: "Authentic Content",
//     description:
//       "Generate genuine, viral-worthy content that your audience will love and share.",
//     icon: "/images/authentic-icon.png", // replace with your icon
//   },
//   {
//     title: "Easy Management",
//     description:
//       "Manage all your campaigns from one intuitive, game-like dashboard interface.",
//     icon: "/images/calendar-icon.png",
//   },
//   {
//     title: "Real-Time Analytics",
//     description:
//       "Track every view, like, and conversion with our advanced analytics dashboard.",
//     icon: "/images/pie-icon.png",
//   },
//   {
//     title: "Cost Effective",
//     description:
//       "Get10x better ROI compared to traditional advertising. Every dollar counts!",
//     icon: "/images/cost-icon.png",
//   },
//   {
//     title: "Targeted Reach",
//     description:
//       "Connect with creators, whose audience perfectly match your ideal customers.",
//     icon: "/images/target-icon.png",
//   },
//   {
//     title: "Gaming Dashboard",
//     description: "Level up your campaigns with our intuitive interface.",
//     icon: "/images/game-icon.png",
//   },
//   {
//     title: "24/7 Support",
//     description: "Our gaming experts are always ready to help you win big!",
//     icon: "/images/support-icon.png",
//   },
// ];

export default function HeroContent() {
  const router = useRouter();
  const pathname = usePathname();
  const [heroNavPending, setHeroNavPending] = useState<
    "brand" | "creator" | null
  >(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [startNowLoading, setStartNowLoading] = useState(false);

  const [animate, setAnimate] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    router.prefetch("/brands");
    router.prefetch("/creators");
  }, [router]);

  useEffect(() => {
    if (
      heroNavPending &&
      (pathname === "/brands" || pathname === "/creators")
    ) {
      setHeroNavPending(null);
    }
  }, [pathname, heroNavPending]);

  useEffect(() => {
    const mq =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    if (!mq) return;
    setPrefersReducedMotion(mq.matches);
    const handler = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [worksVisible, setWorksVisible] = useState(false);
  // const [chooseVisible, setChooseVisible] = useState(false);
  const [reasonsVisible, setReasonsVisible] = useState(false);

  const worksRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  const reasonsRef = useRef<HTMLDivElement>(null);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? steps.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
  };

  // ✅ Auto infinite scroll every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev === steps.length - 1 ? 0 : prev + 1));
    }, 6000);

    return () => clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === worksRef.current) setWorksVisible(true);
            // if (entry.target === chooseRef.current) setChooseVisible(true);
            if (entry.target === reasonsRef.current) setReasonsVisible(true);
          }
        });
      },
      { threshold: 0.1 },
    );

    if (worksRef.current) observer.observe(worksRef.current);
    // if (chooseRef.current) observer.observe(chooseRef.current);
    if (reasonsRef.current) observer.observe(reasonsRef.current);

    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
        }
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);
  const handlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackTouch: true,
    trackMouse: false,
    touchEventOptions: { passive: false }, // 👈 replaces preventDefaultTouchmoveEvent
  });

  return (
    <div>
      {/* Hero */}
      <main className="relative min-h-screen overflow-hidden bg-[#000000] text-white">
        {/* =========================================================
          BACKGROUND
      ========================================================= */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-[15%] h-[750px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.035),transparent_68%)]" />
        </div>

        {/* =========================================================
          HERO
      ========================================================= */}
        <section className="relative z-20 mx-auto flex max-w-[1100px] flex-col items-center px-4 pt-8 text-center sm:px-6 sm:pt-10 md:pt-[45px]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 sm:mb-7 sm:px-4 sm:py-2 sm:text-sm">
            <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Pay for Performance
          </div>

          <h1
            className="max-w-[880px] text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[44px] md:text-[52px] lg:text-[58px]"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            Brands Get Results.
            <br />
            Creators Get Rewarded.
          </h1>

          <div className="mt-8 flex w-full max-w-[500px] flex-col gap-3 sm:mt-11 sm:flex-row sm:gap-4">
            <button
              type="button"
              id="brands"
              onClick={() => {
                setHeroNavPending("brand");
                router.push("/brands");
              }}
              disabled={heroNavPending === "brand"}
              className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-white/20 bg-gradient-to-b from-white/[0.10] to-white/[0.015] text-[14px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-white/[0.10] disabled:opacity-70 sm:h-[52px] sm:text-[15px]"
            >
              {heroNavPending === "brand" ? (
                <ButtonLoadingSpinner />
              ) : (
                <>
                  For Brands
                  <span className="ml-2 text-[18px]">→</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="creators"
              onClick={() => {
                setHeroNavPending("creator");
                router.push("/creators");
              }}
              disabled={heroNavPending === "creator"}
              className="flex h-12 flex-1 items-center justify-center rounded-[14px] border border-white/70 bg-[#f0e7f6] text-[14px] font-semibold text-[#29183a] shadow-[0_0_25px_rgba(235,220,255,0.08)] transition-all duration-200 hover:bg-white disabled:opacity-70 sm:h-[52px] sm:text-[15px]"
            >
              {heroNavPending === "creator" ? (
                <ButtonLoadingSpinner />
              ) : (
                <>
                  For Creators
                  <span className="ml-2 text-[18px]">→</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* =========================================================
          VISUAL / ORBIT AREA
      ========================================================= */}
        <section className="relative mx-auto mt-8 w-full max-w-[1400px] px-4 pb-12 sm:mt-10 sm:px-6 sm:pb-16 lg:mt-[55px] lg:h-[620px] lg:px-0 lg:pb-0">
          {/* =====================================================
            ANIMATED ORBIT
        ===================================================== */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <svg
              className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 opacity-70 sm:h-[700px] sm:w-[1100px] lg:h-[900px] lg:w-[1400px] lg:opacity-100"
              viewBox="0 0 1400 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {/* Orange gradient */}
                <linearGradient id="orangeOrbit" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#b56b17" stopOpacity="0" />

                  <stop offset="35%" stopColor="#c87817" stopOpacity="0.5" />

                  <stop offset="50%" stopColor="#e69a2d" stopOpacity="1" />

                  <stop offset="65%" stopColor="#b56b17" stopOpacity="0.35" />

                  <stop offset="100%" stopColor="#b56b17" stopOpacity="0" />
                </linearGradient>

                {/* Purple gradient */}
                <linearGradient id="purpleOrbit" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#72129a" stopOpacity="0" />

                  <stop offset="35%" stopColor="#8617ae" stopOpacity="0.5" />

                  <stop offset="50%" stopColor="#a526d1" stopOpacity="1" />

                  <stop offset="65%" stopColor="#72129a" stopOpacity="0.35" />

                  <stop offset="100%" stopColor="#72129a" stopOpacity="0" />
                </linearGradient>

                {/* Orange glow */}
                <filter
                  id="orangeGlow"
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />

                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Purple glow */}
                <filter
                  id="purpleGlow"
                  x="-100%"
                  y="-100%"
                  width="300%"
                  height="300%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />

                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Main orbit */}
              <ellipse
                cx="700"
                cy="450"
                rx="575"
                ry="395"
                stroke="white"
                strokeOpacity="0.035"
                strokeWidth="1"
              />

              {/* Inner orbit */}
              <ellipse
                cx="700"
                cy="450"
                rx="455"
                ry="315"
                stroke="white"
                strokeOpacity="0.025"
                strokeWidth="1"
              />

              {/* =================================================
                ORANGE MOVING ARC
            ================================================= */}
              <ellipse
                className="orbit-orange"
                cx="700"
                cy="450"
                rx="575"
                ry="395"
                stroke="url(#orangeOrbit)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="150 3450"
                filter="url(#orangeGlow)"
              />

              {/* =================================================
                PURPLE MOVING ARC
            ================================================= */}
              <ellipse
                className="orbit-purple"
                cx="700"
                cy="450"
                rx="575"
                ry="395"
                stroke="url(#purpleOrbit)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="150 3450"
                filter="url(#purpleGlow)"
              />
            </svg>
          </div>

          {/* =====================================================
            LEFT CAMPAIGN CARD
        ===================================================== */}
          <div className="absolute left-[2%] top-[35px] z-20 hidden w-[200px] rotate-[7deg] rounded-[23px] border border-white/[0.08] bg-[#1E1E1E] p-[15px] shadow-[inset_0_0_6.02px_0_#FFFFFF40] xl:left-[4%] xl:w-[220px] lg:block">
            {/* Card header */}
            <div className="flex items-center gap-2">
              <div className="flex h-[29px] w-[29px] items-center justify-center rounded-[8px] bg-[#40344c]">
                <Users className="h-[15px] w-[15px] text-white/80" />
              </div>

              <span className="text-[13px] text-white/75">Brand</span>
            </div>

            {/* Title */}
            <div className="mt-3 text-[15px] font-medium">
              Podcasts Clip Challenge
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-[7px]">
              <span className="rounded-full bg-[#2B1F3B] px-[9px] py-[5px] text-[12px] text-[#BB00FF]">
                Clipping
              </span>

              <span className="rounded-full bg-[#2B1F3B] px-[9px] py-[5px] text-[12px] text-[#BB00FF]">
                UGC
              </span>

              <span className="rounded-full bg-[#2B1F3B] px-[9px] py-[5px] text-[12px] text-[#BB00FF]">
                Beauty
              </span>
            </div>

            {/* Bottom */}
            <div className="mt-3 flex items-end justify-between">
              <img
                src="/images/e9ecc19156964f29ca20b5f8080671042162b486.png"
                alt="Creator"
                className="h-[72px] w-[72px] rounded-md object-cover"
              />

              <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#351149] text-[18px] text-[#c239f5]">
                →
              </div>
            </div>
          </div>

          {/* =====================================================
            LEFT TEXT
        ===================================================== */}
          <div className="absolute left-[6%] top-[340px] z-20 hidden rotate-[-4deg] font-['Comic_Sans_MS'] text-[17px] italic text-white/85 xl:left-[9%] lg:block">
            <div>Brands launch campaigns</div>

            <div className="ml-[75px] mt-1 text-[27px]">↘</div>
          </div>

          {/* =====================================================
            CENTER TEXT
        ===================================================== */}
          <div className="relative z-20 mx-auto mb-4 text-center font-['Comic_Sans_MS'] text-[14px] italic leading-[20px] text-white/85 sm:text-[16px] sm:leading-[22px] lg:absolute lg:left-1/2 lg:top-[5px] lg:mb-0 lg:-translate-x-1/2 lg:whitespace-nowrap lg:text-[17px] lg:leading-[24px]">
            Creator create content
            <br />
            that performs
          </div>

          {/* =====================================================
            CENTRAL CREATOR CARD
        ===================================================== */}
          <div className="relative z-20 mx-auto h-[380px] w-[min(100%,280px)] overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#191919] shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:h-[420px] sm:w-[300px] lg:absolute lg:left-1/2 lg:top-[105px] lg:mx-0 lg:h-[455px] lg:w-[335px] lg:-translate-x-1/2">
            {/* Video 1 */}
            <div className="relative h-1/3 overflow-hidden">
              <video
                src="/videos/SnapInsta.to_AQN_SiDJU.mp4"
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
              <span className="absolute bottom-3 left-3 text-[11px] text-white/70">
                creator
              </span>
            </div>

            {/* Video 2 */}
            <div className="relative h-1/3 overflow-hidden">
              <video
                src="/videos/SnapInsta.to_AQNTex61ndS.mp4"
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>

            {/* Video 3 */}
            <div className="relative h-1/3 overflow-hidden">
              <video
                src="/videos/SnapInsta.to_AQNxeCNjx2k.mp4"
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            </div>
          </div>

          {/* =====================================================
            RIGHT ANALYTICS CARD
        ===================================================== */}
          <div className="absolute right-[2%] top-[130px] z-20 hidden w-[240px] rotate-[-15deg] rounded-[22px] border border-white/[0.08] bg-[#1E1E1E] p-4 shadow-[inset_0_0_6.02px_0_#FFFFFF40] xl:right-[4%] xl:w-[280px] lg:block">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-white/35">
              <span className="rounded-[9px] bg-white/[0.08] px-3 py-[9px] text-white/80">
                Overview
              </span>

              <span className="px-2">Submissions</span>

              <span className="px-2">Analytics</span>
            </div>

            {/* Stats */}
            <div className="mt-7 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[25px] font-medium tracking-[-1px] text-white">
                    46.2M
                  </span>
                  <span className="text-[10px] text-white/50">Views</span>
                </div>

                <div className="mt-3 max-w-[120px] text-[12px] leading-[15px] text-white/35">
                  Your top 10% creators are getting the most views
                </div>
              </div>

              {/* Chart */}
              <div className="flex items-end gap-[8px] pb-0.5">
                {[
                  { label: "April", height: "h-[42px]", active: false },
                  { label: "May", height: "h-[28px]", active: false },
                  { label: "June", height: "h-[36px]", active: false },
                  { label: "July", height: "h-[54px]", active: true },
                ].map((bar) => (
                  <div
                    key={bar.label}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`w-[14px] rounded-t-[4px] ${bar.height} ${
                        bar.active
                          ? "bg-[#3B82F6]"
                          : "bg-gradient-to-b from-[#5a5a5a] to-[#2e2e2e]"
                      }`}
                    />
                    <span className="origin-top text-[10px] text-white/35">
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* =====================================================
            RIGHT TEXT
        ===================================================== */}
          <div className="absolute right-[6%] top-[25px] z-20 hidden rotate-[3deg] text-center font-['Comic_Sans_MS'] text-[17px] italic leading-[24px] text-white/85 xl:right-[10%] lg:block">
            Performance drives
            <br />
            real results
            <div className="mt-1 text-[27px]">↙</div>
          </div>
        </section>

        {/* =========================================================
          CONTACT ANCHOR
      ========================================================= */}
        <div id="contact" className="absolute bottom-0 left-0" />

        {/* =========================================================
          ANIMATION STYLES
      ========================================================= */}
        <style jsx>{`
          .orbit-orange {
            transform-box: fill-box;
            transform-origin: center;
            animation: orbitOrange 12s linear infinite;
          }

          .orbit-purple {
            transform-box: fill-box;
            transform-origin: center;
            animation: orbitPurple 12s linear infinite;
          }

          @keyframes orbitOrange {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @keyframes orbitPurple {
            from {
              transform: rotate(180deg);
            }

            to {
              transform: rotate(540deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .orbit-orange,
            .orbit-purple {
              animation: none;
            }
          }
        `}</style>
      </main>

      <main className="min-h-screen bg-black px-4 py-16 text-white sm:px-5 sm:py-20 md:py-24">
        <section className="mx-auto max-w-[1200px]">
          {/* =====================================================
            HEADING
        ===================================================== */}
          <h1 className="mx-auto max-w-[650px] text-center text-[32px] font-semibold leading-[1.08] tracking-[-1.5px] text-white sm:text-[40px] sm:tracking-[-2px] md:text-[52px] md:tracking-[-2.5px]">
            Both sides work together
            <br />
            as one System
          </h1>

          {/* =====================================================
            CARDS
        ===================================================== */}
          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 md:mt-[72px] lg:grid-cols-2">
            {/* =================================================
              BRANDS CARD
          ================================================= */}
            <div className="relative min-h-[480px] overflow-hidden rounded-[20px] border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] px-5 pt-7 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:min-h-[520px] sm:rounded-[25px] sm:px-9 sm:pt-9 md:h-[545px] md:min-h-0">
              {/* Badge */}
              <div className="inline-flex rounded-full border border-white/[0.08] bg-[#353535] px-3 py-[6px] text-[13px] text-white/65">
                For Brands
              </div>

              {/* Title */}
              <h2 className="mt-5 max-w-[440px] text-[20px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]">
                Pay for actual performance, not
                <br className="hidden sm:block" />
                {" "}followers
              </h2>

              {/* Description */}
              <p className="mt-3 max-w-[500px] text-[14px] leading-[21px] text-white/45 sm:text-[16px] sm:leading-[23px]">
                Set your budget and brief. Your campaign runs across a network
                <br className="hidden xl:block" />
                of 15,700+ creators, and you pay for verified content and
                <br className="hidden xl:block" />
                performance.
              </p>

              {/* ================================================
                FORM MOCKUP
            ================================================= */}
              <div className="absolute left-4 right-4 top-[260px] h-[390px] overflow-hidden rounded-t-[18px] border border-white/[0.10] bg-[#121212] shadow-[0_-10px_40px_rgba(0,0,0,.15)] sm:left-[40px] sm:right-[40px] sm:top-[280px] md:left-[68px] md:right-[68px]">
                {/* Form header */}
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#292929] text-[10px]">
                      1
                    </span>

                    <span className="text-[14px] font-medium">Details</span>
                  </div>

                  <button className="rounded-md border border-[#8f4f9e]/30 bg-[#3b263e] px-3 py-1 text-[13px] text-white">
                    🚀 Launch
                  </button>
                </div>

                {/* Form */}
                <div className="mt-5 px-4">
                  {/* Campaign title */}
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-white/75">
                      Campaign title
                      <span className="text-red-400"> *</span>
                    </label>

                    <span className="text-[9px] text-white/35">0/100</span>
                  </div>

                  <div className="mt-1 h-[30px] rounded-md border border-white/[0.06] bg-[#292929] px-3 py-2 text-[9px] text-white/25">
                    e.g., Create a Viral shorts/video for our New App
                  </div>

                  {/* Platform + Content type */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/75">
                        Platform
                        <span className="text-red-400"> *</span>
                      </label>

                      <div className="mt-1 flex h-[30px] items-center justify-between rounded-md border border-white/[0.06] bg-[#292929] px-3 text-[10px] text-white/25">
                        <span>Select platform</span>
                        <span>⌄</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-white/75">
                        Content Type
                        <span className="text-white/40"> (optional)</span>
                      </label>

                      <div className="mt-1 flex h-[30px] items-center justify-between rounded-md border border-white/[0.06] bg-[#292929] px-3 text-[10px] text-white/25">
                        <span>Select content type</span>
                        <span>⌄</span>
                      </div>
                    </div>
                  </div>

                  {/* Upload */}
                  <div className="mt-4 flex h-[115px] items-center justify-center rounded-md border border-dashed border-white/[0.08] bg-[#242424]">
                    <div className="text-center">
                      <div className="text-[20px] text-white/30">⇧</div>

                      <div className="mt-1 text-[10px] text-white/45">
                        Drag, drop or <span className="underline">browse</span>{" "}
                        thumbnail
                      </div>

                      <div className="mt-1 text-[8px] text-white/25">
                        Max file size: 5MB
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================================================
                FLOATING BUDGET
            ================================================= */}
              <div className="absolute bottom-[34px] left-[29px] z-10 w-[176px] rounded-[15px] border border-white/[0.12] bg-[#1b1b1b] p-3 shadow-[0_15px_35px_rgba(0,0,0,.45)]">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <span className="text-[15px]">▣</span>
                  Budget
                </div>

                <div className="mt-3 h-[27px] rounded-md border border-white/[0.07] bg-[#292929] px-3 py-1.5 text-[12px] text-white/30">
                  $ 24000
                </div>
              </div>
            </div>

            {/* =================================================
              CREATORS CARD
          ================================================= */}
            <div className="relative min-h-[480px] overflow-hidden rounded-[20px] border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] px-5 pt-7 shadow-[inset_0_1px_0_rgba(255,255,255,.025)] sm:min-h-[520px] sm:rounded-[25px] sm:px-9 sm:pt-9 md:h-[545px] md:min-h-0">
              {/* Badge */}
              <div className="inline-flex rounded-full border border-white/[0.08] bg-[#353535] px-3 py-[6px] text-[13px] text-white/65">
                For Creators
              </div>

              {/* Title */}
              <h2 className="mt-5 max-w-[450px] text-[20px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]">
                Get paid for performance, not
                <br className="hidden sm:block" />
                {" "}followers.
              </h2>

              {/* Description */}
              <p className="mt-3 max-w-[510px] text-[14px] leading-[21px] text-white/45 sm:text-[16px] sm:leading-[23px]">
                Pick brand campaigns you want. You get paid based on how well
                <br className="hidden xl:block" />
                your posts do even if you have 0 followers
              </p>

              {/* =================================================
                PAYMENT POPUP - LEFT
            ================================================= */}
              <div className="absolute left-3 top-[230px] z-30 flex w-[min(200px,48%)] items-center justify-between rounded-[30px] border border-white/[0.08] bg-[#191919] px-2 py-2 shadow-[0_12px_35px_rgba(0,0,0,.45)] sm:left-[25px] sm:top-[258px] sm:w-[225px] sm:px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative h-[31px] w-[31px] shrink-0 overflow-hidden rounded-full">
                    <Image
                      src="/images/Ellipse 2355 (1).avif"
                      alt=""
                      fill
                      className="object-cover"
                      sizes="31px"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium">Hey Ashok</div>

                    <div className="text-[8px] leading-[10px] text-white/35">
                      You can withdraw your
                      <br />
                      money now
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[11px] font-medium text-[#43df3d]">
                  $44,090
                </span>
              </div>

              {/* =================================================
                PAYMENT POPUP - RIGHT
            ================================================= */}
              <div className="absolute right-3 top-[230px] z-30 flex w-[min(200px,48%)] items-center justify-between rounded-[30px] border border-white/[0.08] bg-[#191919] px-2 py-2 shadow-[0_12px_35px_rgba(0,0,0,.45)] sm:right-[25px] sm:top-[258px] sm:w-[220px] sm:px-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative h-[31px] w-[31px] shrink-0 overflow-hidden rounded-full">
                    <Image
                      src="/images/Ellipse 2355 (3).avif"
                      alt=""
                      fill
                      className="object-cover"
                      sizes="31px"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium">Hey Riya!</div>

                    <div className="text-[8px] leading-[10px] text-white/35">
                      Your rank 1st in Leader board
                      <br />
                      Campaign
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[11px] font-medium text-[#43df3d]">
                  $490
                </span>
              </div>

              {/* =================================================
                CREATOR CONTENT GRID
            ================================================= */}
              <div className="absolute bottom-0 left-0 right-0 h-[245px] overflow-hidden">
                <div className="absolute inset-0 flex flex-col gap-[2px]">
                  <div className="relative min-h-0 flex-[135]">
                    <Image
                      src="/images/Frame 2147243801.png"
                      alt=""
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 1024px) 90vw, 560px"
                    />
                  </div>
                  <div className="relative min-h-0 flex-[115]">
                    <Image
                      src="/images/Frame 2147243800.png"
                      alt=""
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 1024px) 90vw, 560px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Reasons to Select Us */}

       <section className="flex min-h-[50vh] items-center justify-center bg-black px-4 py-16 sm:min-h-[60vh] sm:px-6 sm:py-20 md:min-h-screen">
      <div className="flex w-full max-w-5xl flex-col items-center justify-center gap-12 sm:gap-16 md:flex-row md:gap-40">
        {/* Creators Network */}
        <div className="text-center">
          <h2
            className="
              text-[64px]
              sm:text-[76px]
              md:text-[92px]
              lg:text-[112px]
              leading-none
              font-extrabold
              tracking-[-0.055em]
              bg-gradient-to-b
              from-white
              via-[#d8d8d8]
              to-[#777777]
              bg-clip-text
              text-transparent
            "
          >
            16,700+
          </h2>

          <p
            className="
              mt-5
              text-[22px]
              sm:text-[25px]
              md:text-[29px]
              font-semibold
              tracking-[-0.02em]
              text-[#969696]
            "
          >
            Creators Network
          </p>
        </div>

        {/* Views Generated */}
        <div className="text-center">
          <h2
            className="
              text-[64px]
              sm:text-[76px]
              md:text-[92px]
              lg:text-[112px]
              leading-none
              font-extrabold
              tracking-[-0.055em]
              bg-gradient-to-b
              from-white
              via-[#d8d8d8]
              to-[#777777]
              bg-clip-text
              text-transparent
            "
          >
            160M+
          </h2>

          <p
            className="
              mt-5
              text-[22px]
              sm:text-[25px]
              md:text-[29px]
              font-semibold
              tracking-[-0.02em]
              text-[#969696]
            "
          >
            Views Generated
          </p>
        </div>
      </div>
    </section>
      {/* <NumbersSection
          items={[
            {
              numbers: [100, 200, 300, 400, 500],
              label: "Active Creators",
            },
            {
              numbers: ["$0.5", "$1.5", "$2.5", "$3.5", "$4.5", "$5.5"],
              label: "Rewards Paid",
              suffix: "M",
            },
            {
              numbers: ["$60", "$70", "$80", "$90", "$100"],
              label: "View Generated",
              suffix: "M",
            },
          ]}
        /> */}
    </div>
  );
}

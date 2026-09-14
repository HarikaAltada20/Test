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
        <section className="relative z-20 mx-auto flex max-w-[1100px] flex-col items-center px-6 pt-[45px] text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">
            <ShieldCheck className="h-4 w-4" />
            Pay for Performance
          </div>

          <h1
            className="max-w-[880px] text-[40px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[52px] md:text-[58px]"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            Brands Get Results.
            <br />
            Creators Get Rewarded.
          </h1>

          <div className="mt-11 flex w-full max-w-[500px] gap-4">
            <button
              type="button"
              id="brands"
              onClick={() => {
                setHeroNavPending("brand");
                router.push("/brands");
              }}
              disabled={heroNavPending === "brand"}
              className="flex h-[52px] flex-1 items-center justify-center rounded-[14px] border border-white/20 bg-gradient-to-b from-white/[0.10] to-white/[0.015] text-[15px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 hover:bg-white/[0.10] disabled:opacity-70"
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
              className="flex h-[52px] flex-1 items-center justify-center rounded-[14px] border border-white/70 bg-[#f0e7f6] text-[15px] font-semibold text-[#29183a] shadow-[0_0_25px_rgba(235,220,255,0.08)] transition-all duration-200 hover:bg-white disabled:opacity-70"
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
        <section className="relative mx-auto mt-[55px] h-[620px] w-full max-w-[1400px]">
          {/* =====================================================
            ANIMATED ORBIT
        ===================================================== */}
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <svg
              className="absolute left-1/2 top-[0px] h-[900px] w-[1400px] -translate-x-1/2"
              viewBox="0 0 1400 900"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
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
          <div className="absolute left-[4%] top-[35px] z-20 hidden w-[220px] rotate-[7deg] rounded-[23px] border border-white/[0.08] bg-[#1d1d1e] p-[15px] shadow-[0_25px_70px_rgba(0,0,0,0.45)] lg:block">
            {/* Card header */}
            <div className="flex items-center gap-2">
              <div className="flex h-[29px] w-[29px] items-center justify-center rounded-[8px] bg-[#40344c] text-[13px]">
                👥
              </div>

              <span className="text-[13px] text-white/75">Brand</span>
            </div>

            {/* Title */}
            <div className="mt-3 text-[15px] font-medium">
              Podcasts Clip Challenge
            </div>

            {/* Tags */}
            <div className="mt-3 flex gap-[7px]">
              <span className="rounded-full bg-[#510078] px-[9px] py-[5px] text-[10px] text-[#d838ff]">
                Clipping
              </span>

              <span className="rounded-full bg-[#510078] px-[9px] py-[5px] text-[10px] text-[#d838ff]">
                UGC
              </span>

              <span className="rounded-full bg-[#510078] px-[9px] py-[5px] text-[10px] text-[#d838ff]">
                Beauty
              </span>
            </div>

            {/* Bottom */}
            <div className="mt-3 flex items-end justify-between">
              <div className="flex h-[62px] w-[70px] items-center justify-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#ef8122] via-[#f44352] to-[#7d21bd]">
                <span className="text-[25px]">🎙️</span>
              </div>

              <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-[#351149] text-[18px] text-[#c239f5]">
                →
              </div>
            </div>
          </div>

          {/* =====================================================
            LEFT TEXT
        ===================================================== */}
          <div className="absolute left-[9%] top-[340px] z-20 hidden rotate-[-4deg] font-['Comic_Sans_MS'] text-[17px] italic text-white/85 lg:block">
            <div>Brands launch campaigns</div>

            <div className="ml-[75px] mt-1 text-[27px]">↘</div>
          </div>

          {/* =====================================================
            CENTER TEXT
        ===================================================== */}
          <div className="absolute left-1/2 top-[5px] z-20 -translate-x-1/2 whitespace-nowrap text-center font-['Comic_Sans_MS'] text-[17px] italic leading-[24px] text-white/85">
            Creator create content
            <br />
            that performs
          </div>

          {/* =====================================================
            CENTRAL CREATOR CARD
        ===================================================== */}
          <div className="absolute left-1/2 top-[105px] z-20 h-[455px] w-[335px] -translate-x-1/2 overflow-hidden rounded-[24px] border border-white/[0.10] bg-[#191919] shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
            {/* Video 1 */}
            <div className="relative h-1/3 overflow-hidden bg-gradient-to-br from-[#d9d9d0] via-[#b8aa96] to-[#65584b]">
              {/* Background */}
              <div className="absolute right-[12%] top-[5%] h-[80px] w-[75px] rounded-full bg-[#eee8d9]/30 blur-[2px]" />

              <div className="absolute left-[7%] top-[12%] h-[80px] w-[42px] rounded-full bg-[#5f6b60]" />

              {/* Person */}
              <div className="absolute bottom-[18%] left-1/2 h-[45px] w-[45px] -translate-x-1/2 rounded-full bg-[#bd896c]" />

              <div className="absolute bottom-[-5%] left-1/2 h-[125px] w-[105px] -translate-x-1/2 rounded-t-[50px] bg-[#171717]" />

              {/* Desk */}
              <div className="absolute bottom-0 left-0 right-0 h-[25px] bg-[#694c39]" />

              <span className="absolute bottom-3 left-3 text-[11px] text-white/70">
                creator
              </span>
            </div>

            {/* Video 2 */}
            <div className="relative h-1/3 overflow-hidden bg-gradient-to-br from-[#a96f50] via-[#654235] to-[#27201e]">
              {/* Background light */}
              <div className="absolute right-[12%] top-[10%] h-[100px] w-[80px] rounded-full bg-[#2c201b]" />

              {/* Woman */}
              <div className="absolute bottom-[35%] left-[50%] h-[52px] w-[52px] -translate-x-1/2 rounded-full bg-[#c77f61]" />

              <div className="absolute bottom-[-8%] left-[38%] h-[125px] w-[100px] rounded-t-[45px] bg-[#242424]" />

              {/* Mic */}
              <div className="absolute bottom-[20%] right-[20%] h-[55px] w-[7px] rotate-[15deg] bg-[#222]" />

              <div className="absolute bottom-[48%] right-[14%] h-[17px] w-[17px] rounded-full bg-[#151515]" />
            </div>

            {/* Video 3 */}
            <div className="relative h-1/3 overflow-hidden bg-gradient-to-br from-[#3e5a56] via-[#574842] to-[#16191a]">
              {/* Background */}
              <div className="absolute left-[8%] top-[10%] h-[85px] w-[45px] bg-[#263431]" />

              <div className="absolute right-[10%] top-[12%] h-[90px] w-[55px] bg-[#1b1c1c]" />

              {/* Person */}
              <div className="absolute bottom-[33%] left-[51%] h-[49px] w-[49px] -translate-x-1/2 rounded-full bg-[#a87862]" />

              <div className="absolute bottom-[-10%] left-[37%] h-[115px] w-[105px] rounded-t-[45px] bg-[#222628]" />

              {/* Light */}
              <div className="absolute bottom-[12%] right-[12%] h-[26px] w-[26px] rounded-full bg-white/[0.08]" />
            </div>
          </div>

          {/* =====================================================
            RIGHT ANALYTICS CARD
        ===================================================== */}
          <div className="absolute right-[4%] top-[130px] z-20 hidden w-[270px] rotate-[-15deg] rounded-[22px] border border-white/[0.08] bg-[#202021] p-4 shadow-[0_25px_70px_rgba(0,0,0,0.55)] lg:block">
            {/* Tabs */}
            <div className="flex items-center gap-1 text-[11px] text-white/35">
              <span className="rounded-[9px] bg-white/[0.08] px-3 py-[9px] text-white/80">
                Overview
              </span>

              <span className="px-2">Submissions</span>

              <span className="px-2">Analytics</span>
            </div>

            {/* Stats */}
            <div className="mt-7 flex items-end justify-between">
              <div>
                <div className="text-[25px] font-medium tracking-[-1px]">
                  46.2M
                </div>

                <div className="mt-1 text-[10px] text-white/35">Views</div>
              </div>

              {/* Chart */}
              <div className="flex h-[65px] items-end gap-[7px]">
                <div className="h-[20px] w-[13px] rounded-t-[3px] bg-white/20" />
                <div className="h-[29px] w-[13px] rounded-t-[3px] bg-white/20" />
                <div className="h-[39px] w-[13px] rounded-t-[3px] bg-white/20" />
                <div className="h-[51px] w-[13px] rounded-t-[3px] bg-white/20" />
                <div className="h-[62px] w-[13px] rounded-t-[3px] bg-white/20" />
              </div>
            </div>

            <div className="mt-4 text-[10px] leading-[15px] text-white/30">
              Your top 10% creators are
              <br />
              getting the most views
            </div>
          </div>

          {/* =====================================================
            RIGHT TEXT
        ===================================================== */}
          <div className="absolute right-[10%] top-[25px] z-20 hidden rotate-[3deg] text-center font-['Comic_Sans_MS'] text-[17px] italic leading-[24px] text-white/85 lg:block">
            Performance drives
            <br />
            real results
            <div className="mt-1 text-[27px]">↙</div>
          </div>
        </section>

        {/* =========================================================
          MOBILE VISUAL SIMPLIFICATION
      ========================================================= */}
        <div className="relative z-30 mx-auto -mt-[70px] flex max-w-[400px] justify-center px-6 pb-16 lg:hidden">
          <div className="relative h-[390px] w-[280px] overflow-hidden rounded-[24px] border border-white/10 bg-[#191919] shadow-[0_30px_80px_rgba(0,0,0,.6)]">
            <div className="relative h-1/3 bg-gradient-to-br from-[#d8d7ce] to-[#675b50]">
              <div className="absolute bottom-[15%] left-1/2 h-[45px] w-[45px] -translate-x-1/2 rounded-full bg-[#bd896c]" />
              <div className="absolute bottom-0 left-1/2 h-[110px] w-[100px] -translate-x-1/2 rounded-t-[45px] bg-[#171717]" />
            </div>

            <div className="relative h-1/3 bg-gradient-to-br from-[#a96f50] to-[#29201d]">
              <div className="absolute bottom-[25%] left-1/2 h-[48px] w-[48px] -translate-x-1/2 rounded-full bg-[#c77f61]" />
              <div className="absolute bottom-0 left-1/2 h-[110px] w-[100px] -translate-x-1/2 rounded-t-[45px] bg-[#242424]" />
            </div>

            <div className="relative h-1/3 bg-gradient-to-br from-[#3e5a56] to-[#181a1a]">
              <div className="absolute bottom-[25%] left-1/2 h-[48px] w-[48px] -translate-x-1/2 rounded-full bg-[#a87862]" />
              <div className="absolute bottom-0 left-1/2 h-[105px] w-[100px] -translate-x-1/2 rounded-t-[45px] bg-[#222628]" />
            </div>
          </div>
        </div>

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

      <main className="min-h-screen bg-black px-5 py-24 text-white">
        <section className="mx-auto max-w-[1200px]">
          {/* =====================================================
            HEADING
        ===================================================== */}
          <h1 className="mx-auto max-w-[650px] text-center text-[48px] font-semibold leading-[1.03] tracking-[-2.5px] text-white md:text-[52px]">
            Both sides work together
            <br />
            as one System
          </h1>

          {/* =====================================================
            CARDS
        ===================================================== */}
          <div className="mt-[72px] grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* =================================================
              BRANDS CARD
          ================================================= */}
            <div className="relative h-[545px] overflow-hidden rounded-[25px] border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] px-9 pt-9 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
              {/* Badge */}
              <div className="inline-flex rounded-full border border-white/[0.08] bg-[#353535] px-3 py-[6px] text-[13px] text-white/65">
                For Brands
              </div>

              {/* Title */}
              <h2 className="mt-5 max-w-[440px] text-[25px] font-medium leading-[1.25] tracking-[-0.8px]">
                Pay for actual performance, not
                <br />
                followers
              </h2>

              {/* Description */}
              <p className="mt-3 max-w-[500px] text-[16px] leading-[23px] text-white/45">
                Set your budget and brief. Your campaign runs across a network
                <br className="hidden xl:block" />
                of 15,700+ creators, and you pay for verified content and
                <br className="hidden xl:block" />
                performance.
              </p>

              {/* ================================================
                FORM MOCKUP
            ================================================= */}
              <div className="absolute left-[68px] right-[68px] top-[280px] h-[390px] overflow-hidden rounded-t-[18px] border border-white/[0.10] bg-[#121212] shadow-[0_-10px_40px_rgba(0,0,0,.15)]">
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
            <div className="relative h-[545px] overflow-hidden rounded-[25px] border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] px-9 pt-9 shadow-[inset_0_1px_0_rgba(255,255,255,.025)]">
              {/* Badge */}
              <div className="inline-flex rounded-full border border-white/[0.08] bg-[#353535] px-3 py-[6px] text-[13px] text-white/65">
                For Creators
              </div>

              {/* Title */}
              <h2 className="mt-5 max-w-[450px] text-[25px] font-medium leading-[1.25] tracking-[-0.8px]">
                Get paid for performance, not
                <br />
                followers.
              </h2>

              {/* Description */}
              <p className="mt-3 max-w-[510px] text-[16px] leading-[23px] text-white/45">
                Pick brand campaigns you want. You get paid based on how well
                <br className="hidden xl:block" />
                your posts do even if you have 0 followers
              </p>

              {/* =================================================
                PAYMENT POPUP - LEFT
            ================================================= */}
              <div className="absolute left-[25px] top-[258px] z-30 flex w-[225px] items-center justify-between rounded-[30px] border border-white/[0.08] bg-[#191919] px-3 py-2 shadow-[0_12px_35px_rgba(0,0,0,.45)]">
                <div className="flex items-center gap-2">
                  <div className="relative h-[31px] w-[31px] overflow-hidden rounded-full">
                    <Image
                      src="/images/Ellipse 2355 (1).avif"
                      alt=""
                      fill
                      className="object-cover"
                      sizes="31px"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-medium">Hey Ashok</div>

                    <div className="text-[8px] leading-[10px] text-white/35">
                      You can withdraw your
                      <br />
                      money now
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-medium text-[#43df3d]">
                  $44,090
                </span>
              </div>

              {/* =================================================
                PAYMENT POPUP - RIGHT
            ================================================= */}
              <div className="absolute right-[25px] top-[258px] z-30 flex w-[220px] items-center justify-between rounded-[30px] border border-white/[0.08] bg-[#191919] px-3 py-2 shadow-[0_12px_35px_rgba(0,0,0,.45)]">
                <div className="flex items-center gap-2">
                  <div className="relative h-[31px] w-[31px] overflow-hidden rounded-full">
                    <Image
                      src="/images/Ellipse 2355 (3).avif"
                      alt=""
                      fill
                      className="object-cover"
                      sizes="31px"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-medium">Hey Riya!</div>

                    <div className="text-[8px] leading-[10px] text-white/35">
                      Your rank 1st in Leader board
                      <br />
                      Campaign
                    </div>
                  </div>
                </div>

                <span className="text-[11px] font-medium text-[#43df3d]">
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

      <section ref={reasonsRef} className="text-white px-10 py-20">
        <div className="max-w-[1250px] mx-auto">
          {/* Tagline */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-5">
              <span className="bg-[#2C3247] text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1 sm:py-2 rounded-full flex items-center gap-2">
                <img
                  src="./images/tabler_award.png"
                  alt="icon"
                  className="w-5 h-5"
                />
                Reasons to Select Us
              </span>
            </div>

            {/* <button className="bg-[#2C3247] text-base sm:text-lg px-4 py-1 rounded-full mb-6">
                Reasons to Select Us
              </button> */}
            <h2
              className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 leading-snug ${
                reasonsVisible ? "slide-up" : "opacity-0"
              }`}
            >
              Why Choose{" "}
              <span className="bg-gradient-to-r from-purple-500 to-orange-400 bg-clip-text text-transparent">
                Game of Creators
              </span>
            </h2>
            <p
              className={`text-gray-300 text-base sm:text-lg md:text-xl ${
                reasonsVisible ? "slide-left" : "opacity-0"
              }`}
            >
              We're not just a platform – we're your competitive advantage in
              the creator economy.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/5b9ccb0130cdd4c8b6a76dccd99f879f41ba8fe2.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <h3 className="text-xl sm:text-2xl font-semibold mb-2 relative z-10">
                Organic Content at Scale
              </h3>
              <p className="text-gray-400 text-base md:text-md relative z-10">
                With Game of Creators, you generate a high volume of diverse,
                high-quality content-without the hassle of sourcing,
                negotiating, or managing creators manually.
              </p>
            </div>

            {/* 2 */}
            <div
              className="sm:col-span-2 h-auto border border-gray-700 rounded-xl overflow-hidden flex flex-col sm:flex-row items-center p-4 sm:p-6 relative group
           
              [@media(min-width:1000px)_and_(max-width:1246px)]:h-[300px] 
              
              [@media(min-width:1246px)]:h-[250px] "
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/477657f97d63845e03dfc9060e1005e8d8d651df.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/40 group-hover:opacity-0 transition-opacity duration-300"></div>

              <div className="flex-1 relative z-10 mb-4">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  Supply and Demand Based Platform
                </h3>
                <p className="text-gray-400 text-base sm:text-lg">
                  Game of Creators operated on a supply and demand model.
                  Creators complete, allowing the best ideas to surface
                  organically and driving higher engagement and reach.
                </p>
              </div>
              <div
                className="relative w-[200px] h-[200px] 
               sm:w-[250px] sm:h-[250px] 
               md:w-[250px] md:h-[250px] 
               [@media(min-width:1000px)_and_(max-width:1080px)]:w-[200px] 
              [@media(min-width:1000px)_and_(max-width:1080px)]:h-[200px] 
               [@media(min-width:1080px)_and_(max-width:1200px)]:w-[250px] 
              [@media(min-width:1000px)_and_(max-width:1200px)]:h-[250px] 
               [@media(min-width:1200px)]:w-[300px] 
              [@media(min-width:1200px)]:h-[300px] 
                 flex-shrink-0"
              >
                <Image
                  src="/images/bb14a2a8c3979fb268076c3bbb96eaf152d1a0f8.avif"
                  alt="Calendar"
                  fill
                  className="object-contain"
                  sizes="(min-width: 1200px) 300px, (min-width: 1080px) 250px, (min-width: 1000px) 200px, 200px"
                />
                <div className="absolute inset-0 bg-[#000825]/60 group-hover:opacity-0 transition-opacity duration-300"></div>
              </div>
            </div>

            {/* 3 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/cc72cdf71f826fc780265eb7ba34b2b7a5e3c2c2.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <h3 className="text-xl sm:text-2xl font-semibold mb-2 relative z-10">
                Find Content- market Fit
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                Validate creative concepts with real audience engagement.
              </p>
            </div>

            {/* 4 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/55970240f7b24d6eff2af2d8d8537bd017058e58.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/40 group-hover:opacity-0 transition-opacity duration-300"></div>

              <Rocket className="text-white mb-4 relative z-10" size={26} />
              <h3 className="text-lg sm:text-xl mb-2 relative z-10">
                Only Pay for Top Performing Content
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                Stop wasting money on content that doesn’t covert. Pay only for
                videos that perform.
              </p>
            </div>

            {/* 6 */}
            <div className="border border-gray-700 rounded-xl p-6 sm:p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/b4273c077c336d85dd75502201d73084ea5fba73.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>
              <Users2 className="text-white mb-4 relative z-10" size={26} />
              <h3 className="text-xl sm:text-xl mb-2 relative z-10">
                Skip the Creator Outreach Hassle
              </h3>
              <p className="text-gray-400 text-base sm:text-lg relative z-10">
                No more hours spent negotiating, coordinating, and following up.
                With Game of Creators, the creators come to you.
              </p>
            </div>

            <div className="sm:col-span-2 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row justify-center items-center text-start relative overflow-hidden group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/2a6d9ad13dd40e9b3b4f90b35cf0f9324af8dda7.avif')",
                }}
              ></div>
              <div className="absolute inset-0 bg-[#000825]/70 group-hover:opacity-0 transition-opacity duration-300"></div>

              <div className="flex-1 mb-4 sm:mb-0 px-2 relative z-10">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">
                  Scale Winners on Paid Ads
                </h3>
                <p className="text-gray-400 text-base sm:text-lg">
                  Identify the best-performing content and seamlessly scale it
                  into paid campaigns. With proven, audience-validated content,
                  your ads drive higher engagement, lower costs, and better
                  conversions.
                </p>
              </div>
              <div className="relative w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] lg:w-[230px] lg:h-[230px] flex-shrink-0">
                <Image
                  src="/images/0045df9e9f7db84c983cc6c5675c55189fa040a2.avif"
                  alt="Target"
                  fill
                  className="object-contain"
                  sizes="(min-width: 1024px) 230px, (min-width: 640px) 200px, 180px"
                />
                <div className="absolute inset-0 bg-[#000825]/60 group-hover:opacity-0 transition-opacity duration-300"></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/c90e07a57a2d08340f7c0d3c57b1fde4a6f0f9cd.avif')",
                }}
              ></div>

              <Globe className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                Democratised Brands Deals
              </h3>
              <p className="text-gray-400 text-base text-md md:text-lg relative z-10">
                Every creator, no . matter their follower count, can join and
                win. Success is based on creativity and performance-not just
                popularity.
              </p>
            </div>

            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/f1dc449ff317e5ede74929b2af2d4ef5b82c298f.avif')",
                }}
              ></div>

              <Headset className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                24/7 Support
              </h3>
              <p className="text-gray-400 text-base text-md md:text-xl relative z-10">
                Our team is always ready to help you win big with Game of
                Creators!
              </p>
            </div>

            <div className="border border-gray-700 rounded-xl p-8 md:p-10 flex flex-col justify-center items-center text-center relative group">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-0 group-hover:opacity-20 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "url('/images/5ce917bc44f4c6db1590e3478c916a367eacfe8a.avif')",
                }}
              ></div>

              <Palette className="text-white mb-4 relative z-10" size={30} />
              <h3 className="text-lg md:text-2xl font-semibold mb-3 relative z-10">
                Creator Freedom of Choice
              </h3>
              <p className="text-gray-400 text-base text-md md:text-lg relative z-10">
                Creators choose which brands and campaigns to promote,
                empowering them to work with what they love and get paid for it.
              </p>
            </div>
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

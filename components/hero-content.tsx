"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import Link from "next/link";
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
} from "lucide-react";
import { useSwipeable } from "react-swipeable";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import CtcBanner from "./CtcBanner";
import NumbersSection from "./NumberSection";
const steps = [
  {
    step: 1,
    title: "Brands Create a Contest",
    description:
      "Share your vision. Describe your product, set the rules, and offer a prize. Decide how you want creators to promote your brand or product.",
    image: "/images/da37f744f2ba86471c20ded62e5befaccbcabd69.avif",
    icon: <Trophy className="w-6 h-6 text-white" />,
  },
  {
    step: 2,
    title: "Open to Everyone",
    description:
      "Your follower count doesn't matter. Whether you have zero followers or millions, you can join any contest that inspires you. Pick a challenge, showcase your talent, and stand out! ",

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [animate, setAnimate] = useState(false);

  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
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
      <section className="relative flex flex-col items-center justify-center py-16 text-center text-white overflow-hidden">
        {/* Background Circles */}

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
        <div
          className={`absolute w-[600px] h-[600px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>
        <div
          className={`absolute w-[800px] h-[800px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>
        <div
          className={`absolute w-[1000px] h-[1000px] border-[2px] border-purple-500/20 rounded-full`}
        ></div>

        {/* Revolving arc */}
        <div className="absolute w-[800px] h-[800px] rounded-full animate-spin-slow">
          <div
            className={`absolute inset-0 rounded-full border-[3px] border-transparent border-t-purple-500`}
            style={{
              clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)",
            }}
          ></div>
        </div>
        <div className="absolute w-[1000px] h-[1000px] rounded-full animate-spin-slow-reverse">
          <div
            className={`absolute inset-0 rounded-full border-[3px] border-transparent border-t-purple-500`}
            style={{
              clipPath: "polygon(50% 0%, 100% 0%, 100% 40%, 50% 40%)",
            }}
          ></div>
        </div>

        <div className="inline-flex items-center gap-2.5 bg-[#FFFFFF0F] border border-[#FFFFFF1A] rounded-full px-5 py-2.5 mb-8 backdrop-blur-sm">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]">
            <Crown className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="text-base font-semibold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            #1 Creator Marketing Platform
          </span>
        </div>

        {/* Logos */}
        <div className="flex justify-center mb-8">
          <div className="relative flex items-center justify-center gap-1">

            {/* Twitter (X) Card - Far Left */}
            <motion.div
              initial={{
                rotate: -14,
                boxShadow: "0 0 12px rgba(255,255,255,0.4)",
              }}
              {...(prefersReducedMotion ? {} : {
                whileHover: {
                  scale: 1.15,
                  y: -12,
                  rotate: -14,
                  boxShadow: "0 0 26px rgba(255,255,255,0.9)",
                  zIndex: 20,
                  transition: { type: "spring", stiffness: 320, damping: 22 },
                },
              })}
              style={{ zIndex: 1 }}
              className="relative flex items-center justify-center w-[60px] h-[60px] rounded-[18px] bg-gradient-to-br from-gray-800 to-black border-[2px] border-white cursor-default"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-[16px]"></div>
              <svg viewBox="0 0 24 24" className="w-[28px] h-[28px] text-white" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </motion.div>

            {/* Instagram Card - Center Left */}
            <motion.div
              initial={{
                rotate: -5,
                boxShadow: "0 0 12px rgba(225,48,108,0.5)",
              }}
              {...(prefersReducedMotion ? {} : {
                whileHover: {
                  scale: 1.15,
                  y: -12,
                  rotate: -5,
                  boxShadow: "0 0 26px rgba(225,48,108,0.9)",
                  zIndex: 20,
                  transition: { type: "spring", stiffness: 320, damping: 22 },
                },
              })}
              style={{
                zIndex: 2,
                background:
                  "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)",
              }}
              className="relative flex items-center justify-center w-[60px] h-[60px] rounded-[18px] border-[2px] border-white cursor-default overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-[16px]"></div>
              <svg viewBox="0 0 24 24" className="w-[30px] h-[30px] text-white" fill="currentColor" aria-hidden="true">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </motion.div>

            {/* YouTube Card - Center Right */}
            <motion.div
              initial={{
                rotate: 5,
                boxShadow: "0 0 12px rgba(255,0,0,0.5)",
              }}
              {...(prefersReducedMotion ? {} : {
                whileHover: {
                  scale: 1.15,
                  y: -12,
                  rotate: 5,
                  boxShadow: "0 0 26px rgba(255,0,0,0.9)",
                  zIndex: 20,
                  transition: { type: "spring", stiffness: 320, damping: 22 },
                },
              })}
              style={{ zIndex: 2 }}
              className="relative flex items-center justify-center w-[60px] h-[60px] rounded-[18px] bg-gradient-to-br from-red-600 to-red-800 border-[2px] border-white cursor-default"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-[16px]"></div>
              {/* YouTube SVG icon */}
              <svg viewBox="0 0 24 24" className="w-[32px] h-[32px] text-white" fill="currentColor" aria-hidden="true">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </motion.div>

            {/* TikTok Card - Far Right */}
            <motion.div
              initial={{
                rotate: 14,
                boxShadow: "0 0 12px rgba(0,242,234,0.4)",
              }}
              {...(prefersReducedMotion ? {} : {
                whileHover: {
                  scale: 1.15,
                  y: -12,
                  rotate: 14,
                  boxShadow: "0 0 26px rgba(0,242,234,0.9)",
                  zIndex: 20,
                  transition: { type: "spring", stiffness: 320, damping: 22 },
                },
              })}
              style={{ zIndex: 1 }}
              className="relative flex items-center justify-center w-[60px] h-[60px] rounded-[18px] bg-gradient-to-br from-gray-900 to-black border-[2px] border-white cursor-default"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-[16px]"></div>
              <svg viewBox="0 0 24 24" className="w-[28px] h-[28px] text-white" fill="currentColor" aria-hidden="true">
                <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.82.31-.81.53-1.36 1.43-1.44 2.39-.12 1.2.61 2.39 1.65 3.02.5.34 1.12.47 1.72.44.86-.03 1.69-.42 2.25-1.07.61-.7.86-1.65.86-2.58.04-4.8.02-9.59.03-14.39.01-.02.01-.03.01-.05z" />
              </svg>
            </motion.div>

          </div>
        </div>
        {/* Title */}
        <h1
          className="text-4xl flex justify-center gap-x-3 md:text-6xl lg:text-7xl mb-6 leading-tight slide-up"
          style={{ animationDelay: "1s" }}
        >
          Game <span className="text-white">Of</span>{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #FDC155 33.29%, #FF652D 81.2%)",
            }}
          >
            Creators
          </span>
        </h1>

        <p
          className="text-lg md:text-2xl text-slate-300 max-w-4xl mx-auto mb-10 leading-relaxed drop-shadow-lg slide-left"
          style={{ animationDelay: "2s" }}
        >
          Where <span className="text-orange-400">Creators</span> and{" "}
          <span className="text-purple-400">Brands</span> Win Together
        </p>

        {/* Buttons */}

        <div className="flex flex-col sm:flex-row gap-4 mt-8 sm:mt-10 relative items-center justify-center">
          <Link href="/brands" passHref>
            <button
              className="rounded-3xl relative text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2 w-full sm:w-auto justify-center"
              style={{
                background:
                  "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
              }}
            >
              <div className="scan-line"></div>
              <Crown className="h-5 w-5" />
              I'm a Brand
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
          <Link href="/creators" passHref>
            <button className="rounded-3xl relative text-white font-bold px-8 py-3 text-lg overflow-hidden flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-700 w-full sm:w-auto justify-center">
              <div className="scan-line"></div>
              <Sparkles className="h-5 w-5" />
              I'm a Creator
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </section>
      {/* <div className="ellipse-design"></div> */}

      <section
        className="relative h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] z-10 overflow-hidden"
        ref={sectionRef}
      >
        {/* Semi-circle background */}
        <div
          className="absolute top-0 left-0 w-full flex flex-col text-center"
          style={{
            height: "50vw", // scales with screen width
            borderTopLeftRadius: "50vw",
            borderTopRightRadius: "50vw",
            background:
              "linear-gradient(360deg, rgba(55, 37, 110, 0.5) 0%, rgba(0, 8, 37, 0.5) 34.49%)",
            boxShadow:
              "1px -5px 20px 0px #D0BCFF42, 0px 46px 91.9px 0px #BC83FA91 inset",
            backdropFilter: "blur(34.2px)",
          }}
        >
          <div className="mt-8 sm:mt-14 md:mt-20 lg:mt-40">
            <h2
              className={`text-white text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold ${animate ? "slide-up" : "opacity-0"
                }`}
            >
              <span className="text-purple-400">Creative</span>{" "}
              <span className="text-orange-400">Showcase</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center mt-4 gap-3 sm:gap-5 flex-wrap">
              <span
                className={`text-gray-300 text-sm sm:text-base md:text-lg font-medium ${animate ? "slide-left" : "opacity-0"
                  }`}
                style={{ animationDelay: "0.3s" }}
              >
                Join 1000+ Active Creators
              </span>

              {/* Avatar Stack */}
              <div
                className={`flex -space-x-2 sm:-space-x-3 ${animate ? "slide-up" : "opacity-0"
                  }`}
                style={{ animationDelay: "0.6s" }}
              >
                {[
                  "434ce5e441255007a5349fd85232df9726062927.avif",
                  "028df62b75a0a5e07e3025b313d8b74cda06d987.avif",
                  "f3a549313a8c77a542d9239fdd18733c34787a69.avif",
                  "f0c4aef454fceee8af51bb454a70238d17ad978a.avif",
                  "776584be4e29200a5a72df8ebba39153a4aa21b6.avif",
                ].map((img, idx) => (
                  <Image
                    key={idx}
                    src={`/images/${img}`}
                    alt={`Creator ${idx + 1}`}
                    width={48}
                    height={48}
                    loading="lazy"
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full border-2 border-gray-500"
                    sizes="(min-width: 1024px) 48px, (min-width: 640px) 40px, 32px"
                  />
                ))}
              </div>

              {/* <span
                  className={`text-gray-300 text-sm sm:text-base md:text-lg font-medium ${
                    chooseVisible ? "slide-right" : "opacity-0"
                  }`}
                  style={{ animationDelay: "1.2s" }}
                >
                  3000+ Active Creators
                </span> */}
            </div>
          </div>
        </div>
      </section>

      <div className="absolute bottom-[80px] lg:bottom-[90px] left-1/2 -translate-x-1/2 z-20 w-full scroll-container">
        <div className="scroll-track">
          {[
            { src: "/videos/SnapInsta.to_AQNd.mp4", poster: "/images/thumb_AQNd.jpg" },
            { src: "/videos/SnapInsta.to_AQMAznjnb2VYJ.mp4", poster: "/images/thumb_AQMAznjnb2VYJ.jpg" },
            { src: "/videos/SnapInsta.to_AQNxeCNjx2k.mp4", poster: "/images/thumb_AQNxeCNjx2k.jpg" },
            { src: "/videos/SnapInsta.to_AQNVKvZ3ezk6J.mp4", poster: "/images/thumb_AQNVKvZ3ezk6J.jpg" },
            { src: "/videos/SnapInsta.to_AQPB-nUfz2at6Wa.mp4", poster: "/images/thumb_AQPB-nUfz2at6Wa.jpg" },
            { src: "/videos/SnapInsta.to_AQMa90k.mp4", poster: "/images/thumb_AQMa90k.jpg" },
          ]
            .concat([
              { src: "/videos/SnapInsta.to_AQNd.mp4", poster: "/images/thumb_AQNd.jpg" },
              { src: "/videos/SnapInsta.to_AQMAznjnb2VYJ.mp4", poster: "/images/thumb_AQMAznjnb2VYJ.jpg" },
              { src: "/videos/SnapInsta.to_AQNxeCNjx2k.mp4", poster: "/images/thumb_AQNxeCNjx2k.jpg" },
              { src: "/videos/SnapInsta.to_AQNVKvZ3ezk6J.mp4", poster: "/images/thumb_AQNVKvZ3ezk6J.jpg" },
              { src: "/videos/SnapInsta.to_AQPB-nUfz2at6Wa.mp4", poster: "/images/thumb_AQPB-nUfz2at6Wa.jpg" },
              { src: "/videos/SnapInsta.to_AQMa90k.mp4", poster: "/images/thumb_AQMa90k.jpg" },
            ]) // duplicate videos for seamless loop
            .map(({ src, poster }, idx) => (
              <div
                key={idx}
                className="relative w-[110px] h-[180px] md:w-[190px] md:h-[300px] rounded-[10px] overflow-hidden shadow-lg mx-6 border-2 border-purple-500/70"
              >
                <video
                  src={src}
                  poster={poster}
                  className="absolute inset-0 w-full h-full object-cover"
                  preload={idx < 2 ? "auto" : "metadata"}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              </div>
            ))}
        </div>
      </div>

      <section
        ref={worksRef}
        className="text-white px-8 py-0 md:py-16 relative"
      >
        <div className="max-w-7xl custom-max-w mx-auto text-center relative">
          {/* Tagline */}
          <div className="flex justify-center mb-5">
            <span className="bg-[#2C3247] text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1 sm:py-2 rounded-full flex items-center gap-2">
              <Image
                src="/images/streamline-sharp_user-work-laptop-wifi.png"
                alt="Work laptop with wifi icon"
                width={24}
                height={24}
                className="w-5 h-5 sm:w-6 sm:h-6"
                loading="lazy"
              />
              Enhance your Marketing skills
            </span>
          </div>

          {/* Title */}
          <h2
            className={`text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 leading-snug ${worksVisible ? "slide-up" : "opacity-0"
              }`}
          >
            How <span className="text-purple-400">Game</span> of{" "}
            <span className="text-orange-400">Creators</span> Works
          </h2>

          {/* Subtitle */}
          <p
            className={`text-center text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-8 md:mb-12 px-2 ${worksVisible ? "slide-left" : "opacity-0"
              }`}
          >
            Three simple steps to launch your viral marketing campaign and
            dominate the game
          </p>

          {/* Active Step */}
          <div
            {...handlers}
            className="flex flex-col gap-1 md:flex-row max-w-[1250px] mx-auto relative"
          >
            {/* Left Arrow */}
            <button
              onClick={handlePrev}
              aria-label="Previous slide"
              className="hidden md:flex absolute arrow-btn -left-20 top-1/2 -translate-y-1/2 border-2 rounded-full transition w-12 h-12 items-center justify-center"
            >
              <ArrowLeft className="w-7 h-7 text-white" />
            </button>

            {/* Image */}
            <div className="w-full md:w-1/2 relative aspect-square md:aspect-auto md:h-auto">
              <Image
                src={steps[activeIndex].image}
                alt={steps[activeIndex].title}
                fill
                className="object-cover rounded-xl"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            </div>

            {/* Content */}
            <div className="w-full md:w-1/2 border-2 rounded-xl p-6 border-gray-600 sm:p-8 flex flex-col justify-start relative left-0 lg:left-2 text-left">
              {/* Step Indicator */}
              <div className="flex mb-4 sm:mb-6 items-center justify-between">
                <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-white/60 bg-transparent">
                  {steps[activeIndex].icon}
                </div>

                <div className="relative px-3 py-0.5 sm:px-5 sm:py-1 rounded-full text-md sm:text-lg font-semibold text-white border-2 border-white/60">
                  Step {steps[activeIndex].step}
                </div>
              </div>

              <div className="mt-6 sm:mt-10">
                {/* Title */}
                <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-left">
                  {steps[activeIndex].title}
                </h3>

                {/* Description */}
                <p className="text-gray-300 text-base sm:text-lg md:text-xl mb-6 sm:mb-10 text-left">
                  {steps[activeIndex].description}
                </p>

                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 relative z-10"
                >
                  <button
                    className="px-5 mb-4 sm:px-6 py-1.5 sm:py-2 relative rounded-full inline-flex items-center gap-2 overflow-hidden self-start text-sm md:text-lg sm:text-base"
                    style={{
                      background:
                        "linear-gradient(90deg, #4C238D 0%, #7F39EC 50%, #4C238D 100%)",
                    }}
                  >
                    <div className="scan-line"></div>
                    Start Now
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={handleNext}
              aria-label="Next slide"
              className="hidden md:flex absolute arrow-btn -right-20 top-1/2 -translate-y-1/2 border-2 rounded-full transition w-12 h-12 items-center justify-center"
            >
              <ArrowRight className="w-7 h-7 text-white" />
            </button>
          </div>

          {/* Dots Navigation */}
          <div className="flex justify-center mt-6 sm:mt-10 gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                aria-label={`Go to step ${index + 1}`}
                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors ${activeIndex === index ? "bg-purple-600" : "bg-gray-600"
                  }`}
              ></button>
            ))}
          </div>
        </div>
      </section>

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
              className={`text-2xl sm:text-3xl md:text-5xl font-bold mb-4 leading-snug ${reasonsVisible ? "slide-up" : "opacity-0"
                }`}
            >
              Why Choose{" "}
              <span className="bg-gradient-to-r from-purple-500 to-orange-400 bg-clip-text text-transparent">
                Game of Creators
              </span>
            </h2>
            <p
              className={`text-gray-300 text-base sm:text-lg md:text-xl ${reasonsVisible ? "slide-left" : "opacity-0"
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
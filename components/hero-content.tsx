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
  Upload,
  Sparkles,
  Crown,
  Globe,
  Rocket,
  Star,
  Palette,
  Heart,
  User,
  Users2,
  Wallet,
  ChevronDown,
} from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { useSwipeable } from "react-swipeable";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import NumbersSection from "./NumberSection";
import { useThemeMode } from "@/hooks/use-theme-mode";

const FORM_DEMO_TITLE = "Podcasts Clipping Challenge (Dual Rewards)";
const FORM_DEMO_THUMB = "/images/9ec348288ce12767ffa9907081b7c37124c89470.png";
const FORM_DEMO_CURSOR = "/images/Frame (5).png";
const FORM_DEMO_CAMPAIGN_TYPES = [
  "Leaderboard",
  "CPM",
  "Milestone",
  "Dual Rewards",
] as const;

type FormCursorTarget = "title" | "budget" | "launch" | "campaignType";

function BrandFormMockup({ isLight }: { isLight: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const budgetRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLDivElement>(null);
  const campaignTypeRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [platformReady, setPlatformReady] = useState(false);
  const [typeReady, setTypeReady] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [selectedCampaignType, setSelectedCampaignType] = useState<
    (typeof FORM_DEMO_CAMPAIGN_TYPES)[number] | null
  >(null);
  const [budgetText, setBudgetText] = useState("$0");
  const [budgetTyping, setBudgetTyping] = useState(false);
  const [showThumb, setShowThumb] = useState(false);
  const [rocketFlying, setRocketFlying] = useState(false);
  const [demoKey, setDemoKey] = useState(0);

  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 40, y: 320 });
  const [showClickBurst, setShowClickBurst] = useState(false);

  const getTargetPos = (target: FormCursorTarget) => {
    const root = rootRef.current;
    const el =
      target === "title"
        ? titleRef.current
        : target === "budget"
          ? budgetRef.current
          : target === "campaignType"
            ? campaignTypeRef.current
            : launchRef.current;
    if (!root || !el) return null;
    const rootRect = root.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.55 - rootRect.left,
      y: rect.top + rect.height * 0.55 - rootRect.top,
    };
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTitle(FORM_DEMO_TITLE);
      setPlatformReady(true);
      setTypeReady(true);
      setSelectedCampaignType("Leaderboard");
      setTypeDropdownOpen(false);
      setBudgetText("$2400");
      setShowThumb(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    let cancelled = false;

    const moveCursorTo = async (target: FormCursorTarget) => {
      const pos = getTargetPos(target);
      if (!pos) return;
      setCursorVisible(true);
      setCursorPos(pos);
      await wait(650);
    };

    const clickCursor = async () => {
      setCursorClicking(true);
      setShowClickBurst(true);
      await wait(220);
      setCursorClicking(false);
      setShowClickBurst(false);
      await wait(120);
    };

    const run = async () => {
      setTitle("");
      setPlatformReady(false);
      setTypeReady(false);
      setTypeDropdownOpen(false);
      setSelectedCampaignType(null);
      setBudgetText("$0");
      setBudgetTyping(false);
      setShowThumb(false);
      setRocketFlying(false);
      setCursorVisible(false);
      setCursorClicking(false);
      setShowClickBurst(false);
      setCursorPos({ x: 48, y: 300 });

      await wait(450);
      if (cancelled) return;

      // Cursor clicks title field, then typing starts
      await moveCursorTo("title");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      for (let i = 1; i <= FORM_DEMO_TITLE.length; i++) {
        if (cancelled) return;
        setTitle(FORM_DEMO_TITLE.slice(0, i));
        await wait(36);
      }

      await wait(350);
      if (cancelled) return;
      setPlatformReady(true);

      // Cursor opens campaign type dropdown, then picks Leaderboard
      await wait(350);
      if (cancelled) return;
      await moveCursorTo("campaignType");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;
      setTypeDropdownOpen(true);

      await wait(550);
      if (cancelled) return;
      setSelectedCampaignType("Leaderboard");
      setTypeReady(true);

      await wait(420);
      if (cancelled) return;
      setTypeDropdownOpen(false);

      await wait(400);
      if (cancelled) return;

      // Cursor clicks budget, then types digit-by-digit
      await moveCursorTo("budget");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      setBudgetTyping(true);
      setBudgetText("$");
      await wait(200);
      for (const ch of "2400") {
        if (cancelled) return;
        setBudgetText((prev) => prev + ch);
        await wait(180);
      }
      await wait(260);
      setBudgetTyping(false);

      await wait(350);
      if (cancelled) return;
      setShowThumb(true);

      await wait(450);
      if (cancelled) return;

      // Cursor clicks Launch → rocket slides right inside the colored button
      await moveCursorTo("launch");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      setRocketFlying(true);
      await wait(1100);
      if (cancelled) return;
      setCursorVisible(false);
      setRocketFlying(false);

      await wait(700);
      if (!cancelled) setDemoKey((k) => k + 1);
    };

    void run();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [demoKey]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-30">
      {/* FORM MOCKUP */}
      <div
        className={cn(
          "absolute left-2 right-2 top-[248px] h-[440px] overflow-visible rounded-t-[20px] border sm:left-[24px] sm:right-[24px] sm:top-[266px] md:left-[44px] md:right-[44px]",
          isLight
            ? "border-[#0000000D] bg-[#ECECEC] text-black shadow-[inset_0_0_4.43px_0_#0000001A]"
            : "border-white/[0.10] bg-[#121212] text-white shadow-[0_-10px_40px_rgba(0,0,0,.15)]",
        )}
      >
        {/* Launch */}
        <div ref={launchRef} className="absolute right-0 top-3 z-20 sm:top-4">
          <div className="relative">
            {!isLight ? (
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-2 rounded-lg bg-[radial-gradient(circle,rgba(187,0,255,0.45)_0%,transparent_70%)] opacity-55 blur-[10px]"
              />
            ) : null}

            <div
              className={cn(
                "relative w-[100px] overflow-hidden rounded-[6px] px-3.5 py-2 text-[14px] font-medium",
                isLight
                  ? "border border-black/[0.06] bg-white text-[#7C3AED]"
                  : "bg-[#201E1E] text-white",
              )}
            >
              {!isLight ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-[-6px] left-1/2 h-[14px] w-[78%] -translate-x-1/2 rounded-[100%] bg-[linear-gradient(180deg,rgba(187,0,255,0.6)_0%,rgba(217,217,217,0.55)_100%)] blur-[7px]"
                />
              ) : null}

              <span className="relative z-10 flex h-4 items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center",
                    rocketFlying && "animate-form-rocket-fly",
                  )}
                >
                  {isLight ? (
                    <Rocket
                      className="h-4 w-4 text-[#7C3AED]"
                      strokeWidth={2}
                    />
                  ) : (
                    <Image
                      src="/images/Frame.png"
                      alt=""
                      width={16}
                      height={16}
                      className="h-4 w-4 object-contain mix-blend-screen"
                    />
                  )}
                </span>
                {!rocketFlying ? <span>Launch</span> : null}
              </span>
            </div>
          </div>
        </div>

        {/* Form header */}
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px]",
                isLight
                  ? "bg-[#7C3AED]/15 text-[#7C3AED]"
                  : "bg-[#292929] text-white",
              )}
            >
              1
            </span>
            <span
              className={cn(
                "text-[16px] font-medium",
                isLight ? "text-black" : "text-white",
              )}
            >
              Details
            </span>
          </div>
        </div>

        <div className="mt-5 h-[calc(100%-54px)] overflow-hidden px-5">
          {/* Campaign title */}
          <div className="flex items-center justify-between">
            <label
              className={cn(
                "text-[11px]",
                isLight ? "text-black/70" : "text-white/75",
              )}
            >
              Campaign title
              <span className="text-red-400"> *</span>
            </label>
            <span
              className={cn(
                "text-[10px]",
                isLight ? "text-black/35" : "text-white/35",
              )}
            >
              {title.length}/100
            </span>
          </div>

          <div
            ref={titleRef}
            className={cn(
              "mt-1.5 flex h-[34px] items-center rounded-md border px-3.5 text-[10.5px] transition-colors duration-300",
              isLight
                ? "border-[#0000000D] bg-white"
                : "border-white/[0.06] bg-[#292929]",
              title
                ? isLight
                  ? "text-black/80"
                  : "text-white/85"
                : isLight
                  ? "text-black/40"
                  : "text-white/25",
            )}
          >
            <span className="truncate">
              {title || "e.g., Create a Viral shorts/video for our New App"}
            </span>
            {title.length > 0 && title.length < FORM_DEMO_TITLE.length ? (
              <span
                className={cn(
                  "ml-0.5 inline-block h-3.5 w-px animate-form-caret",
                  isLight ? "bg-[#7C3AED]" : "bg-white/70",
                )}
              />
            ) : null}
          </div>

          {/* Platform + Campaign type */}
          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <div>
              <label
                className={cn(
                  "text-[11px]",
                  isLight ? "text-black/70" : "text-white/75",
                )}
              >
                Platform
                <span className="text-red-400"> *</span>
              </label>
              <div
                className={cn(
                  "mt-1.5 flex h-[34px] items-center justify-between rounded-md border px-3.5 text-[11px] transition-all duration-300",
                  isLight
                    ? "border-[#0000000D] bg-white"
                    : "border-white/[0.06] bg-[#292929]",
                  platformReady
                    ? isLight
                      ? "text-black/80"
                      : "text-white/85"
                    : isLight
                      ? "text-black/40"
                      : "text-white/25",
                )}
              >
                {platformReady ? (
                  <span className="flex items-center gap-1.5">
                    <SiYoutube className="h-4 w-4 text-[#737373]" />
                    YouTube
                  </span>
                ) : (
                  <span>Select platform</span>
                )}
                <span>⌄</span>
              </div>
            </div>

            <div className="relative" ref={campaignTypeRef}>
              <label
                className={cn(
                  "text-[11px]",
                  isLight ? "text-black/70" : "text-white/75",
                )}
              >
                Campaign type
              </label>
              <div
                className={cn(
                  "mt-1.5 flex h-[34px] items-center justify-between rounded-md border px-3.5 text-[11px] transition-all duration-300",
                  isLight
                    ? "border-[#0000000D] bg-white"
                    : "border-white/[0.06] bg-[#292929]",
                  typeDropdownOpen &&
                    (isLight
                      ? "border-[#7C3AED]/35 ring-1 ring-[#7C3AED]/20"
                      : "border-white/20 ring-1 ring-white/10"),
                  typeReady || selectedCampaignType
                    ? isLight
                      ? "text-black/80"
                      : "text-white/85"
                    : isLight
                      ? "text-black/40"
                      : "text-white/25",
                )}
              >
                <span>{selectedCampaignType ?? "Select campaign type"}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out",
                    typeDropdownOpen && "rotate-180",
                    isLight ? "text-black/45" : "text-white/45",
                  )}
                  strokeWidth={2.2}
                />
              </div>

              {typeDropdownOpen ? (
                <div
                  className={cn(
                    "absolute left-0 right-0 top-[calc(100%+4px)] z-40 origin-top overflow-hidden rounded-md border py-1 shadow-[0_12px_28px_rgba(0,0,0,0.18)] animate-form-dropdown-in",
                    isLight
                      ? "border-[#0000000D] bg-white"
                      : "border-white/[0.08] bg-[#292929]",
                  )}
                >
                  {FORM_DEMO_CAMPAIGN_TYPES.map((type) => {
                    const isSelected = selectedCampaignType === type;
                    return (
                      <div
                        key={type}
                        className={cn(
                          "flex h-[32px] items-center px-3.5 text-[11px] transition-colors duration-200",
                          isSelected
                            ? isLight
                              ? "bg-[#7C3AED]/10 text-[#7C3AED]"
                              : "bg-white/10 text-white"
                            : isLight
                              ? "text-black/70"
                              : "text-white/70",
                        )}
                      >
                        {type}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          {/* Upload / thumbnail */}
          <div
            className={cn(
              "relative mt-5 flex h-[132px] items-center justify-center overflow-hidden rounded-md border border-dashed transition-all duration-500",
              isLight
                ? "border-[#0000001A] bg-white"
                : "border-white/[0.08] bg-[#242424]",
            )}
          >
            {showThumb ? (
              <div className="absolute inset-0 animate-form-thumb-in">
                <Image
                  src={FORM_DEMO_THUMB}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="320px"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <Upload
                  className={cn(
                    "h-6 w-6",
                    isLight ? "text-black/35" : "text-white/30",
                  )}
                />
                <div
                  className={cn(
                    "mt-1.5 text-[11px]",
                    isLight ? "text-black/50" : "text-white/45",
                  )}
                >
                  Drag, drop or{" "}
                  <span
                    className={cn("underline", isLight ? "text-[#7C3AED]" : "")}
                  >
                    browse
                  </span>{" "}
                  thumbnail
                </div>
                <div
                  className={cn(
                    "mt-1 text-[9px]",
                    isLight ? "text-black/35" : "text-white/25",
                  )}
                >
                  Max file size: 5MB
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLOATING BUDGET */}
      <div
        ref={budgetRef}
        className={cn(
          "absolute bottom-[8px] left-[20px] z-10 w-[180px] rounded-[18px] border p-4",
          isLight
            ? "border-[#0000000D] bg-[#ECECEC] shadow-[0_10px_28px_rgba(20,16,40,0.08)]"
            : "border-white/[0.12] bg-[#1b1b1b] shadow-[0_15px_35px_rgba(0,0,0,.45)]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 text-[15px] font-medium",
            isLight ? "text-black" : "text-white",
          )}
        >
          <Wallet
            className={cn(
              "h-[20px] w-[20px] shrink-0",
              isLight ? "text-black/70" : "text-white/90",
            )}
            strokeWidth={1.8}
          />
          Budget
        </div>

        <div
          className={cn(
            "mt-3.5 flex h-[38px] items-center rounded-md border px-3.5 text-[14px] tabular-nums transition-all duration-200",
            isLight
              ? budgetTyping
                ? "border-[#7C3AED]/45 bg-white text-black shadow-[0_0_0_2px_rgba(124,58,237,0.12)]"
                : "border-[#0000000D] bg-white text-black/70"
              : budgetTyping
                ? "border-white/35 bg-[#292929] text-white shadow-[0_0_0_2px_rgba(255,255,255,0.06)]"
                : "border-white/[0.07] bg-[#292929] text-white/80",
          )}
        >
          <span>{budgetText}</span>
          {budgetTyping ? (
            <span
              className={cn(
                "ml-0.5 inline-block h-4 w-[1.5px] animate-form-caret",
                isLight ? "bg-[#7C3AED]" : "bg-white",
              )}
            />
          ) : null}
        </div>
      </div>

      {/* Animated cursor arrow — clicks fields then Launch */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute z-50 transition-[left,top,opacity,transform] duration-700 ease-in-out",
          cursorVisible ? "opacity-100" : "opacity-0",
          cursorClicking && "scale-90",
        )}
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          width: 28,
          height: 28,
        }}
      >
        {showClickBurst ? (
          <span className="pointer-events-none absolute -left-1 -top-1 h-5 w-5 animate-ping rounded-full bg-white/45" />
        ) : null}
        <Image
          src={FORM_DEMO_CURSOR}
          alt=""
          width={28}
          height={28}
          className="relative h-[28px] w-[28px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
          priority
        />
      </div>
    </div>
  );
}

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

const creatorsCollageTopImages = [
  "/images/1ad1c9f574ea6d160a89ed07d1b57719736a1741.png",
  "/images/fa2936792bd0f4aac9c0930fabbd4e09bf1395f3.png",
  "/images/9ec348288ce12767ffa9907081b7c37124c89470.png",
];

const creatorsCollageBottomImages = [
  "/images/ab2f5e265b64dc9fb7ab055b55edf04d30267135.png",
  "/images/9fdb16697941ae684b84575d2a61602b36d7b034.png",
  "/images/b03ad3334c0eaa641c588a3a9bfc08a66de184ac.png",
];

const brandImages: string[] = [
  "/images/ba54cd16167abac1d45d63109c16d6999d67e552.png",
  "/images/image 277.png",
  "/images/7e659d660283b02da97f42ede238f8b03b35cb37.png",
  "/images/image 276.png",
  "/images/Frame 2147243949.png",
  "/images/0046b3171bb1d05ed8f26833e71c449ca7073d81.png",
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
const CREATORS_NETWORK_NUMBERS = [
  "1,000+",
  "4,500+",
  "8,200+",
  "12,000+",
  "14,800+",
  "16,700+",
];
const VIEWS_GENERATED_NUMBERS = [
  "10M+",
  "40M+",
  "75M+",
  "110M+",
  "140M+",
  "160M+",
];

function HeroStatBlock({
  numbers,
  label,
  isLight,
}: {
  numbers: string[];
  label: string;
  isLight: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [animate, setAnimate] = useState(false);

  const maxSteps = numbers.length - 1;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setAnimate(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (animate && step < maxSteps) {
      const timeout = setTimeout(() => {
        setStep((prev) => prev + 1);
      }, 400);
      return () => clearTimeout(timeout);
    }
  }, [animate, step, maxSteps]);

  const translateYPercent = (step * 100) / numbers.length;

  return (
    <div className="flex flex-col items-center text-center" ref={containerRef}>
      <div className="h-[64px] overflow-hidden sm:h-[76px] md:h-[92px] lg:h-[112px]">
        <div
          className="flex flex-col transition-transform duration-500 ease-out"
          style={{
            transform: `translateY(-${translateYPercent}%)`,
          }}
        >
          {numbers.map((num, i) => (
            <h2
              key={i}
              className={cn(
                "flex h-[64px] shrink-0 items-center justify-center bg-clip-text text-[64px] font-extrabold leading-none tracking-[-0.055em] text-transparent sm:h-[76px] sm:text-[76px] md:h-[92px] md:text-[92px] lg:h-[112px] lg:text-[112px]",
                isLight
                  ? "bg-gradient-to-b from-black via-[#3a3a3a] to-[#9a9a9a]"
                  : "bg-[linear-gradient(180deg,#555555_0%,#D8D8D8_45%,#FFFFFF_90%)]",
              )}
            >
              {num}
            </h2>
          ))}
        </div>
      </div>

      <p
        className={cn(
          "mt-5 text-[22px] font-semibold tracking-[-0.02em] sm:text-[25px] md:text-[29px]",
          isLight ? "text-black/45" : "text-[#969696]",
        )}
      >
        {label}
      </p>
    </div>
  );
}

export default function HeroContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLight } = useThemeMode();
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
      <main
        className={cn(
          "relative min-h-screen overflow-hidden transition-colors duration-300",
          isLight ? "bg-transparent text-black" : "bg-[#000000] text-white",
        )}
      >
        {/* =========================================================
          BACKGROUND + CONCENTRIC ORBIT RINGS
      ========================================================= */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {isLight ? (
            <>
              {/* <div className="absolute left-[-10%] top-[-20%] h-[70%] w-[55%] rounded-full bg-[radial-gradient(circle,rgba(186,160,255,0.35)_0%,transparent_68%)] blur-2xl" />
              <div className="absolute right-[-5%] top-[5%] h-[55%] w-[50%] rounded-full bg-[radial-gradient(circle,rgba(140,190,255,0.28)_0%,transparent_70%)] blur-2xl" />
              <div className="absolute bottom-[-10%] left-[20%] h-[45%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(255,200,160,0.18)_0%,transparent_70%)] blur-2xl" /> */}
            </>
          ) : (
            <div className="absolute left-1/2 top-[15%] h-[750px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.035),transparent_68%)]" />
          )}

          {/* Two gray orbit circles — purple travels on outer, yellow on inner */}
          <svg
            className={cn(
              "absolute left-1/2 top-[0%] aspect-square w-[min(112vw,1080px)] max-w-none -translate-x-1/2 sm:top-[-4%] sm:w-[min(108vw,1180px)] lg:top-[-10%] lg:w-[min(98vw,1280px)]",
              isLight ? "opacity-45" : "opacity-100",
            )}
            viewBox="0 0 1000 1000"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Inner circle border */}
              <linearGradient
                id="heroCircleBorderInner"
                x1="500"
                y1="90"
                x2="500"
                y2="910"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  stopColor="rgb(37, 37, 37)"
                  stopOpacity="0.074"
                />
                <stop
                  offset="50%"
                  stopColor="rgb(88, 88, 88)"
                  stopOpacity="0.37"
                />
                <stop
                  offset="100%"
                  stopColor="rgb(139, 139, 139)"
                  stopOpacity="0"
                />
              </linearGradient>
              <linearGradient id="heroYellowOrbit" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c9a016" stopOpacity="0" />
                <stop offset="30%" stopColor="#e8b820" stopOpacity="0.5" />
                <stop offset="50%" stopColor="#FFE566" stopOpacity="1" />
                <stop offset="70%" stopColor="#e8b820" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#c9a016" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="heroPurpleOrbit" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#72129a" stopOpacity="0" />
                <stop offset="30%" stopColor="#9b1fd4" stopOpacity="0.55" />
                <stop offset="50%" stopColor="#C84BFF" stopOpacity="1" />
                <stop offset="70%" stopColor="#9b1fd4" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#72129a" stopOpacity="0" />
              </linearGradient>
              <filter
                id="heroYellowGlow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="heroPurpleGlow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer circle — no border, purple arc only */}
            {/* Inner circle — gradient border (5px) */}
            <circle
              cx="500"
              cy="500"
              r="360"
              stroke="url(#heroCircleBorderInner)"
              strokeWidth="5"
            />

            {/* Traveling glow arcs */}
            {!prefersReducedMotion ? (
              <>
                {/* Outer — purple */}
                <circle
                  className="animate-hero-orbit-purple"
                  cx="500"
                  cy="500"
                  r="360"
                  stroke="url(#heroPurpleOrbit)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeDasharray="150 2928"
                  filter="url(#heroPurpleGlow)"
                />
                {/* Inner — yellow */}
                <circle
                  className="animate-hero-orbit-yellow"
                  cx="500"
                  cy="500"
                  r="460"
                  stroke="url(#heroYellowOrbit)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="130 2572"
                  filter="url(#heroYellowGlow)"
                />
              </>
            ) : null}
          </svg>
        </div>

        {/* =========================================================
          HERO
      ========================================================= */}

        <div className="relative z-20 mx-auto max-w-[1200px] px-6 lg:px-8">
          {/* Trusted */}
          <div className="flex justify-center pt-10 sm:pt-14">
            <div className="flex items-center gap-2.5">
              {/* Avatar 1 */}
              <div
                className={cn(
                  "relative z-10 h-10 w-10 overflow-hidden rounded-full border-2 bg-white",
                  isLight ? "border-white" : "border-[#030303]",
                )}
              >
                <Image
                  src="/images/39da146881792a5ee763fad443e4c9b4c3e835a5.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>

              {/* Avatar 2 */}
              <div
                className={cn(
                  "relative -ml-4 h-10 w-10 overflow-hidden rounded-full border-2 bg-yellow-300",
                  isLight ? "border-white" : "border-[#030303]",
                )}
              >
                <Image
                  src="/images/7a17402e3a42cf5d6cf5d8f830d884ce8a940dcc.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="32px"
                />
              </div>

              <span
                className={cn(
                  "ml-1 text-[17px]",
                  isLight ? "text-black/55" : "text-[#C4C4C4]",
                )}
              >
                Trusted by Top Brands &amp; Creators
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mx-auto mt-7 max-w-[1000px] text-center">
            <h1
              className={cn(
                "text-[42px] font-semibold leading-[1.05] tracking-[-0.05em] sm:text-[50px] md:text-[52px] font-['Inter'] font-bold leading-[110%] tracking-[-4%] text-center",
                isLight
                  ? "text-black/75"
                  : "bg-[linear-gradient(180deg,#555555_0%,#D8D8D8_45%,#FFFFFF_90%)] bg-clip-text text-transparent",
              )}
            >
              Creators earn on{" "}
              <span className="inline-flex items-center gap-2">
                {/* Performance icon — opt out of text fill so the badge stays visible */}
                <span
                  className="
                    inline-flex
                    h-[60.64px]
                    w-[63.11px]
                    shrink-0
                    rotate-[8.81deg]
                    items-center
                    justify-center
                    rounded-[16.09px]
                    bg-[linear-gradient(180deg,#FF8800_0%,#FFA53E_50%,#FFC27C_100%)]
                    shadow-[0px_3.71px_4.95px_0px_#FFFFFF40_inset,3.71px_-8.66px_4.95px_0px_#FFD2D20D_inset,6.19px_-11.14px_13.36px_0px_#FFF4F440_inset,13.61px_13.61px_49.5px_0px_#FFAD0038,3.71px_4.95px_29.7px_0px_#FFAD0026,1.24px_3.71px_8.17px_0px_#FFAD001A]
                    [background-clip:padding-box]
                    [-webkit-text-fill-color:initial]
                  "
                >
                  <Image
                    src="/images/Vector1234.png"
                    alt=""
                    width={32}
                    height={32}
                    className="h-[32px] w-[32px] object-contain"
                  />
                </span>
                performance
              </span>
              <br />
              Brands grow on results.
            </h1>

            {/* Description */}
            <p
              className={cn(
                "mx-auto mt-7 max-w-[600px] font-['Inter'] text-[17px] font-medium leading-[150%] tracking-[-0.51px] text-center",
                isLight ? "text-black/50" : "text-[#8E8E8E]",
              )}
            >
              Launch performance-driven campaigns that turn creator content into
              measurable results.
            </p>

            {/* =====================================================
              CTA BUTTONS
          ====================================================== */}

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/brands"
                className={cn(
                  "group flex h-[51px] min-w-[238px] items-center justify-center rounded-xl text-md font-semibold transition",
                  isLight
                    ? "bg-[#7c3aed] text-white shadow-[0_12px_30px_rgba(124,58,237,0.28)] hover:bg-[#6d28d9]"
                    : "border border-white/20 bg-[linear-gradient(0deg,#000000_0%,#353535_138.24%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-white/30 hover:bg-white/[0.08]",
                )}
              >
                For Brands
                <ArrowRight
                  className="
                  ml-2
                  h-4
                  w-4
                  transition-transform
                  group-hover:translate-x-1
                "
                />
              </Link>

              <Link
                href="/creators"
                className={cn(
                  "group flex h-[51px] min-w-[238px] items-center justify-center rounded-xl text-md font-semibold transition",
                  isLight
                    ? "border border-black/10 bg-white text-black shadow-[0_8px_24px_rgba(15,15,30,0.06)] hover:bg-white hover:border-black/20"
                    : "bg-[#DEDEDE] text-[#26133d] shadow-[0_10px_35px_rgba(200,170,230,0.10)] hover:bg-white",
                )}
              >
                For Creators
                <ArrowRight
                  className="
                  ml-2
                  h-4
                  w-4
                  transition-transform
                  group-hover:translate-x-1
                "
                />
              </Link>
            </div>
          </div>
        </div>
        {/* =========================================================
          VISUAL / ORBIT AREA
      ========================================================= */}
        <section className="relative mx-auto mt-8 w-full max-w-[1400px] px-4 pb-12 sm:mt-10 sm:px-6 sm:pb-16 lg:mt-[55px] lg:h-[620px] lg:px-0 lg:pb-0">
          {/* =====================================================
            LEFT CAMPAIGN CARD
        ===================================================== */}
          <div
            className={cn(
              "absolute left-[2%] top-[35px] z-20 hidden w-[200px] rotate-[7deg] rounded-[23px] p-[15px] xl:left-[4%] xl:w-[220px] lg:block",
              isLight
                ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
            )}
          >
            {/* Card header */}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-[29px] w-[29px] items-center justify-center rounded-[8px]",
                  isLight ? "bg-[#efe8f8]" : "bg-[#40344c]",
                )}
              >
                <Users
                  className={cn(
                    "h-[15px] w-[15px]",
                    isLight ? "text-[#7c3aed]" : "text-white/80",
                  )}
                />
              </div>

              <span
                className={cn(
                  "text-[13px]",
                  isLight ? "text-black/55" : "text-white/75",
                )}
              >
                Brand
              </span>
            </div>

            {/* Title */}
            <div
              className={cn(
                "mt-3 text-[15px] font-medium",
                isLight ? "text-black" : "text-white",
              )}
            >
              Podcasts Clip Challenge
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-[7px]">
              {["Clipping", "UGC"].map((tag) => (
                <span
                  key={tag}
                  className={cn(
                    "rounded-full px-[9px] py-[5px] text-[12px]",
                    isLight
                      ? "bg-[#f3eaff] text-[#7c3aed]"
                      : "bg-[#2B1F3B] text-[#BB00FF]",
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Bottom */}
            <div className="mt-3 flex items-end justify-between">
              <img
                src="/images/e9ecc19156964f29ca20b5f8080671042162b486.png"
                alt="Creator"
                className="h-[72px] w-[72px] rounded-md object-cover"
              />

              <div
                className={cn(
                  "flex h-[35px] w-[35px] items-center justify-center rounded-full text-[18px]",
                  isLight
                    ? "bg-[#f3eaff] text-[#7c3aed]"
                    : "bg-[#351149] text-[#c239f5]",
                )}
              >
                →
              </div>
            </div>
          </div>

          {/* =====================================================
            LEFT TEXT
        ===================================================== */}
          <div
            className={cn(
              "absolute left-[6%] top-[260px] z-20 hidden rotate-[-4deg] font-['Comic_Sans_MS'] text-[17px] italic xl:left-[9%] lg:block",
              isLight ? "text-black/70" : "text-white/85",
            )}
          >
            <div className="relative ml-[70px] mt-0.5">
              <Image
                src="/images/Vector 945.png"
                alt=""
                width={46}
                height={79}
                className={cn(
                  "h-[78px] w-auto object-contain",
                  isLight && "invert",
                )}
              />
            </div>
            <div>Brands launch campaigns</div>
          </div>

          {/* =====================================================
            CENTER TEXT
        ===================================================== */}
          <div
            className={cn(
              "relative z-20 mx-auto mb-4 text-center font-['Comic_Sans_MS'] text-[14px] italic leading-[20px] sm:text-[16px] sm:leading-[22px] lg:absolute lg:left-1/2 lg:top-[5px] lg:mb-0 lg:-translate-x-1/2 lg:whitespace-nowrap lg:text-[17px] lg:leading-[24px]",
              isLight ? "text-black/70" : "text-white/85",
            )}
          >
            Creator create content
            <br />
            that performs
          </div>

          {/* =====================================================
            CENTRAL CREATOR CARD
        ===================================================== */}
          <div
            className={cn(
              "relative z-20 mx-auto h-[380px] w-[min(100%,280px)] overflow-hidden rounded-[24px] sm:h-[420px] sm:w-[300px] lg:absolute lg:left-1/2 lg:top-[105px] lg:mx-0 lg:h-[455px] lg:w-[335px] lg:-translate-x-1/2",
              isLight
                ? "border border-black/[0.06] bg-white shadow-[inset_0px_5px_4px_2px_#575757CC]"
                : "border border-white/[0.10] bg-[#191919] shadow-[0_30px_100px_rgba(0,0,0,0.65)]",
            )}
          >
            <Image
              src="/images/39e512460e9052a19bf4ea8b3ca0c6cdd8086315.png"
              alt="Creators"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 300px, 335px"
              priority
            />
            <span className="absolute bottom-3 left-3 z-10 text-[11px] text-white/70">
              creator
            </span>
          </div>

          {/* =====================================================
            RIGHT ANALYTICS CARD
        ===================================================== */}
          <div
            className={cn(
              "absolute right-[2%] top-[130px] z-20 hidden w-[240px] rotate-[-15deg] rounded-[22px] p-4 xl:right-[4%] xl:w-[280px] lg:block",
              isLight
                ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_6.02px_0px_#FFFFFF40]"
                : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
            )}
          >
            {/* Tabs */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-1 text-[11px]",
                isLight ? "text-black/35" : "text-white/35",
              )}
            >
              <span
                className={cn(
                  "rounded-[9px] px-3 py-[9px]",
                  isLight
                    ? "bg-black/[0.06] text-black/80"
                    : "bg-white/[0.08] text-white/80",
                )}
              >
                Overview
              </span>

              <span className="px-2">Submissions</span>

              <span className="px-2">Analytics</span>
            </div>

            {/* Stats */}
            <div className="mt-7 flex items-end justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      "text-[25px] font-medium tracking-[-1px]",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    46.2M
                  </span>
                  <span
                    className={cn(
                      "text-[10px]",
                      isLight ? "text-black/45" : "text-white/50",
                    )}
                  >
                    Views
                  </span>
                </div>

                <div
                  className={cn(
                    "mt-3 max-w-[120px] text-[12px] leading-[15px]",
                    isLight ? "text-black/40" : "text-white/35",
                  )}
                >
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
                          : isLight
                            ? "bg-gradient-to-b from-[#d4d4d4] to-[#b8b8b8]"
                            : "bg-gradient-to-b from-[#5a5a5a] to-[#2e2e2e]"
                      }`}
                    />
                    <span
                      className={cn(
                        "origin-top text-[10px]",
                        isLight ? "text-black/40" : "text-white/35",
                      )}
                    >
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
          <div
            className={cn(
              "absolute right-[6%] top-[10px] z-20 hidden rotate-[3deg] text-center font-['Comic_Sans_MS'] text-[17px] italic leading-[24px] xl:right-[10%] lg:block",
              isLight ? "text-black/70" : "text-white/85",
            )}
          >
            Performance drives
            <br />
            real results
            <div className="mt-0.5 flex justify-center">
              <Image
                src="/images/Vector 946.png"
                alt=""
                width={42}
                height={81}
                className={cn(
                  "h-[78px] w-auto object-contain",
                  isLight && "invert",
                )}
              />
            </div>
          </div>
        </section>

        {/* =========================================================
          BRAND LOGOS STRIP
      ========================================================= */}
        <section
          className={cn(
            "overflow-hidden pb-14 pt-2 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-black",
          )}
        >
          <p
            className={cn(
              "mb-6 px-4 text-center text-sm sm:mb-8 sm:text-base",
              isLight ? "text-black/45" : "text-zinc-500",
            )}
          >
            Work with Top Brands and Creators
          </p>

          <div className="relative mx-auto w-full max-w-[1100px] overflow-hidden">
            <div className="flex w-max animate-scroll-left items-center gap-10 py-3 sm:gap-14 md:gap-16">
              {[...brandImages, ...brandImages].map((image, index) => {
                const isCircle = image.includes("image 276");
                return (
                  <div
                    key={`${image}-${index}`}
                    className={cn(
                      "flex shrink-0 items-center justify-center",
                      isCircle
                        ? "h-12 w-12 sm:h-14 sm:w-14"
                        : "h-10 w-[120px] sm:h-12 sm:w-[150px] md:h-14 md:w-[180px]",
                    )}
                  >
                    <Image
                      src={image}
                      alt={`Brand logo ${index + 1}`}
                      width={isCircle ? 50 : 180}
                      height={isCircle ? 56 : 56}
                      className={cn(
                        "h-full w-full object-contain",
                        isCircle && "rounded-full",
                        isLight && !isCircle && "brightness-0",
                      )}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================
          CONTACT ANCHOR
      ========================================================= */}
        <div id="contact" className="absolute bottom-0 left-0" />
      </main>

      <main
        className={cn(
          "min-h-screen px-4 py-16 sm:px-5 sm:py-20 md:py-24 transition-colors duration-300",
          isLight ? "bg-transparent text-black" : "bg-black text-white",
        )}
      >
        <section className="mx-auto max-w-[1200px]">
          {/* =====================================================
            HEADING
        ===================================================== */}
          <h1
            className={cn(
              "mx-auto max-w-[650px] text-center text-[32px] font-semibold leading-[1.08] tracking-[-1.5px] sm:text-[40px] sm:tracking-[-2px] md:text-[52px] md:tracking-[-2.5px]",
              isLight ? "text-black" : "text-white",
            )}
          >
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
            <div
              className={cn(
                "relative min-h-[510px] overflow-hidden rounded-[20px] px-5 pt-7 sm:min-h-[555px] sm:rounded-[25px] sm:px-9 sm:pt-9 md:h-[580px] md:min-h-0",
                isLight
                  ? "border border-black/[0.04] bg-[#f5f5f7] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                  : "border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]",
              )}
            >
              {/* Bottom white shade */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-24 sm:h-28"
              >
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-full",
                    isLight
                      ? "bg-[radial-gradient(ellipse_at_bottom,rgba(124,58,237,0.06)_0%,transparent_70%)]"
                      : "bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_40%,transparent_72%)]",
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-14 sm:h-16",
                    isLight
                      ? "bg-gradient-to-t from-white/70 via-transparent to-transparent"
                      : "bg-gradient-to-t from-white/[0.10] via-white/[0.03] to-transparent",
                  )}
                />
              </div>

              {/* Badge */}
              <div
                className={cn(
                  "relative z-[2] inline-flex rounded-full border px-3 py-[6px] text-[13px]",
                  isLight
                    ? "border-black/[0.08] bg-white text-black/60"
                    : "border-white/[0.08] bg-[#353535] text-white/65",
                )}
              >
                For Brands
              </div>

              {/* Title */}
              <h2
                className={cn(
                  "mt-5 max-w-[440px] text-[20px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]",
                  isLight ? "text-black" : "text-white",
                )}
              >
                Pay for actual performance, not
                <br className="hidden sm:block" /> followers
              </h2>

              {/* Description */}
              <p
                className={cn(
                  "mt-3 max-w-[500px] text-[14px] leading-[21px] sm:text-[16px] sm:leading-[23px]",
                  isLight ? "text-black/50" : "text-white/45",
                )}
              >
                Set your budget and brief. Your campaign runs across a network
                <br className="hidden xl:block" />
                of 15,700+ creators, and you pay for verified content and
                <br className="hidden xl:block" />
                performance.
              </p>

              <BrandFormMockup isLight={isLight} />
            </div>

            {/* =================================================
              CREATORS CARD
          ================================================= */}
            <div
              className={cn(
                "relative min-h-[510px] overflow-hidden rounded-[20px] px-5 pt-7 sm:min-h-[555px] sm:rounded-[25px] sm:px-9 sm:pt-9 md:h-[580px] md:min-h-0",
                isLight
                  ? "border border-black/[0.04] bg-[#f5f5f7] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                  : "border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]",
              )}
            >
              {/* Bottom white shade */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-24 sm:h-28"
              >
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-full",
                    isLight
                      ? "bg-[radial-gradient(ellipse_at_bottom,rgba(124,58,237,0.06)_0%,transparent_70%)]"
                      : "bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.06)_40%,transparent_72%)]",
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-14 sm:h-16",
                    isLight
                      ? "bg-gradient-to-t from-white/70 via-transparent to-transparent"
                      : "bg-gradient-to-t from-white/[0.10] via-white/[0.03] to-transparent",
                  )}
                />
              </div>

              {/* Badge */}
              <div
                className={cn(
                  "relative z-[2] inline-flex rounded-full border px-3 py-[6px] text-[13px]",
                  isLight
                    ? "border-black/[0.08] bg-white text-black/60"
                    : "border-white/[0.08] bg-[#353535] text-white/65",
                )}
              >
                For Creators
              </div>

              {/* Title */}
              <h2
                className={cn(
                  "mt-5 max-w-[450px] text-[20px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]",
                  isLight ? "text-black" : "text-white",
                )}
              >
                Get paid for performance, not
                <br className="hidden sm:block" /> followers.
              </h2>

              {/* Description */}
              <p
                className={cn(
                  "mt-3 max-w-[510px] text-[14px] leading-[21px] sm:text-[16px] sm:leading-[23px]",
                  isLight ? "text-black/50" : "text-white/45",
                )}
              >
                Pick brand campaigns you want. You get paid based on how well
                <br className="hidden xl:block" />
                your posts do even if you have 0 followers
              </p>

              {/* =================================================
                PAYMENT POPUP - LEFT
            ================================================= */}
              <div
                className={cn(
                  "absolute left-3 top-[252px] z-30 flex w-[min(200px,48%)] items-center justify-between rounded-[30px] border px-2 py-2 sm:left-[25px] sm:top-[286px] sm:w-[225px] sm:px-3",
                  isLight
                    ? "border-black/[0.08] bg-white shadow-[0_12px_35px_rgba(20,16,40,0.12)]"
                    : "border-white/[0.08] bg-[#191919] shadow-[0_12px_35px_rgba(0,0,0,.45)]",
                )}
              >
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
                    <div
                      className={cn(
                        "truncate text-[10px] font-medium",
                        isLight ? "text-black" : "text-white",
                      )}
                    >
                      Hey Ashok
                    </div>

                    <div
                      className={cn(
                        "text-[8px] leading-[10px]",
                        isLight ? "text-black/40" : "text-white/35",
                      )}
                    >
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
              <div
                className={cn(
                  "absolute right-3 top-[252px] z-30 flex w-[min(200px,48%)] items-center justify-between rounded-[30px] border px-2 py-2 sm:right-[25px] sm:top-[286px] sm:w-[220px] sm:px-3",
                  isLight
                    ? "border-black/[0.08] bg-white shadow-[0_12px_35px_rgba(20,16,40,0.12)]"
                    : "border-white/[0.08] bg-[#191919] shadow-[0_12px_35px_rgba(0,0,0,.45)]",
                )}
              >
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
                    <div
                      className={cn(
                        "truncate text-[10px] font-medium",
                        isLight ? "text-black" : "text-white",
                      )}
                    >
                      Hey Riya!
                    </div>

                    <div
                      className={cn(
                        "text-[8px] leading-[10px]",
                        isLight ? "text-black/40" : "text-white/35",
                      )}
                    >
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
              <div className="absolute bottom-0 left-0 right-0 h-[272px] overflow-hidden">
                <div className="absolute inset-0 flex flex-col gap-[2px]">
                  <div className="relative min-h-0 flex-[135] overflow-hidden">
                    <div className="flex h-full animate-creators-collage-left">
                      {[0, 1].map((copy) => (
                        <div
                          key={`creators-collage-top-copy-${copy}`}
                          className="flex h-full shrink-0 gap-2 pr-2"
                        >
                          {creatorsCollageTopImages.map((src, index) => (
                            <Image
                              key={`creators-collage-top-${copy}-${index}`}
                              src={src}
                              alt=""
                              width={1280}
                              height={720}
                              className="h-full w-auto max-w-none shrink-0 object-cover"
                              sizes="320px"
                              priority={copy === 0 && index === 0}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="relative min-h-0 flex-[115] overflow-hidden">
                    <div className="flex h-full animate-creators-collage-right">
                      {[0, 1].map((copy) => (
                        <div
                          key={`creators-collage-bot-copy-${copy}`}
                          className="flex h-full shrink-0 gap-2 pr-2"
                        >
                          {creatorsCollageBottomImages.map((src, index) => (
                            <Image
                              key={`creators-collage-bot-${copy}-${index}`}
                              src={src}
                              alt=""
                              width={1280}
                              height={720}
                              className="h-full w-auto max-w-none shrink-0 object-cover"
                              sizes="320px"
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Left / right edge shades */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-20",
                    isLight
                      ? "bg-[linear-gradient(90deg,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_100%)]"
                      : "bg-[linear-gradient(90deg,rgba(0,0,0,0.87)_0%,rgba(57,57,57,0)_100%)]",
                  )}
                />
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 z-10 w-16 scale-x-[-1] sm:w-20",
                    isLight
                      ? "bg-[linear-gradient(90deg,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_100%)]"
                      : "bg-[linear-gradient(90deg,rgba(0,0,0,0.87)_0%,rgba(57,57,57,0)_100%)]",
                  )}
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Reasons to Select Us */}

      <section
        className={cn(
          "flex min-h-[50vh] items-center justify-center px-4 py-16 sm:min-h-[60vh] sm:px-6 sm:py-20 md:min-h-screen transition-colors duration-300",
          isLight ? "bg-transparent" : "bg-black",
        )}
      >
        <div className="flex w-full max-w-5xl flex-col items-center justify-center gap-12 sm:gap-16 md:flex-row md:gap-40">
          <HeroStatBlock
            numbers={CREATORS_NETWORK_NUMBERS}
            label="Creators Network"
            isLight={isLight}
          />
          <HeroStatBlock
            numbers={VIEWS_GENERATED_NUMBERS}
            label="Views Generated"
            isLight={isLight}
          />
        </div>
      </section>

      <FAQ />
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

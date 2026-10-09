"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ButtonLoadingSpinner } from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { Caveat } from "next/font/google";

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
import { SiYoutube, SiInstagram, SiTiktok } from "react-icons/si";
import { useSwipeable } from "react-swipeable";
import Testimonials from "./Testimonials";
import FAQ from "./FAQ";
import NumbersSection from "./NumberSection";
import { useThemeMode } from "@/hooks/use-theme-mode";

const FORM_DEMO_TITLE = "Podcasts Clipping Challenge (Dual Rewards)";
const FORM_DEMO_THUMB = "/images/9ec348288ce12767ffa9907081b7c37124c89470.png";
const FORM_DEMO_CURSOR = "/images/custom-arrow.png";
const FORM_DEMO_CAMPAIGN_TYPES = [
  "Leaderboard",
  "CPM",
  "Milestone",
  "Dual Rewards",
] as const;

type FormCursorTarget =
  | "title"
  | "budget"
  | "launch"
  | "platform"
  | "platformYoutube"
  | "campaignType"
  | "campaignTypeMilestone"
  | "thumbnail"
  | "creatorCard";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function BrandFormMockup({ isLight }: { isLight: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLDivElement>(null);
  const budgetRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLDivElement>(null);
  const platformRef = useRef<HTMLDivElement>(null);
  const platformYoutubeRef = useRef<HTMLDivElement>(null);
  const campaignTypeRef = useRef<HTMLDivElement>(null);
  const milestoneRef = useRef<HTMLDivElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [briefLine1, setBriefLine1] = useState("");
  const [briefLine2, setBriefLine2] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<"YouTube" | "Instagram" | "TikTok" | null>(null);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null);
  const [platformReady, setPlatformReady] = useState(false);
  const [typeReady, setTypeReady] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [hoveredCampaignType, setHoveredCampaignType] = useState<string | null>(
    null,
  );
  const [selectedCampaignType, setSelectedCampaignType] = useState<
    (typeof FORM_DEMO_CAMPAIGN_TYPES)[number] | null
  >(null);
  const [budgetText, setBudgetText] = useState("$0");
  const [budgetTyping, setBudgetTyping] = useState(false);
  const [showThumb, setShowThumb] = useState(false);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [rocketFlying, setRocketFlying] = useState(false);
  const [demoKey, setDemoKey] = useState(0);

  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 40, y: 320 });
  const [showClickBurst, setShowClickBurst] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursorRef.current) return;
    if (!cursorVisible) {
      gsap.to(cursorRef.current, { opacity: 0, duration: 0.25, ease: "power1.out" });
      return;
    }
    gsap.to(cursorRef.current, {
      left: cursorPos.x,
      top: cursorPos.y,
      opacity: 1,
      scale: cursorClicking ? 0.88 : 1,
      duration: 0.55,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, [cursorPos, cursorVisible, cursorClicking]);

  useEffect(() => {
    if (!budgetRef.current) return;
    const tween = gsap.to(budgetRef.current, {
      y: -5,
      duration: 2.2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [step]);

  const getTargetPos = (target: FormCursorTarget | "brief" | "continue") => {
    const root = rootRef.current;
    if (!root) return null;
    if (target === "creatorCard") {
      const rootRect = root.getBoundingClientRect();
      return {
        x: rootRect.width + 180,
        y: 350,
      };
    }
    const el =
      target === "title"
        ? titleRef.current
        : target === "brief"
          ? briefRef.current
          : target === "continue"
            ? continueRef.current
            : target === "budget"
              ? budgetRef.current
              : target === "platform"
                ? platformRef.current
                : target === "platformYoutube"
                  ? platformYoutubeRef.current || platformRef.current
                  : target === "campaignType"
                    ? campaignTypeRef.current
                    : target === "campaignTypeMilestone"
                      ? milestoneRef.current || campaignTypeRef.current
                      : target === "thumbnail"
                        ? thumbnailRef.current
                        : launchRef.current;
    if (!el) return null;
    const rootRect = root.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.55 - rootRect.left,
      y: rect.top + rect.height * 0.55 - rootRect.top,
    };
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(1);
      setTitle(FORM_DEMO_TITLE);
      setBriefLine1("Turn standout podcast moments into engaging short-form clips.");
      setBriefLine2("Reward creators as their videos reach campaign milestones.");
      setSelectedPlatform("YouTube");
      setPlatformReady(true);
      setTypeReady(true);
      setSelectedCampaignType("Milestone");
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

    const moveCursorTo = async (target: FormCursorTarget | "brief" | "continue") => {
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
      // STEP 1: Details
      setStep(1);
      setTitle("");
      setBriefLine1("");
      setBriefLine2("");
      setSelectedPlatform(null);
      setPlatformDropdownOpen(false);
      setHoveredPlatform(null);
      setPlatformReady(false);
      setTypeReady(false);
      setTypeDropdownOpen(false);
      setSelectedCampaignType(null);
      setHoveredCampaignType(null);
      setBudgetText("$0");
      setBudgetTyping(false);
      setShowThumb(false);
      setIsDraggingThumb(false);
      setRocketFlying(false);
      setCursorVisible(false);
      setCursorClicking(false);
      setShowClickBurst(false);
      setCursorPos({ x: 48, y: 300 });

      await wait(450);
      if (cancelled) return;

      // 1. Cursor types title
      await moveCursorTo("title");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      const fullTitle = "Podcast Clipping Challenge (Milestone)";
      for (let i = 1; i <= fullTitle.length; i++) {
        if (cancelled) return;
        setTitle(fullTitle.slice(0, i));
        await wait(36);
      }

      await wait(300);
      if (cancelled) return;

      // 2. Cursor types brief lines
      await moveCursorTo("brief");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      const line1Str = "Turn standout podcast moments into engaging short-form clips.";
      for (let i = 1; i <= line1Str.length; i++) {
        if (cancelled) return;
        setBriefLine1(line1Str.slice(0, i));
        await wait(28);
      }

      await wait(200);
      if (cancelled) return;

      const line2Str = "Reward creators as their videos reach campaign milestones.";
      for (let i = 1; i <= line2Str.length; i++) {
        if (cancelled) return;
        setBriefLine2(line2Str.slice(0, i));
        await wait(28);
      }

      await wait(400);
      if (cancelled) return;

      // 3. Cursor clicks Continue on Step 1 -> move to Step 2 (Budget)
      await moveCursorTo("continue");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      // STEP 2: Budget
      setStep(2);
      await wait(400);
      if (cancelled) return;

      // 4. Cursor types Budget in Step 2
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

      await wait(600);
      if (cancelled) return;

      // STEP 3: Settings & Launch
      setStep(3);
      await wait(400);
      if (cancelled) return;

      // 5. Cursor selects Platform -> YouTube
      await moveCursorTo("platform");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;
      setPlatformDropdownOpen(true);

      await wait(350);
      if (cancelled) return;
      await moveCursorTo("platformYoutube");
      if (cancelled) return;
      setHoveredPlatform("YouTube");
      await clickCursor();
      if (cancelled) return;

      setSelectedPlatform("YouTube");
      setPlatformReady(true);

      await wait(350);
      if (cancelled) return;
      setPlatformDropdownOpen(false);
      setHoveredPlatform(null);

      await wait(350);
      if (cancelled) return;

      // 6. Cursor selects Campaign type -> Milestone
      await moveCursorTo("campaignType");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;
      setTypeDropdownOpen(true);

      await wait(350);
      if (cancelled) return;
      await moveCursorTo("campaignTypeMilestone");
      if (cancelled) return;
      setHoveredCampaignType("Milestone");
      await clickCursor();
      if (cancelled) return;

      setSelectedCampaignType("Milestone");
      setTypeReady(true);

      await wait(350);
      if (cancelled) return;
      setTypeDropdownOpen(false);
      setHoveredCampaignType(null);

      await wait(350);
      if (cancelled) return;

      // 7. Cursor drags Creator Card to Thumbnail upload box
      await moveCursorTo("creatorCard");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      setIsDraggingThumb(true);
      await moveCursorTo("thumbnail");
      if (cancelled) return;
      await clickCursor();
      if (cancelled) return;

      setIsDraggingThumb(false);
      setShowThumb(true);
      await wait(450);
      if (cancelled) return;

      // 8. Cursor clicks Launch
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
      {/* FORM MOCKUP - SHOWN IN STEP 1 & STEP 3 */}
      {step === 1 || step === 3 ? (
        <div
          className={cn(
            "absolute left-2 right-2 top-[248px] h-[440px] overflow-visible rounded-[14px] border p-[17px] sm:left-[24px] sm:right-[24px] sm:top-[266px] min-[800px]:left-[16px] min-[800px]:right-[16px] min-[800px]:top-[260px] lg:left-[24px] lg:right-[24px] xl:left-[44px] xl:right-[44px]",
            isLight
              ? "border-[#E0E0E0] bg-[#F5F5F5] text-black shadow-lg"
              : "border-[#353535] bg-[#131313] text-white",
          )}
        >
          {step === 1 ? (
            /* STEP 1: DETAILS FORM */
            <div className="flex flex-col gap-3.5 animate-form-dropdown-in">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[14px] font-medium",
                      isLight ? "text-black" : "text-white",
                    )}
                  >
                    Details
                  </span>
                </div>
                <div
                  ref={continueRef}
                  className={cn(
                    "flex items-center justify-center rounded-full px-3 py-1 text-[12px] font-medium transition-all duration-300",
                    isLight
                      ? "bg-[#353535] text-white"
                      : "bg-[#F1F1F1] text-[#353535]",
                  )}
                >
                  <span>Continue</span>
                </div>
              </div>

              {/* Campaign title input */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[12px] font-medium text-[#C4C4C4]">
                    <span>Campaign title</span>
                    <span className="text-[#EF4444]">*</span>
                  </div>
                  <span className="text-[9px] text-[#9E9AA6] ">
                    {title.length}/100
                  </span>
                </div>
                <div
                  ref={titleRef}
                  className={cn(
                    "relative flex h-[34px] items-center rounded-[5.72px] border px-3 text-[10px] transition-colors duration-300",
                    isLight
                      ? "border-[#E5E5E5] bg-white text-black/85"
                      : "border-[#353535] bg-[#222222] text-white/85",
                  )}
                >
                  {title ? (
                    <span className="inline-flex items-center truncate">
                      <span>{title}</span>
                      {title.length < 38 ? (
                        <span className="ml-0.5 inline-block h-3.5 w-[1.5px] shrink-0 animate-form-caret bg-white" />
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-[#8E8E8E]">
                      e.g. Create a Viral shorts/video for our New App
                    </span>
                  )}
                </div>
              </div>

              {/* Brief input */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[12px] font-medium text-[#C4C4C4]">
                  Brief
                </div>
                <div
                  ref={briefRef}
                  className={cn(
                    "flex flex-col gap-2 rounded-[5.72px] border p-3 transition-colors duration-300",
                    isLight
                      ? "border-[#E5E5E5] bg-white"
                      : "border-[#353535] bg-[#222222]",
                  )}
                >
                  {/* Toolbar icons */}
                  <div className="flex items-center gap-2.5 text-[#757575] text-[11px]">
                    <span className="font-bold">B</span>
                    <span className="italic font-serif">I</span>
                    <span className="underline">U</span>
                    <span>≡</span>
                    <span>🔗</span>
                    <span>“</span>
                  </div>

                  {/* Editor textarea */}
                  <div
                    className={cn(
                      "relative h-[115px] overflow-hidden rounded-[4px] p-2.5 text-[10px] leading-[15px]",
                      isLight
                        ? "bg-[#F9F9F9] text-black/80"
                        : "bg-[#2C2C2C] text-white/90",
                    )}
                  >
                    {!briefLine1 ? (
                      <span className="text-[#8E8E8E]">
                        Write a Brief that creators will follow
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1 text-white/90">
                        <div className="inline-flex items-center">
                          <span>{briefLine1}</span>
                          {!briefLine2 && briefLine1.length > 0 ? (
                            <span className="ml-0.5 inline-block h-3 w-[1.5px] shrink-0 animate-form-caret bg-white" />
                          ) : null}
                        </div>
                        {briefLine2 ? (
                          <div className="inline-flex items-center">
                            <span>{briefLine2}</span>
                            {briefLine2.length < 55 ? (
                              <span className="ml-0.5 inline-block h-3 w-[1.5px] shrink-0 animate-form-caret bg-white" />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 3: CAMPAIGN SETTINGS & LAUNCH FORM */
            <div className="flex flex-col gap-3.5 animate-form-dropdown-in">
              {/* Launch header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[14px] font-medium text-white">
                  <span>Details</span>
                </div>

                  <div ref={launchRef} className="absolute right-0">
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
              </div>

              {/* Platform + Campaign Type */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3.5">
                <div className="relative min-w-0" ref={platformRef}>
                  <label className="text-[11px] sm:text-[12px] font-medium text-[#C4C4C4] flex items-center gap-1">
                    <span>Platform</span>
                    <span className="text-[#EF4444]">*</span>
                  </label>
                  <div
                    className={cn(
                      "mt-1.5 flex h-[34px] items-center justify-between rounded-md border px-2 sm:px-3 text-[10px] sm:text-[11px] cursor-pointer min-w-0",
                      isLight ? "bg-white border-[#E5E5E5]" : "bg-[#222222] border-[#353535] text-white",
                    )}
                  >
                    <span className="flex items-center gap-1 sm:gap-1.5 min-w-0 truncate">
                      {selectedPlatform === "YouTube" ? (
                        <SiYoutube className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#737373] shrink-0" />
                      ) : selectedPlatform === "Instagram" ? (
                        <SiInstagram className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#737373] shrink-0" />
                      ) : selectedPlatform === "TikTok" ? (
                        <SiTiktok className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#737373] shrink-0" />
                      ) : null}
                      <span className={cn(selectedPlatform ? "text-white" : "text-white/45", "truncate whitespace-nowrap")}>
                        {selectedPlatform ?? "Select platform"}
                      </span>
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/45 shrink-0 ml-1" />
                  </div>

                  {platformDropdownOpen ? (
                    <div
                      className={cn(
                        "absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border py-1 shadow-lg min-w-full",
                        isLight ? "bg-white border-[#E5E5E5]" : "bg-[#292929] border-white/10",
                      )}
                    >
                      {[
                        { name: "YouTube", icon: <SiYoutube className="h-3.5 w-3.5 text-[#737373] shrink-0" /> },
                        { name: "Instagram", icon: <SiInstagram className="h-3.5 w-3.5 text-[#737373] shrink-0" /> },
                        { name: "TikTok", icon: <SiTiktok className="h-3.5 w-3.5 text-[#737373] shrink-0" /> },
                      ].map((p) => (
                        <div
                          key={p.name}
                          ref={p.name === "YouTube" ? platformYoutubeRef : null}
                          className={cn(
                            "flex h-[30px] items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 text-[10px] sm:text-[11px] cursor-pointer whitespace-nowrap",
                            hoveredPlatform === p.name
                              ? "bg-white/10 text-white"
                              : "text-white/70",
                          )}
                        >
                          {p.icon}
                          {p.name}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="relative min-w-0" ref={campaignTypeRef}>
                  <label className="text-[11px] sm:text-[12px] font-medium text-[#C4C4C4] block truncate">
                    Campaign type
                  </label>
                  <div
                    className={cn(
                      "mt-1.5 flex h-[34px] items-center justify-between rounded-md border px-2 sm:px-3 text-[10px] sm:text-[11px] cursor-pointer min-w-0",
                      isLight ? "bg-white border-[#E5E5E5]" : "bg-[#222222] border-[#353535] text-white",
                    )}
                  >
                    <span className={cn(selectedPlatform ? "text-white" : "text-white/45", "truncate whitespace-nowrap min-w-0 block")}>
                      {selectedCampaignType ?? "Select campaign type"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-white/45 shrink-0 ml-1" />
                  </div>

                  {typeDropdownOpen ? (
                    <div
                      className={cn(
                        "absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-md border py-1 shadow-lg min-w-full",
                        isLight ? "bg-white border-[#E5E5E5]" : "bg-[#292929] border-white/10",
                      )}
                    >
                      {FORM_DEMO_CAMPAIGN_TYPES.map((type) => (
                        <div
                          key={type}
                          ref={type === "Milestone" ? milestoneRef : null}
                          className={cn(
                            "flex h-[30px] items-center px-2.5 sm:px-3 text-[10px] sm:text-[11px] whitespace-nowrap",
                            hoveredCampaignType === type
                              ? "bg-white/10 text-white"
                              : "text-white/70",
                          )}
                        >
                          {type}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Thumbnail Box */}
              <div
                ref={thumbnailRef}
                className={cn(
                  "relative flex h-[140px] sm:h-[170px] items-center justify-center rounded-md border border-dashed px-2",
                  isLight ? "bg-white border-[#E5E5E5]" : "bg-[#222222] border-[#353535]",
                )}
              >
                {showThumb ? (
                  <div className="absolute inset-0 animate-form-thumb-in">
                    <Image src={FORM_DEMO_THUMB} alt="" fill className="object-cover" sizes="320px" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center max-w-full px-1">
                    <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white/30" />
                    <div className="mt-1 text-[10px] sm:text-[11px] text-white/45 truncate max-w-full">
                      Drag, drop or <span className="underline">browse</span> thumbnail
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* FLOATING BUDGET CARD - SHOWN IN STEP 2 ONLY */}
      {step === 2 ? (
        <div className="absolute top-[360px] left-1/2 -translate-x-1/2 z-40">
          <div
            ref={budgetRef}
            className={cn(
              "w-[160px] sm:w-[190px] rounded-[12px] sm:rounded-[14px] border p-3.5 animate-form-dropdown-in shadow-2xl ",
              isLight
                ? "border-[#0000000D] bg-[#ECECEC] text-black shadow-[0_10px_28px_rgba(20,16,40,0.08)]"
                : "border-white/[0.12] bg-[#1b1b1b] text-white shadow-[0_15px_35px_rgba(0,0,0,.45)]",
            )}
          >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[12px] sm:text-[14px] font-medium">
              <Image
                src="/images/Clip%20path%20group%20(2).png"
                alt="Budget icon"
                width={20}
                height={20}
                className="h-[16px] w-[16px] shrink-0 object-contain sm:h-[18px] sm:w-[18px]"
              />
              Budget
            </div>
          </div>

          <div
            className={cn(
              "mt-2.5 flex h-[32px] sm:h-[38px] items-center rounded-md border px-2.5 sm:px-3.5 text-[12px] sm:text-[14px] tabular-nums transition-all duration-200",
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
      </div>
      ) : null}

      {/* Animated cursor arrow — clicks fields, drags thumbnail from 2nd card, then Launch */}
      <div
        ref={cursorRef}
        aria-hidden
        className="pointer-events-none absolute z-50 opacity-0"
        style={{
          left: cursorPos.x,
          top: cursorPos.y,
          width: 28,
          height: 28,
        }}
      >
        {isDraggingThumb ? (
          <div className="pointer-events-none absolute -left-12 -top-10 h-14 w-24 overflow-hidden rounded-md border border-white/40 shadow-2xl rotate-[-6deg] animate-pulse">
            <Image
              src={FORM_DEMO_THUMB}
              alt=""
              fill
              className="object-cover"
            />
          </div>
        ) : null}

        {showClickBurst ? (
          <span className="pointer-events-none absolute -left-1 -top-1 h-5 w-5 animate-ping rounded-full bg-white/45" />
        ) : null}
        <Image
          src={FORM_DEMO_CURSOR}
          alt=""
          width={18}
          height={18}
          className="relative h-[18px] w-[18px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
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
  "2,000+",
  "5,000+",
  "9,000+",
  "14,000+",
  "18,000+",
  "21,000+",
];
const VIEWS_GENERATED_NUMBERS = [
  "10M+",
  "40M+",
  "75M+",
  "110M+",
  "140M+",
  "160M+",
];

function RollingDigitChar({
  char,
  isLight,
  delay = 0,
}: {
  char: string;
  isLight: boolean;
  delay?: number;
}) {
  const isDigit = /^[0-9]$/.test(char);
  const textGradient = isLight
    ? "bg-gradient-to-b from-black via-[#3a3a3a] to-[#9a9a9a]"
    : "bg-[linear-gradient(180deg,#555555_0%,#D8D8D8_45%,#FFFFFF_90%)]";

  if (!isDigit) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center bg-clip-text text-transparent select-none px-[0.02em]",
          textGradient,
        )}
      >
        {char}
      </span>
    );
  }

  const numericValue = parseInt(char, 10);

  return (
    <span className="relative inline-block h-[48px] sm:h-[64px] min-[800px]:h-[72px] lg:h-[92px] xl:h-[112px] overflow-hidden align-top select-none">
      <span
        className="flex flex-col transition-transform duration-450 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: `translateY(-${numericValue * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((val) => (
          <span
            key={val}
            className={cn(
              "flex h-[48px] sm:h-[64px] min-[800px]:h-[72px] lg:h-[92px] xl:h-[112px] shrink-0 items-center justify-center bg-clip-text text-transparent",
              textGradient,
            )}
          >
            {val}
          </span>
        ))}
      </span>
    </span>
  );
}

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
      { threshold: 0.05 },
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
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [animate, step, maxSteps]);

  const currentStr = numbers[step] || numbers[0];

  return (
    <div className="flex flex-col items-center text-center shrink-0" ref={containerRef}>
      <div className="flex items-center justify-center font-extrabold leading-none tracking-[-0.055em] text-[48px] sm:text-[64px] min-[800px]:text-[72px] lg:text-[92px] xl:text-[112px]">
        {currentStr.split("").map((ch, i) => (
          <RollingDigitChar
            key={`${i}-${currentStr.length}`}
            char={ch}
            isLight={isLight}
            delay={i * 25}
          />
        ))}
      </div>

      <p
        className={cn(
          "mt-3 sm:mt-5 text-[18px] font-semibold tracking-[-0.02em] sm:text-[22px] min-[800px]:text-[24px] lg:text-[29px]",
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

          {/* Orbit concentric rings using div elements */}
          <div
            className={cn(
              "absolute left-1/2 top-[0%] aspect-square w-[min(112vw,1080px)] max-w-none -translate-x-1/2 sm:top-[-4%] sm:w-[min(108vw,1180px)] lg:top-[-20%] lg:w-[min(98vw,1280px)]",
              isLight ? "opacity-45" : "opacity-100",
            )}
            aria-hidden
          >
            {/* Static inner gray orbit ring div */}
            <div
              className="absolute left-1/2 top-1/2 h-[84%] w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                padding: "5px",
                background:
                  "linear-gradient(180deg, rgba(37,37,37,0.07) 0%, rgba(88,88,88,0.37) 50%, rgba(139,139,139,0) 100%)",
                borderRadius: "50%",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            {/* Traveling glow arcs using div elements */}
            {!prefersReducedMotion ? (
              <>
                {/* Outer purple arc div */}
                <div
                  className="animate-hero-orbit-purple absolute left-1/2 top-1/2 h-[84%] w-[84%] rounded-full pointer-events-none"
                  style={{
                    padding: "5px",
                    background:
                      "conic-gradient(from 30.12deg, #BB00FF 0%, #BB00FF 1.5%, rgba(0, 0, 0, 0) 5%, rgba(0, 0, 0, 0) 100%)",
                    borderRadius: "50%",
                    WebkitMask:
                      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    boxShadow: "0 0 16px rgba(187, 0, 255, 0.5)",
                  }}
                />

                {/* Inner yellow/orange arc div */}
                <div
                  className="animate-hero-orbit-yellow absolute left-1/2 top-1/2 h-[98%] w-[98%] rounded-full pointer-events-none"
                  style={{
                    padding: "5px",
                    background:
                      "conic-gradient(from 274.65deg, #FF8800 0%, #FF8800 1.5%, rgba(0, 0, 0, 0) 5%, rgba(0, 0, 0, 0) 100%)",
                    borderRadius: "50%",
                    WebkitMask:
                      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    boxShadow: "0 0 16px rgba(255, 136, 0, 0.5)",
                  }}
                />
              </>
            ) : null}
          </div>
        </div>

        {/* =========================================================
          HERO
      ========================================================= */}

        <div className="relative z-20 mx-auto max-w-[1200px] px-6 lg:px-8">
          {/* Trusted */}
          <div className="flex justify-center pt-6 sm:pt-10 md:pt-14">
            <div className="flex items-center gap-1.5 sm:gap-2.5 max-w-full px-2">
              {/* Avatar 1 */}
              <div
                className={cn(
                  "relative z-10 h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 shrink-0 overflow-hidden rounded-full border-2 bg-white",
                  isLight ? "border-white" : "border-[#030303]",
                )}
              >
                <Image
                  src="/images/39da146881792a5ee763fad443e4c9b4c3e835a5.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 28px, 40px"
                />
              </div>

              {/* Avatar 2 */}
              <div
                className={cn(
                  "relative -ml-3 sm:-ml-4 md:-ml-5 h-7 w-7 sm:h-9 sm:w-9 md:h-10 md:w-10 shrink-0 overflow-hidden rounded-full border-2 bg-yellow-300",
                  isLight ? "border-white" : "border-[#030303]",
                )}
              >
                <Image
                  src="/images/7a17402e3a42cf5d6cf5d8f830d884ce8a940dcc.png"
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 28px, 40px"
                />
              </div>

              <span
                className={cn(
                  "ml-1 text-[13px] sm:text-[15px] md:text-[17px] font-medium leading-tight truncate sm:whitespace-nowrap",
                  isLight ? "text-black/55" : "text-[#C4C4C4]",
                )}
              >
                Trusted by Top Brands &amp; Creators
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mx-auto mt-5 sm:mt-7 max-w-[1000px] text-center px-2">
            <h1
              className={cn(
                "text-[24px] xs:text-[28px] sm:text-[40px] md:text-[52px] lg:text-[56px] font-['Inter'] font-bold leading-[120%] sm:leading-[115%] tracking-[-3%] sm:tracking-[-4%] text-center",
                isLight ? "text-black/75" : "text-white",
              )}
            >
              <span className={isLight ? "text-black/60" : "text-[#757575]"}>
                Creators earn on{" "}
              </span>
              <span className="inline-flex items-center gap-1 sm:gap-2">
                {/* Performance icon — opt out of text fill so the badge stays visible */}
                <span
                  className="
                    inline-flex
                    h-[34px]
                    w-[36px]
                    xs:h-[40px]
                    xs:w-[42px]
                    sm:h-[50px]
                    sm:w-[52px]
                    md:h-[60.64px]
                    md:w-[63.11px]
                    shrink-0
                    rotate-[8.81deg]
                    items-center
                    justify-center
                    rounded-[10px]
                    sm:rounded-[14px]
                    md:rounded-[16px]
                    bg-white/10
                    p-[2px]
                    sm:p-[2.47px]
                    shadow-[13.61px_13.61px_49.5px_0px_rgba(255,173,0,0.22),3.71px_4.95px_29.7px_0px_rgba(255,173,0,0.15),1.24px_3.71px_8.17px_0px_rgba(255,173,0,0.10),inset_0px_3.71px_4.95px_0px_rgba(255,255,255,0.25),inset_3.71px_-8.66px_4.95px_0px_rgba(255,210,210,0.05),inset_6.19px_-11.14px_13.36px_0px_rgba(255,244,244,0.25)]
                    overflow-hidden
                    [-webkit-text-fill-color:initial]
                  "
                >
                  <div
                    className="
                      flex
                      h-full
                      w-full
                      items-center
                      justify-center
                      rounded-[8px]
                      sm:rounded-[12px]
                      md:rounded-[14px]
                      bg-[linear-gradient(180deg,#FF8800_0%,#FFA53E_50%,#FFC27C_100%)]
                      shadow-[-1px_2px_4px_0px_rgba(0,0,0,0.25),inset_4.95px_4.95px_4.95px_0px_rgba(255,255,255,0.10)]
                      overflow-hidden
                    "
                  >
                    <Image
                      src="/images/Vector1234.png"
                      alt=""
                      width={32}
                      height={32}
                      className="h-[18px] w-[18px] xs:h-[22px] xs:w-[22px] sm:h-[26px] sm:w-[26px] md:h-[32px] md:w-[32px] object-contain"
                    />
                  </div>
                </span>
                <span className={isLight ? "text-black" : "text-white"}>
                  performance
                </span>
              </span>{" "}
              <br className="hidden xs:inline" />
              <span className={isLight ? "text-black/60" : "text-[#757575]"}>
                Brands grow on{" "}
              </span>
              <span className={isLight ? "text-black" : "text-white"}>
                results.
              </span>
            </h1>

            {/* Description */}
            <p
              className={cn(
                "mx-auto mt-4 sm:mt-6 md:mt-7 max-w-[600px] font-['Inter'] text-[13px] xs:text-[14px] sm:text-[16px] md:text-[17px] font-medium leading-[150%] tracking-[-0.51px] text-center px-3 sm:px-2",
                isLight ? "text-black/50" : "text-[#8E8E8E]",
              )}
            >
              Launch performance-driven campaigns that turn creator content into
              measurable results.
            </p>

            {/* =====================================================
              CTA BUTTONS
          ====================================================== */}

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row px-4">
              <Link
                href="/brands"
                className={cn(
                  "group flex h-[51px] w-full max-w-[300px] sm:w-[238px] items-center justify-center rounded-xl text-[15px] font-semibold transition",
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
                  "group flex h-[51px] w-full max-w-[300px] sm:w-[238px] items-center justify-center rounded-xl text-[15px] font-semibold transition",
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
        <section className="relative mx-auto w-full max-w-[1400px] px-4 pb-8 mt-6 sm:px-6 sm:pb-12 mt-14 sm:mt-18 lg:mt-24 lg:h-[550px] lg:px-0 lg:pb-0">
          {/* =====================================================
            MOBILE / TABLET 3 STEPS SHOWCASE (lg:hidden)
        ===================================================== */}
          <div className="relative z-20 flex flex-col items-center gap-10 md:grid md:grid-cols-3 md:gap-6 md:items-start lg:hidden">
            {/* STEP 1 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "mb-3 text-[22px] sm:text-[24px] leading-tight rotate-[-3deg]",
                  caveat.className,
                  isLight ? "text-black/70" : "text-white/85",
                )}
              >
                <div>Brands launch campaigns</div>
                <div className="mt-1 flex justify-center">
                  <Image
                    src="/images/Vector 945.png"
                    alt=""
                    width={40}
                    height={60}
                    className={cn(
                      "h-[50px] w-auto object-contain",
                      isLight && "invert",
                    )}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "w-[220px] sm:w-[240px] rotate-[4deg] rounded-[23px] p-[15px] transition-transform hover:rotate-0",
                  isLight
                    ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                    : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
                )}
              >
                {/* Card header */}
                <div className="flex items-center gap-2">
                   <div className="relative inline-flex items-center justify-center">
      {/* Outer purple glow */}
      {/* <div
        aria-hidden
        className="
          pointer-events-none absolute -inset-2
          rounded-lg
          bg-[radial-gradient(circle,rgba(187,0,255,0.45)_0%,transparent_70%)]
          opacity-55 blur-[10px]
        "
      /> */}

      {/* Badge */}
      <div
        className="
          relative flex h-[30px] w-[30px]
          items-center justify-center
          overflow-hidden rounded-[7px]
          border border-white/[0.07]
          bg-[#FFFFFF03]
          backdrop-blur-[8.853px]
        "
      >
        {/* Purple-to-gray bottom glow */}
        <div
          aria-hidden
          className="
            pointer-events-none absolute
            bottom-[-6px] left-1/2
            h-[14px] w-[78%]
            -translate-x-1/2 rounded-[100%]
            bg-[linear-gradient(180deg,rgba(187,0,255,0.6)_0%,rgba(217,217,217,0.55)_100%)]
            blur-[7px]
          "
        />

        <Image
          src="/images/users_icon.png"
          alt="Users"
          width={16}
          height={16}
          className={cn(
            "relative z-10 h-5 w-5 object-contain",
            isLight && "invert"
          )}
        />
      </div>
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
                    "mt-3 text-left text-[14px] sm:text-[15px] font-medium",
                    isLight ? "text-black" : "text-white",
                  )}
                >
                  Podcasts Clip Challenge
                </div>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-[7px]">
                  {["Clipping", "Paid", "Podcast"].map((tag) => (
                    <span
                      key={tag}
                      className={cn(
                        "rounded-full px-[9px] py-[5px] text-[11px] sm:text-[12px]",
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
                    className="h-[64px] w-[64px] rounded-md object-cover sm:h-[72px] sm:w-[72px]"
                  />

                  <div
                    className={cn(
                      "flex h-[35px] w-[35px] items-center justify-center rounded-full text-[18px]",
                      isLight
                        ? "bg-[#f3eaff] text-[#7c3aed]"
                        : "bg-[#351149] text-[#c239f5]",
                    )}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "mb-3 text-[22px] sm:text-[24px] leading-tight",
                  caveat.className,
                  isLight ? "text-black/70" : "text-white/85",
                )}
              >
                Creator create content
                <br />
                that performs
              </div>

              <div
                className={cn(
                  "relative h-[360px] w-[260px] sm:h-[400px] sm:w-[280px] overflow-hidden rounded-[24px]",
                  isLight
                    ? "border border-black/[0.06] bg-[#FFFFFF] shadow-[inset_0px_5px_4px_2px_#575757CC]"
                    : "border border-white/[0.10] bg-[#191919] shadow-[0_30px_100px_rgba(0,0,0,0.65)]",
                )}
              >
                <Image
                  src="/images/39e512460e9052a19bf4ea8b3ca0c6cdd8086315.png"
                  alt="Creators"
                  fill
                  className="object-cover object-[center_30%]"
                  sizes="280px"
                  priority
                />
                <span className="absolute bottom-3 left-3 z-10 text-[11px] text-white/70">
                  creator
                </span>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "mb-3 text-[22px] sm:text-[24px] leading-tight rotate-[2deg]",
                  caveat.className,
                  isLight ? "text-black/70" : "text-white/85",
                )}
              >
                Performance drives
                <br />
                real results
                <div className="mt-1 flex justify-center">
                  <Image
                    src="/images/Vector 946.png"
                    alt=""
                    width={40}
                    height={60}
                    className={cn(
                      "h-[50px] w-auto object-contain",
                      isLight && "invert",
                    )}
                  />
                </div>
              </div>

              <div
                className={cn(
                  "w-[240px] sm:w-[260px] rotate-[-4deg] rounded-[22px] p-4 transition-transform hover:rotate-0 text-left",
                  isLight
                    ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_6.02px_0px_#FFFFFF40]"
                    : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
                )}
              >
                {/* Tabs */}
                <div
                  className={cn(
                    "grid grid-cols-3 w-full items-center text-[11px]",
                    isLight ? "text-black/35" : "text-white/35",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center rounded-[8px] py-1.5 text-center font-medium",
                      isLight
                        ? "bg-black/[0.06] text-black/80 font-semibold"
                        : "bg-white/[0.08] text-white/80 font-semibold",
                    )}
                  >
                    Overview
                  </span>
                  <span className="flex items-center justify-center py-1.5 text-center">
                    Submissions
                  </span>
                  <span className="flex items-center justify-center py-1.5 text-center">
                    Analytics
                  </span>
                </div>

                {/* Stats */}
                <div className="mt-5 flex items-end justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={cn(
                          "text-[22px] sm:text-[25px] font-medium tracking-[-1px]",
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
                        "mt-2 max-w-[110px] text-[11px] leading-[14px]",
                        isLight ? "text-black/40" : "text-white/35",
                      )}
                    >
                      Your top 10% creators are getting the most views
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="flex items-end gap-[6px] pb-0.5">
                    {[
                      { label: "April", height: "h-[36px]", active: false },
                      { label: "May", height: "h-[24px]", active: false },
                      { label: "June", height: "h-[30px]", active: false },
                      { label: "July", height: "h-[48px]", active: true },
                    ].map((bar) => (
                      <div
                        key={bar.label}
                        className="flex flex-col items-center gap-1"
                      >
                        <div
                          className={`w-[12px] rounded-t-[3px] ${bar.height} ${
                            bar.active
                              ? "bg-[#3B82F6]"
                              : isLight
                                ? "bg-gradient-to-b from-[#d4d4d4] to-[#b8b8b8]"
                                : "bg-gradient-to-b from-[#5a5a5a] to-[#2e2e2e]"
                          }`}
                        />
                        <span
                          className={cn(
                            "origin-top text-[9px]",
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
            </div>
          </div>

          {/* =====================================================
            DESKTOP 3 STEPS ORBIT SHOWCASE (hidden on small screens, visible lg+)
        ===================================================== */}
          <div className="hidden lg:block relative h-[550px] w-full">
            {/* LEFT CAMPAIGN CARD */}
            <div
              className={cn(
                "absolute left-[2%] top-[35px] z-20 w-[200px] rotate-[7deg] rounded-[23px] p-[15px] xl:left-[4%] xl:w-[220px]",
                isLight
                  ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                  : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-2">
                <div className="relative inline-flex items-center justify-center">
      {/* Outer purple glow */}
      {/* <div
        aria-hidden
        className="
          pointer-events-none absolute -inset-2
          rounded-lg
          bg-[radial-gradient(circle,rgba(187,0,255,0.45)_0%,transparent_70%)]
          opacity-55 blur-[10px]
        "
      /> */}

      {/* Badge */}
      <div
        className="
          relative flex h-[30px] w-[30px]
          items-center justify-center
          overflow-hidden rounded-[7px]
          border border-white/[0.07]
          bg-[#FFFFFF03]
          backdrop-blur-[8.853px]
        "
      >
        {/* Purple-to-gray bottom glow */}
        <div
          aria-hidden
          className="
            pointer-events-none absolute
            bottom-[-6px] left-1/2
            h-[14px] w-[78%]
            -translate-x-1/2 rounded-[100%]
            bg-[linear-gradient(180deg,rgba(187,0,255,0.6)_0%,rgba(217,217,217,0.55)_100%)]
            blur-[7px]
          "
        />

        <Image
          src="/images/users_icon.png"
          alt="Users"
          width={16}
          height={16}
          className={cn(
            "relative z-10 h-5 w-5 object-contain",
            isLight && "invert"
          )}
        />
      </div>
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
                {["Clipping", "Paid", "Podcast"].map((tag) => (
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
                 <ArrowRight className="h-5 w-5"/>
                </div>
              </div>
            </div>

            {/* LEFT TEXT */}
            <div
              className={cn(
                "absolute left-[6%] top-[260px] z-20 rotate-[-4deg] text-[26px] xl:left-[9%]",
                caveat.className,
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

            {/* CENTER TEXT */}
            <div
              className={cn(
                "absolute left-1/2 top-[0px] z-20 -translate-x-1/2 whitespace-nowrap text-[24px] leading-[28px]",
                caveat.className,
                isLight ? "text-black/70" : "text-white/85",
              )}
            >
              Creator create content
              <br />
              that performs
            </div>

            {/* CENTRAL CREATOR CARD */}
            <div
              className={cn(
                "absolute left-1/2 top-[75px] z-20 h-[455px] w-[335px] -translate-x-1/2 overflow-hidden rounded-[24px]",
                isLight
                  ? "border border-black/[0.06] bg-[#FFFFFF] shadow-[inset_0px_5px_4px_2px_#575757CC]"
                  : "border border-white/[0.10] bg-[#191919] shadow-[0_30px_100px_rgba(0,0,0,0.65)]",
              )}
            >
              <Image
                src="/images/39e512460e9052a19bf4ea8b3ca0c6cdd8086315.png"
                alt="Creators"
                fill
                className="object-cover object-[center_30%]"
                sizes="335px"
                priority
              />
              <span className="absolute bottom-3 left-3 z-10 text-[11px] text-white/70">
                creator
              </span>
            </div>

            {/* RIGHT ANALYTICS CARD */}
            <div
              className={cn(
                "absolute right-[2%] top-[130px] z-20 w-[240px] rotate-[-15deg] rounded-[22px] p-4 xl:right-[4%] xl:w-[280px]",
                isLight
                  ? "border border-black/[0.06] bg-white shadow-[inset_0px_0px_6.02px_0px_#FFFFFF40]"
                  : "border border-white/[0.08] bg-[#1E1E1E] shadow-[inset_0_0_6.02px_0_#FFFFFF40]",
              )}
            >
              {/* Tabs */}
              <div
                className={cn(
                  "grid grid-cols-3 w-full items-center text-[11px]",
                  isLight ? "text-black/35" : "text-white/35",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-[8px] py-1.5 text-center font-medium",
                    isLight
                      ? "bg-black/[0.06] text-black/80 font-semibold"
                      : "bg-white/[0.08] text-white/80 font-semibold",
                  )}
                >
                  Overview
                </span>
                <span className="flex items-center justify-center py-1.5 text-center">
                  Submissions
                </span>
                <span className="flex items-center justify-center py-1.5 text-center">
                  Analytics
                </span>
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

            {/* RIGHT TEXT */}
            <div
              className={cn(
                "absolute right-[6%] top-[10px] z-20 rotate-[3deg] text-center text-[26px] leading-[28px] xl:right-[10%]",
                caveat.className,
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
          </div>
        </section>

        {/* =========================================================
          BRAND LOGOS STRIP
      ========================================================= */}
        <section
          className={cn(
            "overflow-hidden pb-14 pt-16 transition-colors duration-300",
            isLight ? "bg-[#F1F1F1]" : "bg-black",
          )}
        >
          <p
            className={cn(
              "mb-6 px-4 text-center text-[14px] sm:mb-8 sm:text-base",
              isLight ? "text-black/45" : "text-zinc-500",
            )}
          >
             Trusted by
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
          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 md:mt-[72px] min-[800px]:grid-cols-2">
            {/* =================================================
              BRANDS CARD
          ================================================= */}
            <div
              className={cn(
                "relative min-h-[510px] overflow-hidden rounded-[20px] px-3.5 pt-6 sm:min-h-[555px] sm:rounded-[25px] sm:px-9 sm:pt-9 min-[800px]:h-[580px] min-[800px]:min-h-0 md:h-[580px]",
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
                  "mt-5 max-w-[440px] text-[19px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]",
                  isLight ? "text-black" : "text-white",
                )}
              >
                Pay for actual performance, not{" "}
                <br className="hidden sm:block" /> followers
              </h2>

              {/* Description */}
              <p
                className={cn(
                  "mt-3 max-w-[500px] text-[13.5px] leading-[20px] sm:text-[16px] sm:leading-[23px]",
                  isLight ? "text-black/50" : "text-white/45",
                )}
              >
                Set your budget and brief. Your campaign runs across a network{" "}
                <br className="hidden xl:block" />
                of 15,700+ creators, and you pay for verified content and{" "}
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
                "relative min-h-[510px] overflow-hidden rounded-[20px] px-3.5 pt-6 sm:min-h-[555px] sm:rounded-[25px] sm:px-9 sm:pt-9 min-[800px]:h-[580px] min-[800px]:min-h-0 md:h-[580px]",
                isLight
                  ? "border border-black/[0.04] bg-[#f5f5f7] shadow-[inset_0px_0px_4.43px_0px_#FFFFFF40]"
                  : "border border-white/[0.10] bg-gradient-to-b from-[#191919] to-[#151515] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]",
              )}
            >
              {/* Bottom shade */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-24 sm:h-28"
              >
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-full",
                    isLight
                      ? "bg-[radial-gradient(ellipse_at_bottom,rgba(124,58,237,0.06)_0%,transparent_70%)]"
                      : "bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.4)_0%,transparent_72%)]",
                  )}
                />
                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-14 sm:h-16",
                    isLight
                      ? "bg-gradient-to-t from-white/70 via-transparent to-transparent"
                      : "",
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
                  "mt-5 max-w-[450px] text-[19px] font-medium leading-[1.25] tracking-[-0.6px] sm:text-[25px] sm:tracking-[-0.8px]",
                  isLight ? "text-black" : "text-white",
                )}
              >
                Get paid for performance, not{" "}
                <br className="hidden sm:block" /> followers.
              </h2>

              {/* Description */}
              <p
                className={cn(
                  "mt-3 max-w-[510px] text-[13.5px] leading-[20px] sm:text-[16px] sm:leading-[23px]",
                  isLight ? "text-black/50" : "text-white/45",
                )}
              >
                Pick brand campaigns you want. You get paid based on how well{" "}
                <br className="hidden xl:block" />
                your posts do even if you have 0 followers
              </p>

              {/* =================================================
                PAYMENT POPUP - LEFT
            ================================================= */}
              <div
                className={cn(
                  "absolute left-1.5 top-[215px] z-30 flex w-[calc(50%-8px)] max-w-[225px] items-center justify-between rounded-[30px] border px-1.5 py-1.5 sm:left-[25px] sm:top-[275px] sm:w-[225px] sm:px-3 sm:py-2 min-[800px]:left-2 min-[800px]:top-[275px] min-[800px]:w-[calc(50%-10px)] min-[800px]:max-w-[172px] min-[800px]:px-1.5 min-[800px]:py-1.5 lg:left-[25px] lg:top-[275px] lg:w-[220px] lg:max-w-[230px] lg:px-3.5 rotate-[-3.78deg]",
                  isLight
                    ? "border-black/[0.08] bg-white shadow-[0_12px_35px_rgba(20,16,40,0.12)]"
                    : "border-white/[0.08] bg-[#191919] shadow-[0_12px_35px_rgba(0,0,0,.45)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-1 sm:gap-2 min-[800px]:gap-1 lg:gap-1.5 xl:gap-2">
                  <div className="relative h-[25px] w-[25px] shrink-0 overflow-hidden rounded-full sm:h-[31px] sm:w-[31px] min-[800px]:h-[22px] min-[800px]:w-[22px] lg:h-[27px] lg:w-[27px] xl:h-[31px] xl:w-[31px]">
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
                        "truncate text-[9px] font-medium sm:text-[10px] min-[800px]:text-[8px] lg:text-[9.5px] xl:text-[10px]",
                        isLight ? "text-black" : "text-white",
                      )}
                    >
                      Hey Ashok
                    </div>

                    <div
                      className={cn(
                        "text-[7px] leading-[9px] sm:text-[8px] sm:leading-[10px] min-[800px]:text-[7px] min-[800px]:leading-[9px] lg:text-[10px] lg:leading-[9px] xl:text-[10px] xl:leading-[10px]",
                        isLight ? "text-black/40" : "text-[#8E8E93]",
                      )}
                    >
                      You can withdraw your
                      <br />
                      money now
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[9.5px] font-semibold text-[#43df3d] sm:text-[11px] sm:font-medium ml-0.5 min-[800px]:text-[8px] lg:text-[10px] xl:text-[11px]">
                  $44,090
                </span>
              </div>

              {/* =================================================
                PAYMENT POPUP - RIGHT
            ================================================= */}
              <div
                className={cn(
                  "absolute right-1.5 top-[215px] z-30 flex w-[calc(50%-8px)] max-w-[220px] items-center justify-between rounded-[30px] border px-1.5 py-1.5 sm:right-[25px] sm:top-[275px] sm:w-[220px] sm:px-3 sm:py-2 min-[800px]:right-2 min-[800px]:top-[275px] min-[800px]:w-[calc(50%-10px)] min-[800px]:max-w-[172px] min-[800px]:px-1.5 min-[800px]:py-1.5 lg:right-[25px] lg:top-[275px] lg:w-[225px] lg:max-w-[230px] lg:px-3.5 rotate-[2.85deg]",
                  isLight
                    ? "border-black/[0.08] bg-white shadow-[0_12px_35px_rgba(20,16,40,0.12)]"
                    : "border-white/[0.08] bg-[#191919] shadow-[0_12px_35px_rgba(0,0,0,.45)]",
                )}
              >
                <div className="flex min-w-0 items-center gap-1 sm:gap-2 min-[800px]:gap-1 lg:gap-1.5 xl:gap-2">
                  <div className="relative h-[25px] w-[25px] shrink-0 overflow-hidden rounded-full sm:h-[31px] sm:w-[31px] min-[800px]:h-[22px] min-[800px]:w-[22px] lg:h-[27px] lg:w-[27px] xl:h-[31px] xl:w-[31px]">
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
                        "truncate text-[9px] font-medium sm:text-[10px] min-[800px]:text-[8px] lg:text-[9.5px] xl:text-[10px]",
                        isLight ? "text-black" : "text-white",
                      )}
                    >
                      Hey Aditya!
                    </div>

                    <div
                      className={cn(
                        "text-[7px] leading-[9px] sm:text-[8px] sm:leading-[10px] min-[800px]:text-[7px] min-[800px]:leading-[7px] lg:text-[8px] lg:leading-[9px] xl:text-[10px] xl:leading-[10px]",
                        isLight ? "text-black/40" : "text-[#8E8E93]",
                      )}
                    >
                      Your rank 1st in Leader board Campaign
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[9.5px] font-semibold text-[#43df3d] sm:text-[11px] sm:font-medium ml-0.5 min-[800px]:text-[8px] lg:text-[10px] xl:text-[11px]">
                  $490
                </span>
              </div>

              {/* =================================================
                CREATOR CONTENT GRID
            ================================================= */}
              <div className="absolute bottom-0 left-0 right-0 h-[272px] overflow-hidden">
                <div className="absolute inset-0 flex flex-col gap-2.5">
                  <div className="relative min-h-0 flex-[135] overflow-hidden">
                    <div className="flex h-full animate-creators-collage-left">
                      {[0, 1].map((copy) => (
                        <div
                          key={`creators-collage-top-copy-${copy}`}
                          className="flex h-full shrink-0 gap-2.5 pr-2.5"
                        >
                          {creatorsCollageTopImages.map((src, index) => (
                            <Image
                              key={`creators-collage-top-${copy}-${index}`}
                              src={src}
                              alt=""
                              width={1280}
                              height={720}
                              className="h-full w-auto max-w-none shrink-0 rounded-lg object-cover"
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
                          className="flex h-full shrink-0 gap-2.5 pr-2.5"
                        >
                          {creatorsCollageBottomImages.map((src, index) => (
                            <Image
                              key={`creators-collage-bot-${copy}-${index}`}
                              src={src}
                              alt=""
                              width={1280}
                              height={720}
                              className="h-full w-auto max-w-none shrink-0 rounded-lg object-cover"
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
                    "pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24",
                    isLight
                      ? "bg-[linear-gradient(90deg,#f5f5f7_0%,rgba(245,245,247,0)_100%)]"
                      : "bg-[linear-gradient(90deg,#151515_0%,rgba(21,21,21,0)_100%)]",
                  )}
                />
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 right-0 z-10 w-16 scale-x-[-1] sm:w-24",
                    isLight
                      ? "bg-[linear-gradient(90deg,#f5f5f7_0%,rgba(245,245,247,0)_100%)]"
                      : "bg-[linear-gradient(90deg,#151515_0%,rgba(21,21,21,0)_100%)]",
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
          "flex min-h-[40vh] items-center justify-center px-4 py-16 sm:min-h-[50vh] sm:px-6 sm:py-20 md:min-h-screen transition-colors duration-300 overflow-hidden",
          isLight ? "bg-transparent" : "bg-black",
        )}
      >
        <div className="flex w-full max-w-6xl flex-col items-center justify-center gap-10 sm:gap-14 min-[800px]:flex-row min-[800px]:gap-10 lg:gap-24 xl:gap-36 px-4">
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

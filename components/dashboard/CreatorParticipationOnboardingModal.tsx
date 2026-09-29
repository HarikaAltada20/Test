"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Trophy,
  DollarSign,
  Target,
  Award,
  Megaphone,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CREATOR_CAMPAIGN_TYPES_VIDEO_ID,
  CREATOR_PARTICIPATION_VIDEO_ID,
  youtubeEmbedUrl,
} from "@/constants/creatorOnboarding";

export type CampaignContestTypeFilter =
  | "leaderboard"
  | "cpm"
  | "milestone"
  | "dual_rewards";

type ParticipationPillar = {
  title: string;
  description: string;
  tips?: string[];
};

type CampaignTypeCard = {
  icon: ReactNode;
  title: string;
  badge: string;
  summary: string;
  example: string;
  filterType: CampaignContestTypeFilter;
  actionLabel: string;
};

const participationPillars: ParticipationPillar[] = [
  {
    title: "Account Setup",
    description:
      "To start, link your social accounts (YouTube, Instagram, TikTok, Twitter) in Settings. This allows the platform to fetch your content and track your performance automatically.",
    tips: [
      "Connect the same account you will post from before submitting.",
      "Reconnect if you change channels or usernames.",
    ],
  },
  {
    title: "Campaign Participation",
    description:
      "Browse the Campaigns tab to find live campaigns. Always read the Briefs and Rules carefully before participating so your submissions are verified and eligible for rewards.",
    tips: [
      "Check platform, deadline, and campaign type before you create.",
      "Follow hashtags, mentions, and dos & don'ts from the brief.",
    ],
  },
  {
    title: "Verification & Tracking",
    description:
      "After posting, submit your link via the platform. Our team reviews entries within 24–48 hours. Use the Leaderboard and Refresh button to track live views and estimated earnings in real time.",
    tips: [
      "Submit your post URL as soon as you publish.",
      "Refresh metrics only when needed—views update on a schedule.",
    ],
  },
  {
    title: "Community & Support",
    description:
      "Need help or inspiration? Join our WhatsApp and Discord communities to engage with other creators. You can always reach out to support for any concerns.",
    tips: [
      "Ask experienced creators in Discord before your first submission.",
      "Email support if a submission is stuck in review past 48 hours.",
    ],
  },
];

const campaignTypeCards: CampaignTypeCard[] = [
  {
    icon: <Trophy className="w-6 h-6" />,
    title: "Leaderboard",
    badge: "Compete to win",
    summary:
      "Creators compete for a fixed prize pool. The top performers by verified views and engagement win the biggest prizes.",
    example:
      "Example: Top 3 might earn $500 / $300 / $200 from a $1,000 prize pool.",
    filterType: "leaderboard",
    actionLabel: "View Leaderboard campaigns",
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "CPM",
    badge: "Pay per 1K views",
    summary:
      "Earn a set rate for every 1,000 verified views. No ranking required—more views means more money.",
    example:
      "At $5 CPM: 10K views = $50 · 50K views = $250 · 100K views = $500.",
    filterType: "cpm",
    actionLabel: "View CPM campaigns",
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Milestone",
    badge: "Hit view targets",
    summary:
      "Unlock fixed cash rewards when your submission hits view milestones. You are paid for the highest milestone you reach.",
    example:
      "Example: 20K views = $15 · 50K views = $40 · 100K views = $80 — you earn the highest milestone your video reaches.",
    filterType: "milestone",
    actionLabel: "View Milestone campaigns",
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: "Dual Rewards",
    badge: "CPM + Milestones",
    summary:
      "Earn CPM on every 1,000 verified views and unlock milestone payouts when your video hits view targets—all on the same submission.",
    example:
      "At $0.20 CPM + $120 at 50K views: 50K views ≈ $10 CPM + $120 milestone = $130 total.",
    filterType: "dual_rewards",
    actionLabel: "View Dual Rewards campaigns",
  },
];

const steps = [
  {
    type: "intro" as const,
    title: "How to Participate in Campaigns",
    description:
      "Learn how to participate, watch the walkthrough, and explore the different campaign types.",
    readTime: "",
  },
  {
    type: "participation" as const,
    stepTitle: "How to Participate",
    stepDescription:
      "Link your accounts, join campaigns, track your progress, and get support when you need it.",
  },
  {
    type: "campaign-types-video" as const,
    stepTitle: "How You Can Earn",
    stepDescription:
      "Watch the intro video to understand how you can earn (in short).",
    videoId: CREATOR_CAMPAIGN_TYPES_VIDEO_ID,
    videoCaption: "",
    videoUpdatedOn: "September 2025",
  },
  {
    type: "campaign-types" as const,
    stepTitle: "Types of Campaigns",
    stepDescription:
      "Every campaign has a type that determines how you get paid. Here’s a quick breakdown of each one.",
  },
  {
    type: "participation-video" as const,
    stepTitle: "Watch Video",
    stepDescription: "Watch the full creator walkthrough.",
    videoId: CREATOR_PARTICIPATION_VIDEO_ID,
    videoCaption:
      "Full creator walkthrough — link accounts, join campaigns, track earnings & get support",
    videoUpdatedOn: "June 2026",
  },
];

function OnboardingVideo({
  videoId,
  caption,
  updatedOn,
  isDark,
  tall = false,
}: {
  videoId: string;
  caption: string;
  updatedOn?: string;
  isDark: boolean;
  tall?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full mx-auto space-y-2",
        tall ? "max-w-4xl" : "max-w-3xl",
      )}
    >
      <div
        className={cn(
          "rounded-2xl overflow-hidden border shadow-md w-full",
          tall
            ? "h-[min(50vh,400px)] sm:h-[min(58vh,520px)]"
            : "aspect-video",
          isDark ? "border-[#7F39EC]/40 bg-black" : "border-[#E9D8FF] bg-black",
        )}
      >
        <iframe
          key={videoId}
          src={youtubeEmbedUrl(videoId)}
          title={caption || "Creator onboarding video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>
      {(caption || updatedOn) && (
        <div className="text-center space-y-1">
          {caption ? (
            <p
              className={cn(
                "text-sm",
                isDark ? "text-gray-400" : "text-gray-600",
              )}
            >
              {caption}
            </p>
          ) : null}
          {updatedOn ? (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-500" : "text-gray-500",
              )}
            >
              Updated on {updatedOn}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CreatorParticipationOnboardingModal({
  open,
  onComplete,
  onApplyContestTypeFilter,
}: {
  open: boolean;
  onComplete: () => void;
  onApplyContestTypeFilter?: (type: CampaignContestTypeFilter) => void;
}) {
  const [step, setStep] = useState(0);
  const rightPanelScrollRef = useRef<HTMLDivElement>(null);
  const isIntro = step === 0;
  const isLastStep = step === steps.length - 1;
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open || isIntro) return;
    const panel = rightPanelScrollRef.current;
    if (!panel) return;
    panel.scrollTop = 0;
    panel.focus({ preventScroll: true });
  }, [open, step, isIntro]);

  useEffect(() => {
    if (!open || isIntro) return;
    const panel = rightPanelScrollRef.current;
    if (!panel) return;

    const handleWheel = (e: WheelEvent) => {
      if (!panel.contains(e.target as Node)) return;

      const { scrollTop, scrollHeight, clientHeight } = panel;
      if (scrollHeight <= clientHeight) return;

      const delta = e.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) return;

      e.preventDefault();
      e.stopPropagation();
      panel.scrollTop += delta;
    };

    document.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () =>
      document.removeEventListener("wheel", handleWheel, { capture: true });
  }, [open, step, isIntro]);

  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) setMode(currentMode);
      }
    };
    checkMode();
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    return () => observer.disconnect();
  }, []);

  const getModalWidth = () => {
    if (isIntro) return "max-w-2xl";
    return "max-w-6xl";
  };

  const isDark = mode === "dark";
  const cardStepCount = steps.length - 1;
  const current = steps[step];

  return (
    <Dialog open={open} isdark={isDark}>
      <DialogContent
        hideCloseButton
        className={cn(
          "w-[95vw] flex flex-col min-h-0 overflow-hidden p-0 gap-0 border-border shadow-2xl",
          getModalWidth(),
          isIntro ? "h-auto max-h-[90vh]" : "h-[90vh] max-h-[92vh]",
        )}
      >
          <button
            type="button"
            onClick={onComplete}
            className={cn(
              "absolute top-3 right-3 sm:top-4 sm:right-8 z-10 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-white/10"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
            )}
            aria-label="Skip onboarding"
          >
            Skip
          </button>
          <div
            className={cn(
              "w-full flex flex-col",
              !isIntro && "flex-1 min-h-0",
            )}
          >
            {isIntro ? (
              <div className="w-full px-4 sm:px-10 py-4 sm:py-6 flex flex-col items-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#7F39EC17] border border-[#7F39EC] text-[#7F39EC] rounded-full flex items-center justify-center">
                    <Megaphone className="w-9 h-9 sm:w-10 sm:h-10" />
                  </div>
                </div>
                <h1
                  className={cn(
                    "text-2xl sm:text-3xl font-bold text-center mb-3",
                    isDark ? "text-white" : "text-gray-800",
                  )}
                >
                  {steps[0].title}
                </h1>
                <p
                  className={cn(
                    "text-center text-base sm:text-lg max-w-md leading-relaxed",
                    isDark ? "text-gray-400" : "text-gray-600",
                  )}
                >
                  {steps[0].description}
                </p>

                <button
                  type="button"
                  className={cn(
                    "w-full max-w-md text-md rounded-full mt-8 py-3.5 sm:py-4 font-semibold",
                    isDark
                      ? "bg-[#7F39EC] text-white"
                      : "bg-[#D9C0FF61] text-[#7F39EC]",
                  )}
                  onClick={() => setStep(1)}
                >
                  <span className="flex items-center justify-center text-lg gap-2">
                    Start
                    <ArrowRight className="w-5 h-5" />
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                {/* Left stepper — compact numbered rail */}
                <div
                  className={cn(
                    "flex-shrink-0 w-full md:w-16 lg:w-[4.5rem] border-b md:border-b-0 md:border-r",
                    "flex flex-row md:flex-col items-center justify-center gap-1.5 py-4 md:py-8 px-2",
                    "overflow-x-auto md:overflow-visible",
                    isDark
                      ? "bg-[#100A33]/40 border-[#7F39EC]/20"
                      : "bg-gray-50 border-gray-100",
                  )}
                >
                  {steps.slice(1).map((sidebarStep, index) => {
                    const stepIndex = index + 1;
                    const isActive = step === stepIndex;
                    const isCompleted = step > stepIndex;
                    const title =
                      "stepTitle" in sidebarStep ? sidebarStep.stepTitle : "";

                    return (
                      <div
                        key={stepIndex}
                        className="flex flex-row md:flex-col items-center shrink-0"
                        title={title}
                      >
                        <div
                          className={cn(
                            "w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 transition-all duration-300",
                            isActive
                              ? "bg-[#7F39EC] text-white"
                              : isCompleted
                                ? "bg-[#7F39EC]/20 text-[#7F39EC]"
                                : isDark
                                  ? "bg-[#170337] text-gray-500"
                                  : "bg-white text-gray-400 border border-gray-200",
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            stepIndex
                          )}
                        </div>
                        {stepIndex < cardStepCount && (
                          <div
                            className={cn(
                              "hidden md:block w-0.5 h-10 rounded-full transition-colors duration-300",
                              isCompleted ? "bg-[#7F39EC]/50" : "bg-gray-200",
                              isDark && !isCompleted && "bg-gray-700",
                            )}
                          />
                        )}
                        {stepIndex < cardStepCount && (
                          <div
                            className={cn(
                              "md:hidden w-4 h-0.5 mx-0.5 rounded-full shrink-0",
                              isCompleted ? "bg-[#7F39EC]/50" : "bg-gray-200",
                              isDark && !isCompleted && "bg-gray-700",
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Main content — scrollable right panel */}
                <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
                  <div
                    ref={rightPanelScrollRef}
                    tabIndex={0}
                    onMouseEnter={() =>
                      rightPanelScrollRef.current?.focus({ preventScroll: true })
                    }
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar outline-none px-3 sm:px-6"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <div className="flex items-start gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setStep(step - 1)}
                        className="p-2 rounded-full hover:bg-accent transition-colors text-foreground shrink-0 mt-0.5"
                        aria-label="Back"
                      >
                        <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground text-sm">
                          Step {step} of {cardStepCount}
                        </span>
                        {"stepTitle" in current && current.stepTitle && (
                          <h2
                            className={cn(
                              "text-lg sm:text-xl font-semibold mt-0.5",
                              isDark ? "text-white" : "text-gray-800",
                            )}
                          >
                            {current.stepTitle}
                          </h2>
                        )}
                        {"stepDescription" in current &&
                          current.stepDescription && (
                            <p
                              className={cn(
                                "text-sm mt-1",
                                isDark ? "text-gray-400" : "text-gray-600",
                              )}
                            >
                              {current.stepDescription}
                            </p>
                          )}
                      </div>
                    </div>

                    <div className="w-full pb-4">
                    {current.type === "participation" ? (
                      <div className="w-full space-y-4 pb-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                          {participationPillars.map((pillar, idx) => (
                            <div
                              key={pillar.title}
                              className={cn(
                                "rounded-xl border p-4 flex flex-col gap-3 h-full",
                                isDark
                                  ? "bg-[#170337] border-[#7F39EC]/25"
                                  : "bg-white border-[#E9D8FF] shadow-sm",
                              )}
                            >
                              <div className="flex flex-col items-center text-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-[#D8C3FF] flex items-center justify-center text-[#4A00BE] font-bold text-sm">
                                  {idx + 1}
                                </div>
                                <h3
                                  className={cn(
                                    "font-bold",
                                    isDark ? "text-white" : "text-gray-900",
                                  )}
                                >
                                  {pillar.title}
                                </h3>
                              </div>
                              <p
                                className={cn(
                                  "text-sm leading-relaxed text-center flex-1",
                                  isDark ? "text-gray-300" : "text-gray-700",
                                )}
                              >
                                {pillar.description}
                              </p>

                              {pillar.tips && pillar.tips.length > 0 && (
                                <ul className="space-y-1">
                                  {pillar.tips.map((tip) => (
                                    <li
                                      key={tip}
                                      className={cn(
                                        "flex items-start gap-2 text-xs",
                                        isDark
                                          ? "text-gray-400"
                                          : "text-gray-600",
                                      )}
                                    >
                                      <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7F39EC]" />
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : current.type === "participation-video" ? (
                      <div className="w-full space-y-4 pb-2 max-w-3xl mx-auto">
                        <OnboardingVideo
                          videoId={current.videoId}
                          caption={current.videoCaption}
                          updatedOn={current.videoUpdatedOn}
                          isDark={isDark}
                        />
                      </div>
                    ) : current.type === "campaign-types" ? (
                      <div className="w-full space-y-4 pb-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                          {campaignTypeCards.map((card) => (
                            <div
                              key={card.filterType}
                              className={cn(
                                "rounded-2xl p-5 border flex flex-col h-full",
                                isDark
                                  ? "bg-[#170337] border-[#7F39EC]/30"
                                  : "bg-white border-[#E9D8FF] shadow-md",
                              )}
                            >
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-11 h-11 bg-[#D8C3FF] rounded-full flex items-center justify-center text-[#4A00BE]">
                                    {card.icon}
                                  </div>
                                  <div>
                                    <h3
                                      className={cn(
                                        "font-bold text-lg",
                                        isDark ? "text-white" : "text-gray-900",
                                      )}
                                    >
                                      {card.title}
                                    </h3>
                                    <span className="text-xs font-medium text-[#7F39EC]">
                                      {card.badge}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p
                                className={cn(
                                  "text-sm mb-3",
                                  isDark ? "text-gray-300" : "text-gray-700",
                                )}
                              >
                                {card.summary}
                              </p>
                              <div
                                className={cn(
                                  "rounded-lg p-3 text-sm mb-3 flex-1",
                                  isDark
                                    ? "bg-[#22074A]/80 text-gray-300"
                                    : "bg-[#F9F5FF] text-gray-700",
                                )}
                              >
                                <p>
                                  <span className="font-semibold text-[#7F39EC]">
                                    Example:{" "}
                                  </span>
                                  {card.example}
                                </p>
                              </div>
                              <button
                                type="button"
                                className={cn(
                                  "w-full rounded-full py-2.5 px-3 text-xs font-semibold border transition-colors",
                                  isDark
                                    ? "border-[#7F39EC] text-[#D8C3FF] hover:bg-[#7F39EC33]"
                                    : "border-[#7F39EC] text-[#7F39EC] hover:bg-[#D9C0FF61]",
                                )}
                                onClick={() =>
                                  onApplyContestTypeFilter?.(card.filterType)
                                }
                              >
                                {card.actionLabel}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : current.type === "campaign-types-video" ? (
                      <div className="w-full space-y-4 pb-2 max-w-4xl mx-auto">
                        <OnboardingVideo
                          videoId={current.videoId}
                          caption={current.videoCaption}
                          updatedOn={current.videoUpdatedOn}
                          isDark={isDark}
                          tall
                        />
                      </div>
                    ) : null}
                    </div>

                    <div className="w-full pt-2 pb-2">
                      <button
                        type="button"
                        className={cn(
                          "w-full text-lg rounded-full py-3.5 font-semibold",
                          isDark
                            ? "bg-[#7F39EC] text-white"
                            : "bg-[#D9C0FF61] text-[#7F39EC]",
                        )}
                        onClick={
                          isLastStep ? onComplete : () => setStep((s) => s + 1)
                        }
                      >
                        <span className="flex items-center justify-center gap-2">
                          {isLastStep ? "Got it — browse campaigns" : "Next"}
                          {!isLastStep && <ArrowRight className="w-5 h-5" />}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  );
}

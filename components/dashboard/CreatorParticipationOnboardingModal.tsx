"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import {
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Trophy,
  DollarSign,
  Target,
  Award,
  Search,
  BookOpen,
  Upload,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CampaignContestTypeFilter =
  | "leaderboard"
  | "cpm"
  | "milestone"
  | "dual_rewards";

type OnboardingCard = {
  icon: ReactNode;
  title: string;
  description: string;
  filterType?: CampaignContestTypeFilter;
  actionLabel?: string;
};

const steps = [
  {
    type: "intro" as const,
    title: "How to Participate in Campaigns",
    description:
      "A quick walkthrough on joining campaigns and how each campaign type pays creators on Game of Creators.",
    readTime: "2 min read",
    illustration: (
      <div className="flex justify-center mb-6">
        <div className="w-24 h-24 bg-[#7F39EC17] border border-[#7F39EC] text-[#7F39EC] rounded-full flex items-center justify-center">
          <Megaphone className="w-10 h-10" />
        </div>
      </div>
    ),
  },
  {
    type: "cards" as const,
    stepTitle: "How to Participate",
    stepDescription: "Follow these steps from browse to payout",
    cards: [
      {
        icon: <Search className="w-6 h-6" />,
        title: "1. Find a Campaign",
        description:
          "Browse campaigns and open a live one that matches your niche, platform, and content style.",
      },
      {
        icon: <BookOpen className="w-6 h-6" />,
        title: "2. Read the Brief",
        description:
          "Review the brief, rules, participation guidelines, and budget before submitting your content—each campaign has its own requirements.",
      },
      {
        icon: <Upload className="w-6 h-6" />,
        title: "3. Submit Your Content",
        description:
          "Publish on the required platform (YouTube, Instagram, TikTok or X), then submit your post link on the campaign page while it is live.",
      },
      {
        icon: <BarChart3 className="w-6 h-6" />,
        title: "4. Track & Get Paid",
        description:
          "Watch your rank and metrics update on the leaderboard. Payouts are processed after the campaign ends based on the campaign type.",
      },
    ],
  },
  {
    type: "cards" as const,
    stepTitle: "Types of Campaigns",
    // stepDescription: "Each campaign card shows its type—here is how each one works",
    cards: [
      {
        icon: <Trophy className="w-6 h-6" />,
        title: "Leaderboard",
        description:
          "Compete with other creators. Top performers by views and engagement win fixed prizes from the prize pool.",
        filterType: "leaderboard",
        actionLabel: "View Leaderboard campaigns",
      },
      {
        icon: <DollarSign className="w-6 h-6" />,
        title: "CPM",
        description:
          "Earn per 1,000 views at the campaign rate. More verified views mean more earnings—ranking is not required.",
        filterType: "cpm",
        actionLabel: "View CPM campaigns",
      },
      {
        icon: <Target className="w-6 h-6" />,
        title: "Milestone",
        description:
          "Hit view targets on your submission to unlock milestone payouts. You are paid for the highest milestone you reach.",
        filterType: "milestone",
        actionLabel: "View Milestone campaigns",
      },
      {
        icon: <Award className="w-6 h-6" />,
        title: "Dual Rewards",
        description:
          "One campaign, two payouts: CPM per 1,000 verified views and milestone payouts when you hit view targets.",
        filterType: "dual_rewards",
        actionLabel: "View Dual Rewards campaigns",
      },
    ] satisfies OnboardingCard[],
  },
];

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
  const isIntro = step === 0;
  const isCardsStep = step > 0;
  const isLastStep = step === steps.length - 1;
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

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
    if (step === 1) return "max-w-6xl";
    if (step === 2) return "max-w-6xl";
    return "max-w-3xl";
  };

  const isDark = mode === "dark";
  const cardStepCount = steps.length - 1;

  return (
    <Dialog open={open} isdark={isDark}>
      <DialogPortal>
        <DialogOverlay />
        <div
          className={`fixed p-6 left-1/2 top-1/2 z-50 w-[90vw] ${getModalWidth()} -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background border border-border shadow-2xl flex flex-col min-h-0 max-h-[90vh]`}
        >
          <div className="w-full flex flex-col flex-1 min-h-0">
            {!isIntro && (
              <div className="w-full px-6 pt-6 pb-4">
                <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                  <div
                    className={cn(
                      "w-12 h-12 text-md rounded-full flex items-center justify-center font-semibold transition-all duration-300",
                      step >= 1
                        ? "bg-[#7F39EC] text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {step > 1 ? <CheckCircle className="w-5 h-5" /> : "1"}
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-[#7F39EC] transition-all duration-500 ease-out"
                      style={{ width: step >= 2 ? "100%" : "30%" }}
                    />
                  </div>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center font-semibold text-md transition-all duration-300",
                      step >= 2
                        ? "bg-[#7F39EC] text-white"
                        : cn(
                            "bg-muted",
                            isDark ? "text-gray-300" : "text-gray-800",
                          ),
                    )}
                  >
                    {step >= 2 ? <CheckCircle className="w-5 h-5" /> : "2"}
                  </div>
                </div>
              </div>
            )}

            {!isIntro && (
              <div className="w-full px-4 sm:px-8 pt-4 flex items-center justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="p-2 rounded-full hover:bg-accent transition-colors duration-200 text-foreground"
                  aria-label="Back"
                  title="Back"
                >
                  <ArrowLeft className="w-6 h-6 text-foreground" />
                </button>
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-muted-foreground text-sm">
                    Step {step} of {cardStepCount}
                  </span>
                  {steps[step].stepTitle && (
                    <h2
                      className={cn(
                        "text-lg font-semibold mt-1",
                        isDark ? "text-white" : "text-gray-800",
                      )}
                    >
                      {steps[step].stepTitle}
                    </h2>
                  )}
                </div>
                <div className="w-8" />
              </div>
            )}

            <div
              className={cn(
                "w-full flex-1 min-h-0 flex flex-col items-center",
                isIntro ? "pt-8 pb-4" : "",
              )}
              style={{ height: isIntro ? "auto" : "100%", maxHeight: "100%" }}
            >
              {isIntro ? (
                <>
                  {steps[0].illustration}
                  <h1
                    className={cn(
                      "text-3xl font-bold text-center mb-2",
                      isDark ? "text-white" : "text-gray-800",
                    )}
                  >
                    {steps[0].title}
                  </h1>
                  <p
                    className={cn(
                      "text-center mb-2 text-lg max-w-lg",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {steps[0].description}
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Clock
                      className={cn(
                        "w-4 h-4",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    />
                    <span
                      className={cn(
                        "text-base",
                        isDark ? "text-gray-300" : "text-gray-600",
                      )}
                    >
                      {steps[0].readTime}
                    </span>
                  </div>
                  <button
                    className={cn(
                      "w-full text-md rounded-full py-4 font-semibold",
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
                </>
              ) : isCardsStep ? (
                <div className="w-full flex-1 min-h-0 flex flex-col">
                  {steps[step].stepDescription && (
                    <p
                      className={cn(
                        "text-center text-base px-4 mb-2",
                        isDark ? "text-gray-400" : "text-gray-600",
                      )}
                    >
                      {steps[step].stepDescription}
                    </p>
                  )}
                  <div
                    className="w-full flex-1 min-h-0 flex items-start justify-center overflow-y-auto pr-2 focus:outline-none custom-scrollbar px-4 py-4"
                    tabIndex={0}
                    style={{
                      WebkitOverflowScrolling: "touch",
                      minHeight: "120px",
                      maxHeight: "100%",
                    }}
                  >
                    <div className="flex flex-row gap-3 items-stretch flex-wrap justify-center">
                      {(steps[step].cards as OnboardingCard[] | undefined)?.map(
                        (card, idx) => {
                        const cardCount = steps[step].cards?.length || 0;
                        const isFourCards = cardCount >= 4;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "rounded-2xl p-5 shadow-lg flex flex-col",
                              isFourCards
                                ? "w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(25%-0.75rem)] min-w-[220px] max-w-[300px]"
                                : "flex-1 min-w-[200px] max-w-[320px]",
                              isDark ? "bg-[#170337]" : "bg-white",
                            )}
                          >
                            <div className="flex flex-col items-center text-center gap-3 flex-1">
                              <div className="w-12 h-12 bg-[#D8C3FF] rounded-full flex items-center justify-center">
                                <span className="text-[#4A00BE] font-bold">
                                  {card.icon}
                                </span>
                              </div>
                              <div className="flex-1 flex flex-col">
                                <h3
                                  className={cn(
                                    "font-bold mb-2",
                                    isFourCards ? "text-base" : "text-lg",
                                    isDark ? "text-white" : "text-gray-800",
                                  )}
                                >
                                  {card.title}
                                </h3>
                                <p
                                  className={cn(
                                    "leading-relaxed text-sm",
                                    isDark ? "text-gray-300" : "text-gray-700",
                                  )}
                                >
                                  {card.description}
                                </p>
                              </div>
                              {card.filterType && card.actionLabel && (
                                <button
                                  type="button"
                                  className={cn(
                                    "w-full mt-2 rounded-full py-2 px-3 text-xs font-semibold border transition-colors",
                                    isDark
                                      ? "border-[#7F39EC] text-[#D8C3FF] hover:bg-[#7F39EC33]"
                                      : "border-[#7F39EC] text-[#7F39EC] hover:bg-[#D9C0FF61]",
                                  )}
                                  onClick={() =>
                                    onApplyContestTypeFilter?.(card.filterType!)
                                  }
                                >
                                  {card.actionLabel}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      },
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {!isIntro && (
              <div className="w-full px-4 pb-2 pt-4">
                <button
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
                    {isLastStep ? "Got it" : "Next"}
                    {!isLastStep && <ArrowRight className="w-5 h-5" />}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

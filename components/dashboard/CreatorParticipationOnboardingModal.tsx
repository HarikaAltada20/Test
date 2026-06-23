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
  howItWorks: string;
  example: string;
  bestFor: string;
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
    howItWorks:
      "Submit your content, climb the leaderboard, and finish in a winning rank when the campaign ends. Higher views and engagement improve your position.",
    example:
      "Example: Top 3 might earn $500 / $300 / $200 from a $1,000 prize pool.",
    bestFor: "Creators who can drive high views quickly and love competition.",
    filterType: "leaderboard",
    actionLabel: "View Leaderboard campaigns",
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "CPM",
    badge: "Pay per 1K views",
    summary:
      "Earn a set rate for every 1,000 verified views. No ranking required—more views means more money.",
    howItWorks:
      "Your payout = (verified views ÷ 1,000) × CPM rate. Campaign ends when the budget is used or the deadline passes.",
    example:
      "At $5 CPM: 10K views = $50 · 50K views = $250 · 100K views = $500.",
    bestFor:
      "Creators who consistently generate views without needing to rank #1.",
    filterType: "cpm",
    actionLabel: "View CPM campaigns",
  },
  {
    icon: <Target className="w-6 h-6" />,
    title: "Milestone",
    badge: "Hit view targets",
    summary:
      "Unlock fixed cash rewards when your submission hits view milestones. You are paid for the highest milestone you reach.",
    howItWorks:
      "Each milestone has a view target and payout (e.g. 20K views = $15, 100K views = $80). No competition with other creators.",
    example:
      "Example: 20K views = $15 · 50K views = $40 · 100K views = $80 — you earn the highest milestone your video reaches.",
    bestFor: "Creators who can push one video past clear view targets.",
    filterType: "milestone",
    actionLabel: "View Milestone campaigns",
  },
  {
    icon: <Award className="w-6 h-6" />,
    title: "Dual Rewards",
    badge: "CPM + Milestones",
    summary:
      "The best of both worlds: steady CPM earnings plus fixed milestone payouts on the same submission.",
    howItWorks:
      "You earn CPM on all verified views AND unlock milestone rewards when you cross view thresholds.",
    example:
      "At $0.20 CPM + $120 at 50K views: 50K views ≈ $10 CPM + $120 milestone = $130 total.",
    bestFor:
      "Creators who want ongoing view income plus bigger payouts at key view targets.",
    filterType: "dual_rewards",
    actionLabel: "View Dual Rewards campaigns",
  },
];

const steps = [
  {
    type: "intro" as const,
    title: "How to Participate in Campaigns",
    description:
      "Learn the four pillars of participating, then watch the walkthrough and explore campaign types.",
    readTime: "",
  },
  {
    type: "participation" as const,
    stepTitle: "How to Participate",
    stepDescription:
      "Follow these four pillars—from account setup to community support.",
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
  {
    type: "campaign-types" as const,
    stepTitle: "Types of Campaigns",
    stepDescription:
      "Each campaign shows its type on the card. Here is how each one pays you.",
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
];

function OnboardingVideo({
  videoId,
  caption,
  updatedOn,
  isDark,
}: {
  videoId: string;
  caption: string;
  updatedOn?: string;
  isDark: boolean;
}) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-2">
      <div
        className={cn(
          "rounded-2xl overflow-hidden border shadow-md aspect-video w-full",
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
  const isIntro = step === 0;
  const isLastStep = step === steps.length - 1;
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (open) {
      setStep(0);
    }
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
    return "max-w-6xl";
  };

  const isDark = mode === "dark";
  const cardStepCount = steps.length - 1;
  const current = steps[step];

  return (
    <Dialog open={open} isdark={isDark}>
      <DialogPortal>
        <DialogOverlay />
        <div
          className={`fixed p-4 sm:p-6 left-1/2 top-1/2 z-50 w-[95vw] ${getModalWidth()} -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background border border-border shadow-2xl flex flex-col min-h-0 max-h-[92vh]`}
        >
          <button
            type="button"
            onClick={onComplete}
            className={cn(
              "absolute top-3 right-3 sm:top-4 sm:right-4 z-10 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-white/10"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100",
            )}
            aria-label="Skip onboarding"
          >
            Skip
          </button>
          <div className="w-full flex flex-col flex-1 min-h-0">
            {!isIntro && (
              <div className="w-full px-2 sm:px-6 pt-4 pb-2 shrink-0">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 max-w-lg mx-auto">
                  {[1, 2, 3, 4].map((n, i) => (
                    <div key={n} className="contents">
                      {i > 0 && (
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[24px]">
                          <div
                            className="h-full bg-[#7F39EC] transition-all duration-500 ease-out"
                            style={{ width: step >= n ? "100%" : "0%" }}
                          />
                        </div>
                      )}
                      <div
                        className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 text-sm shrink-0",
                          step >= n
                            ? "bg-[#7F39EC] text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {step > n ? (
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          n
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isIntro && (
              <div className="w-full px-2 sm:px-6 pt-2 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="p-2 rounded-full hover:bg-accent transition-colors text-foreground"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 flex flex-col items-center px-2">
                  <span className="text-muted-foreground text-sm">
                    Step {step} of {cardStepCount}
                  </span>
                  {"stepTitle" in current && current.stepTitle && (
                    <h2
                      className={cn(
                        "text-lg font-semibold mt-1 text-center",
                        isDark ? "text-white" : "text-gray-800",
                      )}
                    >
                      {current.stepTitle}
                    </h2>
                  )}
                </div>
                <div className="w-10" />
              </div>
            )}

            <div
              className={cn(
                "w-full flex-1 min-h-0 flex flex-col items-center overflow-y-auto custom-scrollbar",
                isIntro ? "pt-6 pb-4 px-2" : "px-2 sm:px-4 py-3",
              )}
            >
              {isIntro ? (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 bg-[#7F39EC17] border border-[#7F39EC] text-[#7F39EC] rounded-full flex items-center justify-center">
                      <Megaphone className="w-10 h-10" />
                    </div>
                  </div>
                  <h1
                    className={cn(
                      "text-2xl sm:text-3xl font-bold text-center mb-2",
                      isDark ? "text-white" : "text-gray-800",
                    )}
                  >
                    {steps[0].title}
                  </h1>
                  <p
                    className={cn(
                      "text-center mb-2 text-base sm:text-lg max-w-lg",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {steps[0].description}
                  </p>
                  {/* <div className="flex items-center justify-center gap-2 mb-6">
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
                  </div> */}

                  <button
                    type="button"
                    className={cn(
                      "w-full max-w-lg text-md rounded-full mt-6 py-4 font-semibold",
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
              ) : current.type === "participation" ? (
                <div className="w-full space-y-6 pb-2">
                  <p
                    className={cn(
                      "text-center text-sm sm:text-base max-w-2xl mx-auto",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {current.stepDescription}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 w-full">
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
                                  isDark ? "text-gray-400" : "text-gray-600",
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
                <div className="w-full space-y-6 pb-2 max-w-3xl mx-auto">
                  <p
                    className={cn(
                      "text-center text-sm sm:text-base",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {current.stepDescription}
                  </p>
                  <OnboardingVideo
                    videoId={current.videoId}
                    caption={current.videoCaption}
                    updatedOn={current.videoUpdatedOn}
                    isDark={isDark}
                  />
                </div>
              ) : current.type === "campaign-types" ? (
                <div className="w-full space-y-6 pb-2">
                  <p
                    className={cn(
                      "text-center text-sm sm:text-base max-w-2xl mx-auto",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {current.stepDescription}
                  </p>
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
                            "rounded-lg p-3 text-xs space-y-2 mb-3 flex-1",
                            isDark
                              ? "bg-[#22074A]/80 text-gray-300"
                              : "bg-[#F9F5FF] text-gray-700",
                          )}
                        >
                          <p>
                            <span className="font-semibold text-[#7F39EC]">
                              How it works:{" "}
                            </span>
                            {card.howItWorks}
                          </p>
                          <p>
                            <span className="font-semibold text-[#7F39EC]">
                              Example:{" "}
                            </span>
                            {card.example}
                          </p>
                          <p>
                            <span className="font-semibold text-[#7F39EC]">
                              Best for:{" "}
                            </span>
                            {card.bestFor}
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
                <div className="w-full space-y-6 pb-2 max-w-3xl mx-auto">
                  <p
                    className={cn(
                      "text-center text-sm sm:text-base",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  >
                    {current.stepDescription}
                  </p>
                  <OnboardingVideo
                    videoId={current.videoId}
                    caption={current.videoCaption}
                    updatedOn={current.videoUpdatedOn}
                    isDark={isDark}
                  />
                </div>
              ) : null}
            </div>

            {!isIntro && (
              <div className="w-full px-2 sm:px-4 pb-2 pt-3 shrink-0">
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
            )}
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

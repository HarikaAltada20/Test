"use client";

import { useState } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Clock,
  Ban,
  Wallet,
  FileText,
  ShoppingCart,
} from "lucide-react";

const steps = [
  // Intro step (index 0)
  {
    type: "intro",
    title: "Creator Guidelines",
    description:
      "To ensure a fair and successful experience on Game of Creators, please read through the creator guidelines.",
    readTime: "2 min read",
    illustration: (
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="w-24 h-24 bg-[#7F39EC17] border border-[#7F39EC] text-[#7F39EC] rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10" />
          </div>
          {/* <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-black">!</span>
          </div> */}
        </div>
      </div>
    ),
  },
  // Step 1: Two hours rule + Purchasing fake views and engagement
  {
    type: "cards",
    stepTitle: "Content Submission Rules",
    stepDescription: "Important guidelines for submitting your content",
    cards: [
      {
        icon: <Clock className="w-6 h-6" />,
        title: "2 Hours Rule",
        description:
          "All content must be submitted to a contest within 2 hours of being published on YouTube or Instagram. Submissions made after this window will not be eligible.",
      },
      {
        icon: <Ban className="w-6 h-6" />,
        title: "Purchasing fake views and engagement",
        description:
          "Purchasing views or boosting engagement on any of your posts will result in immediate disqualification.",
      },
    ],
  },
  // Step 2: Payouts, Usage rights, Purchasing your content
  {
    type: "cards",
    stepTitle: "Payouts & Content Rights",
    stepDescription: "Understanding your earnings and content usage",
    cards: [
      {
        icon: <Wallet className="w-6 h-6" />,
        title: "Payouts",
        description:
          "All payouts are processed after the completion of a contest. You can choose to receive your payout via bank transfer, UPI, or cryptocurrency. The payment will be sent using the method you select in your Game of Creators payout method at the time of withdrawl",
      },
      {
        icon: <FileText className="w-6 h-6" />,
        title: "Usage Rights",
        description:
          "If selected as a winner, brands will be able to use your content.",
      },
      {
        icon: <ShoppingCart className="w-6 h-6" />,
        title: "Purchasing your content",
        description:
          "Even if you don't win a contest, brands will still have the option to purchase your content for a one-time fee that you set.",
      },
    ],
  },
];

export default function CreatorGuidelinesModal({
  open,
  onComplete,
}: {
  open: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const isIntro = step === 0;
  const isCardsStep = step > 0;
  const isLastStep = step === steps.length - 1;
  const progress = (step / (steps.length - 1)) * 100;

  // Dynamic width based on step
  const getModalWidth = () => {
    if (isIntro) {
      // Intro: Smaller width
      return "max-w-2xl";
    } else if (step === 1) {
      // Step 1 (2 cards): Medium width
      return "max-w-4xl";
    } else if (step === 2) {
      // Step 2 (3 cards): Wider width
      return "max-w-6xl";
    }
    return "max-w-3xl";
  };

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay />
        <div
          className={`fixed p-6 left-1/2 top-1/2 z-50 w-[90vw] ${getModalWidth()} -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background border border-border shadow-2xl flex flex-col min-h-0 max-h-[90vh]`}
        >
          <div className="w-full flex flex-col flex-1 min-h-0">
            {/* Progress bar */}
            {!isIntro && (
              <div className="w-full px-6 pt-6 pb-4">
                <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
                  {/* Circle 1 */}
                  <div
                    className={`w-12 h-12 text-md rounded-full flex items-center justify-center font-semibold transition-all duration-300 ${
                      step >= 1
                        ? "bg-[#7F39EC] text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > 1 ? <CheckCircle className="w-5 h-5" /> : "1"}
                  </div>

                  {/* Progress Line */}
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-[#7F39EC] transition-all duration-500 ease-out"
                      style={{ width: step >= 2 ? "100%" : "30%" }}
                    />
                  </div>

                  {/* Circle 2 */}
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-md transition-all duration-300 ${
                      step >= 2
                        ? "bg-[#7F39EC] text-white"
                        : "bg-muted text-gray-800"
                    }`}
                  >
                    {step >= 2 ? <CheckCircle className="w-5 h-5" /> : "2"}
                  </div>
                </div>
              </div>
            )}

            {/* Top bar with back and step indicator (not scrollable) */}
            {!isIntro && (
              <div className="w-full px-4 sm:px-8 pt-4 flex items-center justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="p-2 rounded-full hover:bg-accent transition-colors duration-200 text-foreground"
                  aria-label="Back"
                  title="Back"
                  disabled={step === 0}
                >
                  <ArrowLeft className="w-6 h-6 text-foreground" />
                </button>
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-muted-foreground text-sm">
                    Step {step} of {steps.length - 1}
                  </span>
                  {/* {isCardsStep && steps[step].stepTitle && (
                    <h2 className="text-lg font-semibold text-foreground mt-1">
                      {steps[step].stepTitle}
                    </h2>
                  )} */}
                </div>
                <div className="w-8" />
              </div>
            )}
            <div
              className={`w-full flex-1 min-h-0 flex flex-col items-center ${
                isIntro ? "pt-8 pb-4" : ""
              }`}
              style={{ height: isIntro ? "auto" : "100%", maxHeight: "100%" }}
            >
              {isIntro ? (
                <>
                  {steps[0].illustration}
                  <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
                    {steps[0].title}
                  </h1>
                  <p className="text-gray-600 text-center mb-2 text-lg">
                    {steps[0].description}
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-base text-gray-600">
                      {steps[0].readTime}
                    </span>
                  </div>
                  <button
                    className="w-full text-md rounded-full bg-[#D9C0FF61] py-4 font-semibold text-[#7F39EC] "
                    onClick={() => setStep(1)}
                  >
                    <span className="flex items-center justify-center text-lg gap-2">
                      Start Reading
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  </button>
                </>
              ) : isCardsStep ? (
                <div className="w-full flex-1 min-h-0 flex flex-col">
                  {/* Step description */}
                  {/* {steps[step].stepDescription && (
                    <div className="px-4 sm:px-8 mb-6">
                      <p className="text-muted-foreground text-center text-base">
                        {steps[step].stepDescription}
                      </p>
                    </div>
                  )} */}

                  {/* Cards */}
                  <div
                    className="w-full flex-1 min-h-0 flex items-start justify-center overflow-y-auto pr-2 focus:outline-none custom-scrollbar px-4 py-6"
                    tabIndex={0}
                    style={{
                      WebkitOverflowScrolling: "touch",
                      minHeight: "120px",
                      maxHeight: "100%",
                    }}
                  >
                    <div className="flex flex-row gap-3 items-stretch flex-wrap justify-center">
                      {Array.isArray(steps[step].cards)
                        ? steps[step].cards.map((card, idx) => {
                            const cardCount = steps[step].cards?.length || 0;
                            const isThreeCards = cardCount === 3;
                            return (
                              <div
                                key={idx}
                                className="bg-white rounded-2xl p-5 shadow-lg flex-1"
                              >
                                <div
                                  className={`flex flex-col items-center text-center ${
                                    isThreeCards ? "gap-3" : "gap-4"
                                  }`}
                                >
                                  <div className="w-12 h-12 bg-[#D8C3FF] rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-[#4A00BE] font-bold">
                                      {card.icon}
                                    </span>
                                  </div>
                                  {/* <div className="flex-shrink-0">
                                    {card.icon}
                                  </div> */}
                                  <div>
                                    <h3
                                      className={`font-bold mb-2 text-foreground ${
                                        isThreeCards ? "text-base" : "text-lg"
                                      }`}
                                    >
                                      {card.title}
                                    </h3>
                                    <p
                                      className={`text-gray-700 leading-relaxed ${
                                        isThreeCards ? "text-[14px]" : "text-md"
                                      }`}
                                    >
                                      {card.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {isIntro ? null : (
              <div className="w-full px-4 pb-2 pt-4">
                <button
                  className="w-full text-lg rounded-full bg-[#D9C0FF61] py-3.5 font-semibold text-[#7F39EC] "
                  onClick={
                    isLastStep ? onComplete : () => setStep((s) => s + 1)
                  }
                >
                  <span className="flex items-center justify-center gap-2">
                    {isLastStep ? (
                      <>
                        {/* <CheckCircle className="w-5 h-5" /> */}
                        Done
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
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

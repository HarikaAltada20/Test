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

const steps = [
    // Intro step (index 0)
    {
        type: "intro",
        title: "Creator Guidelines",
        description:
            "To ensure a fair and successful experience on Game of Creators, please read through the creator guidelines.",
        readTime: "2 min read",
        illustration: (
            <div className="flex justify-center mb-4">
                {/* Placeholder SVG illustration */}
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="10" y="20" width="100" height="50" rx="10" fill="#F3F4F6" />
                    <circle cx="35" cy="45" r="10" fill="#A78BFA" />
                    <rect x="55" y="35" width="40" height="20" rx="5" fill="#F472B6" />
                </svg>
            </div>
        ),
    },
    // Step 1: Two hours rule + Purchasing fake views and engagement
    {
        type: "cards",
        cards: [
            {
                title: "2 hours rule",
                description:
                    "All content must be submitted to a contest within 2 hours of being published on YouTube or Instagram. Submissions made after this window will not be eligible."
            },
            {
                title: "Purchasing fake views and engagement",
                description:
                    "Purchasing views or boosting engagement on any of your posts will result in immediate disqualification."
            }
        ]
    },
    // Step 2: Payouts, Usage rights, Purchasing your content
    {
        type: "cards",
        cards: [
            {
                title: "Payouts",
                description:
                    "All payouts are processed after the completion of a contest. You can choose to receive your payout via bank transfer, UPI, or cryptocurrency. The payment will be sent using the method you select in your Game of Creators payout method at the time of withdrawl"
            },
            {
                title: "Usage rights",
                description:
                    "If selected as a winner, brands will be able to use your content."
            },
            {
                title: "Purchasing your content",
                description:
                    "Even if you don't win a contest, brands will still have the option to purchase your content for a one-time fee that you set."
            }
        ]
    }
];

const brandButtonClass = "bg-primary hover:bg-primary/90 text-white font-semibold";

export default function CreatorGuidelinesModal({ open, onComplete }: { open: boolean; onComplete: () => void }) {
    const [step, setStep] = useState(0);
    const isIntro = step === 0;
    const isCardsStep = step > 0;
    const isLastStep = step === steps.length - 1;

    return (
        <Dialog open={open}>
            <DialogPortal>
                <DialogOverlay />
                <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl min-w-[90vw] sm:min-w-[400px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background border border-border shadow-2xl flex flex-col min-h-0 max-h-[90vh]">
                    <div className="w-full flex flex-col flex-1 min-h-0">
                        {/* Top bar with back and step indicator (not scrollable) */}
                        {!isIntro && (
                            <div className="w-full px-4 sm:px-8 pt-8 flex items-center justify-between mb-4">
                                <button
                                    onClick={() => setStep(step - 1)}
                                    className="p-2 rounded-full hover:bg-accent transition"
                                    aria-label="Back"
                                    disabled={step === 0}
                                >
                                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
                                </button>
                                <div className="flex-1 flex justify-center">
                                    <span className="text-muted-foreground text-sm">Step {step} of {steps.length - 1}</span>
                                </div>
                                <div className="w-8" />
                            </div>
                        )}
                        <div className={`w-full flex-1 min-h-0 flex flex-col items-center ${isIntro ? 'px-4 sm:px-8 pt-8 pb-4' : ''}`}
                            style={{ height: isIntro ? 'auto' : '100%', maxHeight: '100%' }}>
                            {isIntro ? (
                                <>
                                    {steps[0].illustration}
                                    <h1 className="text-3xl font-bold text-center mb-2 text-primary">{steps[0].title}</h1>
                                    <p className="text-muted-foreground text-center mb-2 text-lg">{steps[0].description}</p>
                                    <div className="flex items-center justify-center gap-2 mb-6">
                                        <span className="text-base text-muted-foreground">⏱️ {steps[0].readTime}</span>
                                    </div>
                                    <Button className={`w-full py-3 rounded-xl text-lg ${brandButtonClass}`} onClick={() => setStep(1)}>
                                        Read
                                    </Button>
                                </>
                            ) : isCardsStep ? (
                                <div
                                    className="w-full flex-1 min-h-0 flex flex-col gap-6 items-center overflow-y-auto pr-2 focus:outline-none custom-scrollbar"
                                    tabIndex={0}
                                    style={{ WebkitOverflowScrolling: 'touch', minHeight: '120px', maxHeight: '100%' }}
                                >
                                    {Array.isArray(steps[step].cards) ? steps[step].cards.map((card, idx) => {
                                        const isLast = idx === (steps[step].cards?.length ?? 0) - 1;
                                        return (
                                            <div
                                                key={idx}
                                                className={`bg-background border border-border rounded-xl shadow-lg px-8 py-6 w-full max-w-xl mx-auto${isLast ? ' mb-4' : ''}`}
                                                style={{ minWidth: 0 }}
                                            >
                                                <div className="font-bold text-xl mb-2 text-primary">{card.title}</div>
                                                <div className="text-muted-foreground text-base whitespace-pre-line">{card.description}</div>
                                            </div>
                                        );
                                    }) : null}
                                </div>
                            ) : null}
                        </div>
                        {isIntro ? null : (
                            <div className="w-full px-4 sm:px-8 pb-4">
                                <Button
                                    className={`w-full py-3 rounded-xl text-lg ${brandButtonClass}`}
                                    onClick={isLastStep ? onComplete : () => setStep((s) => s + 1)}
                                >
                                    {isLastStep ? "Done" : "Next"}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogPortal>
        </Dialog>
    );
} 
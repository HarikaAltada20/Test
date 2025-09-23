"use client";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "./ui/badge";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  DollarSign,
  Check,
  Video,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "welcome",
    title: "Welcome to Game of Creators!",
    description:
      "Connect with creators, launch contests, and get viral content!",
    isWelcome: true,
  },
  {
    id: "create-contests",
    title: "Create Contests",
    description:
      "Set your brief, budget, and contest type (Leaderboard of CPM)",
    image: "./images/b53b923aa25a75703cc4c019bed51f44c0bdf9c7.avif",
  },
  {
    id: "creators-submit",
    title: "Creators Submit",
    description:
      "Talented creators create and submit videos based on your brief.",
    image: "./images/11017adbc9cdf66949048d62f868aa555d21a55d.avif",
  },
  {
    id: "content-review",
    title: "Content Review",
    description: "We review submissions to ensure quality and brand safety.",
    image: "./images/3589d5a9bc90b61e33d989008a82f90e932746fba.avif",
  },
  {
    id: "get-results",
    title: "Get Results",
    description: "Receive viral content and pay creators based on performance.",
    image: "./images/d47f66e9a502a2e6793dac43d34f9df1c9328146.avif",
  },
];

export default function GettingStartedModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSecondPopup, setShowSecondPopup] = useState(false);
  const [showThirdPopup, setShowThirdPopup] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const partyIconRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
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
  const isDark = mode === "dark";
  // Runs whenever we return to Welcome
  useEffect(() => {
    if (
      open &&
      currentStep === 0 &&
      partyIconRef.current &&
      canvasRef.current
    ) {
      const rect = partyIconRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      confetti({
        particleCount: 150,
        spread: 100,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
      });
    }
  }, [open, currentStep]);

  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  if (!open && !showSecondPopup && !showThirdPopup) return null;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Instead of closing, show second popup
      setShowSecondPopup(true);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleCloseAll = () => {
    setCurrentStep(0);
    setShowSecondPopup(false);
    setShowThirdPopup(false);
    onClose();
  };

  const renderMainSteps = () => {
    const step = steps[currentStep];
    const isWelcome = step.isWelcome;
    const isLastStep = currentStep === steps.length - 1;

    return (
      <div
        className={cn(
          "fixed inset-0 bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
          isDark ? "bg-[#100A33]" : "bg-black"
        )}
      >
        {/* Welcome Card */}
        {isWelcome && (
          <div
            className={cn(
              "rounded-2xl w-full max-w-2xl p-6 md:py-12 md:px-10 text-center relative",
              isDark ? "bg-[#06021D] " : "bg-white"
            )}
          >
            <button
              onClick={onClose}
              className={cn(
                "absolute top-6 right-6 border z-10 px-6 py-2 rounded-full backdrop-blur-sm",
                isDark
                  ? "bg-[#06021D] border-white"
                  : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
              )}
            >
              Skip
            </button>

            <canvas
              ref={canvasRef}
              className="absolute inset-0 pointer-events-none"
            />

            <div
              ref={partyIconRef}
              className="w-20 h-20 sm:w-24 sm:h-24 bg-[#7F39EC17] border border-[#7F39EC] rounded-full flex items-center justify-center mb-6 sm:mb-8 mx-auto"
            >
              <PartyPopper className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600" />
            </div>
            <h1
              className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4",
                isDark ? "text-white" : "text-gray-900"
              )}
            >
              {step.title}
            </h1>
            <p
              className={cn(
                "text-base sm:text-lg text-gray-600 mb-8 sm:mb-12",
                isDark ? "text-white" : "text-gray-600"
              )}
            >
              {step.description}
            </p>
            <button
              onClick={handleNext}
              className={cn(
                "w-full text-lg py-3 sm:py-4 rounded-full font-semibold",
                isDark
                  ? "bg-[#5F2BB1]"
                  : "bg-[#D9C0FF61] text-purple-500 hover:from-purple-500 hover:to-purple-700"
              )}
            >
              Let’s Start
            </button>
          </div>
        )}

        {/* Steps Card */}
        {!isWelcome && (
          <div
            className={cn(
              "rounded-2xl w-full max-w-4xl lg:max-w-6xl flex flex-col md:flex-row overflow-hidden relative",
              isDark ? "bg-[#06021D]" : "bg-white"
            )}
          >
            <button
              onClick={onClose}
              className={cn(
                "absolute top-6 right-6 border z-10 px-6 py-2 rounded-full backdrop-blur-sm",
                isDark
                  ? "bg-[#06021D] border-white"
                  : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
              )}
            >
              Skip
            </button>

            {/* Stepper (row on mobile, column on desktop) */}
            <div
              className={cn(
                "md:w-16 flex md:flex-col items-center justify-center gap-4 md:gap-6 p-4 bg-gray-50 flex-shrink-0",
                isDark ? "bg-[#06021D]" : "bg-gray-50"
              )}
            >
              {steps.slice(1).map((_, index) => {
                const stepIndex = index + 1;
                const isActive = currentStep === stepIndex;
                const isCompleted = currentStep > stepIndex;
                return (
                  <div
                    key={stepIndex}
                    className="flex flex-row md:flex-col items-center"
                  >
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        isActive
                          ? "bg-purple-600 scale-125"
                          : isCompleted
                          ? "bg-purple-400"
                          : "bg-gray-300"
                      }`}
                    />
                    {stepIndex < steps.length - 1 && (
                      <div
                        className={`${
                          currentStep > stepIndex
                            ? "bg-purple-400"
                            : "bg-gray-200"
                        } transition-all duration-300 
                        ${"md:w-0.5 md:h-[110px] w-12 h-0.5 mx-2 md:mx-0 md:my-2"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 overflow-y-auto">
              <div className="text-center mb-4 sm:mb-6">
                <h2
                  className={cn(
                    "text-lg sm:text-xl md:text-2xl font-bold ",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  How it Works
                </h2>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex flex-row items-center justify-between w-full gap-4 pb-6">
                  {/* Title + Description */}
                  <div className="text-left flex-1">
                    <h2 className="text-lg md:text-2xl font-semibold mb-2">
                      {step.title}
                    </h2>
                    <p
                      className={cn(
                        "text-sm md:text-base",
                        isDark ? "text-white" : "text-gray-600"
                      )}
                    >
                      {step.description}
                    </p>
                  </div>

                  <div className="flex flex-row justify-end gap-3 mt-3 text-md">
                    <button
                      onClick={handlePrevious}
                      disabled={currentStep <= 1}
                      className={cn(
                        "flex items-center justify-center rounded-full",
                        currentStep <= 1
                          ? isDark
                            ? "text-gray-500 cursor-not-allowed"
                            : "text-gray-400 cursor-not-allowed"
                          : isDark
                          ? "text-white"
                          : "text-black"
                      )}
                    >
                      <ChevronLeft size={30} />
                      {/* <span>Previous</span> */}
                    </button>

                    <button
                      onClick={handleNext}
                      className={cn(
                        "rounded-full font-semibold flex items-center justify-center gap-2",
                        isDark ? "text-white" : "text-black"
                      )}
                    >
                      {/* <span>{!isLastStep ? "Next" : "Next Step"}</span> */}
                      <ChevronRight size={30} />
                    </button>
                  </div>
                </div>

                {step.image && (
                  <div className="h-[250px] md:h-[400px] rounded-2xl overflow-hidden mb-4 sm:mb-6 flex-shrink-0">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSecondPopup = () => (
    <div
     className={cn(
      "fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
      isDark ? "bg-[#100A33]" : "bg-black"
    )}>
      <div 
        className={cn(
          " rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative pt-12 pb-6",
          isDark ? "bg-[#06021D]" : "bg-white"
        )}>
        <button
          onClick={() => {
            setShowSecondPopup(false);
            setCurrentStep(steps.length - 1);
          }}
       
          className={cn(
            "absolute top-4 left-4 sm:top-6 sm:left-6 z-10 px-4 sm:px-8 py-2 border rounded-full transition-all duration-200",
            isDark
              ? "bg-[#06021D] border-white"
              : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
          )}
       >
          Back
        </button>
        {/* Skip */}
        <button
          onClick={handleCloseAll}
          className={cn(
            "absolute top-4 right-4 sm:top-6 sm:right-6 z-10 px-4 sm:px-8 py-2 border rounded-full transition-all duration-200",
            isDark
              ? "bg-[#06021D] border-white"
              : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
          )}
        >
          Skip
        </button>
        <div className="text-center mt-6 md:mt-0 md:pb-4 px-4">
          <h2
          className={cn(
            "text-xl sm:text-2xl font-bold",
            isDark ? "text-white" : "text-gray-900"
          )}>
            Choose Your Contest Type
          </h2>
        </div>

        <div className="p-2 md:px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Leaderboard Contest Section */}
            <div
             className={cn(
              "p-6 border rounded-lg",
              isDark ? "bg-[#170337] border-[#7F39EC]" : "border-[#7F39EC] bg-[#D9C0FF26]"
            )}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div 
                 className={cn(
                  "p-2.5 rounded-full",
                  isDark ? "bg-[#FFFFFF3D] text-white" : "bg-[#ECE1FC] text-purple-600"
                )}>
                  <Trophy className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg">Leaderboard Contests</h3>

                <Badge
                  variant="outline"
                
                  className={cn(
                    "py-1 px-3 rounded-full",
                    isDark ? "bg-[#FFFFFF3D] text-white" : "bg-[#ECE1FC] text-purple-700"
                  )}
                >
                  Competition Based
                </Badge>
              </div>

              <p 
                className={cn(
                  "text-md mb-4",
                  isDark ? "text-white" : "text-gray-600 dark:text-gray-300"
                )}>
                Set a fixed prize pool and let creators compete for the top
                spots.
              </p>

              {/* Visual Process */}
              <div className="text-center mb-4">
                <div 
                 className={cn(
                  "inline-block p-4 rounded-lg border",
                  isDark ? "bg-[#06021D26] border-[#7F39EC]" : "bg-[#D9C0FF26] border-[#7F39EC]"
                )}>
                  <div 
                   className={cn(
                    "text-lg font-bold mb-1",
                    isDark ? "text-white" : "text-black"
                  )}>
                    Set Prize Pool → Creators Compete → Winners Get Paid
                  </div>
                  <div 
                   className={cn(
                    "text-sm",
                    isDark ? "text-white" : "text-black"
                  )}>
                    Example: $1000 total, 3 winners get $500, $300, $200
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Check className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Fixed budget - know your total cost upfront
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    High competition drives quality content
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Own winning videos forever
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Perfect for viral marketing & brand awareness
                  </span>
                </div>
              </div>

              <div className="text-center pt-4">
                <Link href="/dashboard/contests/create">
                  <Button 
                   className={cn(
                    "text-md text-white w-full",
                    isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE] hover:bg-[#4A00BE] "
                  )}>
                    <Trophy className="w-4 h-4" />
                    Create Leaderboard Contest
                  </Button>
                </Link>
              </div>
            </div>

            {/* CPM Contest Section */}
            <div 
             className={cn(
              "p-6 border rounded-lg",
              isDark ? "bg-[#170337] border-[#7F39EC]" : "border-[#7F39EC] bg-[#D9C0FF26]"
            )}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div
                 className={cn(
                  "p-2.5 rounded-full",
                  isDark ? "bg-[#FFFFFF3D] text-white" : "bg-[#ECE1FC] text-purple-600"
                )}>
                  <DollarSign className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg flex items-center">
                  CPM Contests
                  {/* Info Icon with hover tooltip */}
                  {/* <div className="ml-2 relative group">
                          <Info className="w-4 h-4 text-black cursor-pointer" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            <strong>CPM</strong> stands for{" "}
                            <em>COST PER MILE</em>
                          </div>
                        </div> */}
                </h3>

                <Badge
                  variant="outline"
                  className={cn(
                    "py-1 px-3 rounded-full",
                    isDark ? "bg-[#FFFFFF3D] text-white" : "bg-[#ECE1FC] text-purple-700"
                  )}
                >
                  Pay Per 1000 Views
                </Badge>
              </div>

              <p 
               className={cn(
                "text-md mb-4",
                isDark ? "text-white" : "text-gray-600 dark:text-gray-300"
              )}>
                Pay only for actual views. More views = more marketing reach for
                your brand.
              </p>

              {/* Visual Process */}
              <div className="text-center mb-4">
                <div 
                 className={cn(
                  "inline-block p-4 rounded-lg border",
                  isDark ? "bg-[#06021D26] border-[#7F39EC]" : "bg-[#D9C0FF26] border-[#7F39EC]"
                )}>
                  <div
                   className={cn(
                    "text-lg font-bold mb-2",
                    isDark ? "text-white" : "text-black"
                  )}>
                    Set CPM Rate → Creators Post → Pay Per Views
                  </div>
                  <div 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-black"
                  )}>
                    Example: $5 per 1K views, 50K views = $250 payment
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Check className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Pay only for performance - no wasted budget
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check  
                   className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Scalable - more views = more marketing
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check  
                   className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Set max budget & CPM rate for control
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check  
                   className={cn(
                    "w-5 h-5 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-[#4A00BE]"
                  )}/>
                  <span 
                   className={cn(
                    "text-md",
                    isDark ? "text-white" : "text-gray-700 dark:text-gray-300"
                  )}>
                    Perfect for ongoing marketing & paid advertising
                  </span>
                </div>
              </div>

              <div className="text-center pt-4">
                <Link href="/dashboard/contests/create">
                  <Button 
                   className={cn(
                    "text-md text-white w-full",
                    isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE] hover:bg-[#4A00BE] "
                  )}>
                    <DollarSign className="w-4 h-4" />
                    Create CPM Contest
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 px-6 flex justify-center">
          <button
            onClick={() => {
              setShowSecondPopup(false);
              setShowThirdPopup(true);
            }}

            className={cn(
              "text-[14px] w-full py-3 rounded-full font-semibold",
              isDark ? "bg-[#5F2BB1] text-white" : "bg-[#D9C0FF61] text-purple-500 hover:from-purple-500 hover:to-purple-700"
            )}
         >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );

  const renderThirdPopup = () => (
    <div 
    className={cn(
      "fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center p-2 sm:p-4 z-50",
      isDark ? "bg-[#100A33]" : "bg-black"
    )}>
      <div 
     className={cn(
      "rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto px-4 py-8 md:px-8 md:py-12 text-center relative",
      isDark ? "bg-[#06021D]" : "bg-white"
    )} >
        {/* Back (top-left) */}
        <button
          onClick={() => {
            setShowThirdPopup(false);
            setShowSecondPopup(true);
          }}
          className={cn(
            "absolute top-4 left-4 sm:top-6 sm:left-6 z-10 px-4 sm:px-8 py-2 border rounded-full transition-all duration-200",
            isDark
              ? "bg-[#06021D] border-white"
              : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
          )}
        >
          Back
        </button>

        {/* Skip (top-right) */}
        <button
          onClick={handleCloseAll}
          className={cn(
            "absolute top-6 right-6 z-10 px-8 py-2  border rounded-full transition-all duration-200 backdrop-blur-sm",
            isDark
              ? "bg-[#06021D] border-white"
              : "text-[#4A00BE] border-[#4A00BE] bg-white/80"
          )}
          
        >
          Skip
        </button>

        <CardContent 
        className={cn(
          "mt-12 md:mt-10 p-6 border rounded-2xl",
          isDark ? "bg-[#170337] border-[#7F39EC]" : "border-[#7F39EC] bg-[#D9C0FF26]"
        )}>
          <div className="text-center mb-6">
            <h3 
            className={cn(
              "text-2xl font-bold mb-2",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Ready to Start?
            </h3>
            <p 
             className={cn(
              isDark ? "text-white" : "text-gray-900"
            )}>
              Start creating contests and campaigns
            </p>
          </div>

          <div className="text-center">
            <Link href="/dashboard/contests/create">
              <Button 
                className={cn(
                  "w-full py-3 px-8 text-lg flex items-center justify-center gap-2",
                  isDark ? "bg-[#5F2BB1]" : "bg-[#4A00BE] hover:bg-[#4A00BE] text-white"
                )}>
                <Video className="w-6 h-6" />
                Create Contest
              </Button>
            </Link>
          </div>
        </CardContent>
      </div>
    </div>
  );

  return (
    <>
      {!showSecondPopup && !showThirdPopup && renderMainSteps()}
      {showSecondPopup && renderSecondPopup()}
      {showThirdPopup && renderThirdPopup()}
    </>
  );
}

"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "./ui/badge";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  DollarSign,
  Check,
  Video,
  PartyPopper
} from "lucide-react";

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
       
  
        {/* Welcome Card */}
        {step.isWelcome && (
          <Card className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] py-12 px-6 text-center relative">
              <button
          onClick={onClose}
         className="absolute top-6 right-6 z-10 px-8 py-2 text-[#4A00BE] border border-[#4A00BE] rounded-full transition-all duration-200 bg-white/80 backdrop-blur-sm"
        >
          Skip
        </button>
            <div className="w-24 h-24 bg-[#7F39EC17] border border-[#7F39EC] rounded-full flex items-center justify-center mb-8 mx-auto">
              {/* <img src="/images/bx_party.avif" alt="logo" className="w-12 h-12" /> */}
              <PartyPopper className="w-12 h-12 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{step.title}</h1>
            <p className="text-lg text-gray-600 mb-12">{step.description}</p>
            <button
              onClick={handleNext}
              className="w-full bg-gradient-to-r from-purple-400 to-purple-600 text-white py-4 rounded-full font-semibold hover:from-purple-500 hover:to-purple-700 transition-all duration-200 "
            >
              Let’s Start
            </button>
          </Card>
        )}
  
        {/* Steps Card */}
        {!step.isWelcome && (
          <Card className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex overflow-hidden relative">
              <button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 px-8 py-2 text-[#4A00BE] border border-[#4A00BE] rounded-full transition-all duration-200 bg-white/80 backdrop-blur-sm"
        >
          Skip
        </button>
            {/* Sidebar */}
            <div className="w-16 bg-gray-50 flex flex-col items-center py-8 space-y-6 flex-shrink-0">
              {steps.slice(1).map((_, index) => {
                const stepIndex = index + 1;
                const isActive = currentStep === stepIndex;
                const isCompleted = currentStep > stepIndex;
                return (
                  <div key={stepIndex} className="flex flex-col items-center">
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
                        className={`w-0.5 h-[120px] mt-2 transition-all duration-300 ${
                          currentStep > stepIndex ? "bg-purple-400" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
  
            {/* Content */}
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  How it Works
                </h2>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
                {step.image && (
                  <div className="h-[350px] rounded-2xl overflow-hidden mb-6 flex-shrink-0">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
  
              {/* Navigation */}
              <div className="flex items-center justify-between flex-shrink-0">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep <= 1}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                    currentStep <= 1
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <ChevronLeft size={20} />
                  <span>Previous</span>
                </button>
                <button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-purple-400 to-purple-600 text-white px-8 py-2 rounded-full font-semibold hover:from-purple-500 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2"
                >
                  <span>{!isLastStep ? "Next" : "Next Step"}</span>
                </button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderSecondPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* Contest Types Section */}

      <div className="bg-white rounded-2xl max-w-6xl w-full pt-12 pb-6 text-center relative overflow-y-auto">
        {/* Skip */}
        <button
          onClick={handleCloseAll}
          className="absolute top-6 right-6 z-10 px-8 py-2 text-[#4A00BE] border border-[#4A00BE] rounded-full transition-all duration-200 bg-white/80 backdrop-blur-sm"
        >
          Skip
        </button>
        <div className="text-center pb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Choose Your Contest Type
          </h2>
        </div>

        <div className="p-2 md:px-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leaderboard Contest Section */}
            <div className="p-6 border border-[#7F39EC] rounded-lg bg-[#D9C0FF26]">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg">Leaderboard Contests</h3>

                <Badge
                  variant="outline"
                  className="bg-[#ECE1FC] text-purple-700"
                >
                  Competition Based
                </Badge>
              </div>

              <p className="text-md text-gray-600 dark:text-gray-300 mb-4">
                Set a fixed prize pool and let creators compete for the top
                spots.
              </p>

              {/* Visual Process */}
              <div className="text-center mb-4">
                <div className="inline-block p-4 bg-[#D9C0FF26] rounded-lg border border-[#7F39EC]">
                  <div className="text-lg font-bold text-black mb-1">
                    Set Prize Pool → Creators Compete → Winners Get Paid
                  </div>
                  <div className="text-sm text-black">
                    Example: $1000 total, 3 winners get $500, $300, $200
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Fixed budget - know your total cost upfront
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    High competition drives quality content
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Own winning videos forever
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Perfect for viral marketing & brand awareness
                  </span>
                </div>
              </div>

              <div className="text-center pt-4">
                <Link href="/dashboard/contests/create">
                  <Button className="bg-[#4A00BE] hover:bg-[#4A00BE] text-md text-white w-full">
                    <Trophy className="w-4 h-4" />
                    Create Leaderboard Contest
                  </Button>
                </Link>
              </div>
            </div>

            {/* CPM Contest Section */}
            <div className="p-6 border border-[#7F39EC] rounded-lg bg-[#D9C0FF26]">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
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
                  className="bg-[#ECE1FC] text-purple-700"
                >
                  Pay Per 1000 Views
                </Badge>
              </div>

              <p className="text-md text-gray-600 dark:text-gray-300 mb-4">
                Pay only for actual views. More views = more marketing reach for
                your brand.
              </p>

              {/* Visual Process */}
              <div className="text-center mb-4">
                <div className="inline-block p-4 px-8 bg-[#D9C0FF26] rounded-lg border border-[#7F39EC]">
                  <div className="text-lg font-bold text-black mb-2">
                    Set CPM Rate → Creators Post → Pay Per Views
                  </div>
                  <div className="text-md text-black ">
                    Example: $5 per 1K views, 50K views = $250 payment
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Pay only for performance - no wasted budget
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Scalable - more views = more marketing
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Set max budget & CPM rate for control
                  </span>
                </div>
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-[#4A00BE] mt-0.5 flex-shrink-0" />
                  <span className="text-md text-gray-700 dark:text-gray-300">
                    Perfect for ongoing marketing & paid advertising
                  </span>
                </div>
              </div>

              <div className="text-center pt-4">
                <Link href="/dashboard/contests/create">
                  <Button className="bg-[#4A00BE] hover:bg-[#4A00BE] text-md text-white w-full">
                    <DollarSign className="w-4 h-4" />
                    Create CPM Contest
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              setShowSecondPopup(false);
              setShowThirdPopup(true);
            }}
            className="bg-gradient-to-r text-md from-purple-400 to-purple-600 text-white px-8 py-3 rounded-full font-semibold hover:from-purple-500 hover:to-purple-700"
          >
            Next Step
          </button>
        </div>
      </div>
    </div>
  );

  const renderThirdPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
  <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] p-12 text-center relative">
    {/* Skip */}
    <button
      onClick={handleCloseAll}
     className="absolute top-6 right-6 z-10 px-8 py-1.5 text-[#4A00BE] border border-[#4A00BE] rounded-full transition-all duration-200 bg-white/80 backdrop-blur-sm"
    >
      Skip
    </button>

    <CardContent className="mt-8 p-6 border border-[#7F39EC] rounded-2xl bg-[#D9C0FF26]">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Ready to Start?
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          Start creating contests and campaigns
        </p>
      </div>

      <div className="text-center">
        <Link href="/dashboard/contests/create">
          <Button className="bg-[#4A00BE] w-full hover:bg-[#4A00BE] text-white py-3 px-8 text-lg flex items-center justify-center gap-2">
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

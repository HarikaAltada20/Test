"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, CreditCard, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentAnimationProps {
  isVisible: boolean;
  type: "success" | "failure";
  amount?: number;
  error?: string;
  onComplete?: () => void;
  className?: string;
}

export function PaymentAnimation({
  isVisible,
  type,
  amount,
  error,
  onComplete,
  className,
}: PaymentAnimationProps) {
  const [stage, setStage] = useState<"processing" | "result" | "complete">(
    "processing"
  );
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const isDark = mode === "dark";

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

  useEffect(() => {
    if (!isVisible) {
      setStage("processing");
      setProgress(0);
      return;
    }

    // Animate progress bar during processing
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 100);

    // Stage 1: Processing (2 seconds)
    const timer1 = setTimeout(() => {
      setProgress(100);
      setStage("result");
      clearInterval(progressInterval);
    }, 2000);

    // Stage 2: Show result (success: 2.5s, failure: 3s)
    const showDuration = type === "success" ? 2500 : 3000;
    const timer2 = setTimeout(() => {
      setStage("complete");
    }, 2000 + showDuration);

    // Stage 3: Auto-close (success: 1s, failure: 1.5s)
    const closeDuration = type === "success" ? 1000 : 1500;
    const timer3 = setTimeout(() => {
      onComplete?.();
    }, 2000 + showDuration + closeDuration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isVisible, type, onComplete]);

  if (!isVisible) return null;

  const isSuccess = type === "success";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/60 backdrop-blur-md",
        className
      )}
    >
      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 border",
          isDark ? "bg-[#06021D]" : " bg-white border-gray-100"
        )}
      >
        {/* Main Content */}
        <div className="relative z-10 flex flex-col items-center space-y-6 w-full">
          {/* Icon Section */}
          <div className="relative flex items-center justify-center">
            {stage === "processing" && (
              <div className="relative">
                <div
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center",
                    isDark
                      ? "bg-[#FFFFFF42] text-white"
                      : "bg-blue-50 text-blue-600"
                  )}
                >
                  <CreditCard className="w-7 h-7" />
                </div>
                <div className="absolute inset-0 w-16 h-16 border-3 border-blue-200 dark:border-blue-800 rounded-full animate-spin border-t-blue-600 dark:border-t-blue-400"></div>
              </div>
            )}

            {(stage === "result" || stage === "complete") && (
              <div
                // className={cn(
                //   "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-700 ease-out",
                //   isSuccess
                //     ? "bg-green-50 dark:bg-green-900/20 scale-110"
                //     : "bg-red-50 dark:bg-red-900/20 scale-110"
                // )}
                className={cn(
                  "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-700 ease-out scale-110",
                  isSuccess
                    ? isDark
                      ? "bg-[#57D3034A]"
                      : "bg-green-50"
                    : isDark
                    ? "bg-[#FF636354]"
                    : "bg-red-50"
                )}
              >
                {isSuccess ? (
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 animate-bounce" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                )}

                {/* Subtle ring animation */}
                <div
                  className={cn(
                    "absolute inset-0 rounded-full border-2 animate-ping opacity-20",
                    isSuccess
                      ? "border-green-500 dark:border-green-400"
                      : "border-red-500 dark:border-red-400"
                  )}
                />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="text-center space-y-3 w-full">
            {stage === "processing" && (
              <>
                <h3
                  className={cn(
                    "text-lg font-semibold",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Processing Payment
                </h3>
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Please wait while we securely process your payment
                </p>
                {amount && (
                  <div
                    className={cn(
                      "mt-3 px-4 py-2 rounded-xl",
                      isDark
                        ? "bg-[#06021D] text-white"
                        : "bg-gray-50 text-gray-900"
                    )}
                  >
                    <p className="text-base font-medium">
                      ${amount.toFixed(2)}
                    </p>
                  </div>
                )}
              </>
            )}

            {(stage === "result" || stage === "complete") && isSuccess && (
              <>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Payment Successful
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your payment has been processed successfully
                </p>
                {amount && (
                  <div className="mt-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                      +${amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Added to your wallet
                    </p>
                  </div>
                )}
              </>
            )}

            {(stage === "result" || stage === "complete") && !isSuccess && (
              <>
                <h3
                  className={cn(
                    "text-xl font-bold",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  Payment Failed
                </h3>
                <p
                  className={cn(
                    "text-sm",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                >
                  We couldn't process your payment
                </p>
                {error && (
                  <div
                    className={cn(
                      "mt-3 px-4 py-3 rounded-xl border",
                      isDark
                        ? "bg-[#FF303036] border-[#FF3030] text-white"
                        : "bg-red-50 border text-red-500 border-red-200 "
                    )}
                  >
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Please try again with a different payment method
                </p>
              </>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out rounded-full",
                  stage === "processing" && "bg-blue-500 dark:bg-blue-400",
                  stage === "result" &&
                    isSuccess &&
                    "bg-green-500 dark:bg-green-400",
                  stage === "result" &&
                    !isSuccess &&
                    "bg-red-500 dark:bg-red-400",
                  stage === "complete" &&
                    isSuccess &&
                    "bg-green-500 dark:bg-green-400",
                  stage === "complete" &&
                    !isSuccess &&
                    "bg-red-500 dark:bg-red-400"
                )}
                style={{
                  width: stage === "processing" ? `${progress}%` : "100%",
                }}
              />
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center">
            <p
              className={cn(
                "text-xs font-medium transition-colors duration-300",
                stage === "processing" && "text-blue-600 dark:text-blue-400",
                stage === "result" &&
                  isSuccess &&
                  "text-green-600 dark:text-green-400",
                stage === "result" &&
                  !isSuccess &&
                  "text-red-600 dark:text-red-400",
                stage === "complete" && "text-gray-500 dark:text-gray-400"
              )}
            >
              {stage === "processing" && "Securely processing..."}
              {stage === "result" && isSuccess && "Transaction completed"}
              {stage === "result" && !isSuccess && "Transaction declined"}
              {stage === "complete" && "Finishing up..."}
            </p>
          </div>
        </div>

        {/* Subtle background pattern for success */}
        {stage === "result" && isSuccess && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute top-4 right-4 w-2 h-2 bg-green-400 rounded-full opacity-30 animate-pulse" />
            <div
              className="absolute top-8 right-8 w-1 h-1 bg-green-500 rounded-full opacity-40 animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
            <div
              className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-green-400 rounded-full opacity-25 animate-pulse"
              style={{ animationDelay: "1s" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Backwards compatibility - Success Animation
export function PaymentSuccessAnimation(
  props: Omit<PaymentAnimationProps, "type">
) {
  return <PaymentAnimation {...props} type="success" />;
}

// New Failure Animation
export function PaymentFailureAnimation(
  props: Omit<PaymentAnimationProps, "type">
) {
  return <PaymentAnimation {...props} type="failure" />;
}

// Simple loading animation for inline use
export function PaymentLoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className="w-4 h-4 border-2 border-blue-200 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Processing...
      </span>
    </div>
  );
}

// Success checkmark animation for inline use
export function PaymentSuccessCheck({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center space-x-2 text-green-600 dark:text-green-400",
        className
      )}
    >
      <CheckCircle className="h-5 w-5" />
      <span className="text-sm font-medium">Payment successful</span>
    </div>
  );
}

// Failure X animation for inline use
export function PaymentFailureCheck({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center space-x-2 text-red-600 dark:text-red-400",
        className
      )}
    >
      <XCircle className="h-5 w-5" />
      <span className="text-sm font-medium">Payment failed</span>
    </div>
  );
}

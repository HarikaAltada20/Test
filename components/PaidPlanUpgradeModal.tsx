"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Phone, Zap, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const BOOK_A_CALL_URL = "https://calendly.com/guptavishesh2/30min";

interface PaidPlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export function PaidPlanUpgradeModal({
  isOpen,
  onClose,
  featureName = "CPM Contest",
}: PaidPlanUpgradeModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"light" | "dark">("light");

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

  const isDark = mode === "dark";

  const normalizedFeature = featureName.toLowerCase();
  const benefits = normalizedFeature.includes("dual")
    ? [
        "Access dual rewards contests with combined payout models",
        "Reward creators through both milestone and CPM performance",
        "Run blended campaigns under one controlled budget",
        "Priority support & dedicated account management",
      ]
    : normalizedFeature.includes("milestone")
      ? [
          "Access milestone contests with target-based payouts",
          "Set clear reward tiers tied to view milestones",
          "Control campaign spend with structured payout ladders",
          "Priority support & dedicated account management",
        ]
      : [
          "Access CPM contests and pay per 1,000 views",
          "Scale content campaigns with predictable performance costs",
          "Unlock higher creator limits & lower commission",
          "Priority support & dedicated account management",
        ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent
        className={cn(
          "max-w-md w-[95vw]",
          isDark ? "bg-[#06021D] border-gray-700 text-white" : "bg-white text-black"
        )}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div
              className={cn(
                "flex items-center justify-center h-14 w-14 rounded-full",
                isDark
                  ? "bg-purple-900/50"
                  : "bg-purple-100"
              )}
            >
              <Crown
                className={cn(
                  "h-7 w-7",
                  isDark ? "text-purple-300" : "text-purple-600"
                )}
              />
            </div>
          </div>
          <DialogTitle
            className={cn(
              "text-center text-xl font-bold",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            Upgrade to Access {featureName}
          </DialogTitle>
          <p
            className={cn(
              "text-center text-sm mt-1",
              isDark ? "text-gray-300" : "text-gray-500"
            )}
          >
            {featureName} is available on paid plans. Upgrade now to unlock
            this feature and grow your brand faster.
          </p>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Benefits list */}
          <div
            className={cn(
              "rounded-xl p-4 space-y-2",
              isDark
                ? "bg-purple-900/20 border border-purple-800/40"
                : "bg-purple-50 border border-purple-100"
            )}
          >
            {benefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2">
                <Check
                  className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    isDark ? "text-purple-400" : "text-purple-600"
                  )}
                />
                <span
                  className={cn(
                    "text-sm",
                    isDark ? "text-gray-200" : "text-gray-700"
                  )}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3 pt-1">
            <Button
              onClick={() => {
                onClose();
                router.push("/pricing");
              }}
              className={cn(
                "w-full py-5 rounded-xl text-base font-semibold flex items-center justify-center gap-2",
                isDark
                  ? "bg-[#7F39EC] hover:bg-[#6A29D9] text-white"
                  : "bg-[#4A00BE] hover:bg-[#3900a0] text-white"
              )}
            >
              <Zap className="h-4 w-4" />
              Upgrade My Plan
            </Button>

            <a
              href={BOOK_A_CALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={cn(
                "w-full py-[10px] rounded-xl text-base font-medium flex items-center justify-center gap-2 border transition-colors",
                isDark
                  ? "border-gray-600 text-gray-200 hover:bg-gray-800"
                  : "border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Phone className="h-4 w-4" />
              Book a Call — We&apos;ll Help You Get Started
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Gift, Users, Building2, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildReferralLinks, getReferralCode } from "@/lib/referral-links";
import { useToast } from "@/hooks/use-toast";

export type ReferralEarnAudience = "creator" | "advertiser";

interface ReferralEarnModalProps {
  isOpen: boolean;
  onClose: () => void;
  audience: ReferralEarnAudience;
  referralCode?: string | null;
  username?: string | null;
}

export function ReferralEarnModal({
  isOpen,
  onClose,
  audience,
  referralCode,
  username,
}: ReferralEarnModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [origin, setOrigin] = useState("https://www.gameofcreators.com");

  const code = getReferralCode(referralCode, username);
  const isCreatorAudience = audience === "creator";

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, [isOpen]);

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

  const links = useMemo(
    () => (code ? buildReferralLinks(code, origin) : null),
    [code, origin],
  );

  const primaryLink = links
    ? isCreatorAudience
      ? links.creators
      : links.brands
    : "";

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard.`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy manually.",
        variant: "destructive",
      });
    }
  };

  const isDark = mode === "dark";
  const title = isCreatorAudience
    ? "Refer and earn upto $100"
    : "Refer & earn 30% commission";

  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent className="sm:max-w-[550px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn(
              "flex items-center gap-2",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            <Gift className="h-5 w-5 text-[#4A00BE]" />
            {title}
          </DialogTitle>
          <DialogDescription
            className={cn(isDark ? "text-gray-300" : "text-gray-600")}
          >
            {isCreatorAudience
              ? "Invite creators with your personal link and earn when they join and win."
              : "Invite brands to Game of Creators and earn commission on their subscriptions."}
          </DialogDescription>
        </DialogHeader>

        {!code ? (
          <p
            className={cn(
              "text-sm rounded-lg border px-4 py-3",
              isDark
                ? "border-yellow-700/50 bg-yellow-900/20 text-yellow-200"
                : "border-yellow-200 bg-yellow-50 text-yellow-800",
            )}
          >
            Set up your username first to get a referral code and shareable
            link.
          </p>
        ) : (
          <div className="space-y-5">
            <div
              className={cn(
                "rounded-xl border p-4 space-y-3",
                isDark
                  ? "border-[#4A00BE]/40 bg-[#170337]/60"
                  : "border-[#D1B7F9] bg-[#7F39EC14]",
              )}
            >
              {isCreatorAudience ? (
                <>
                  <div className="flex items-start gap-3">
                    <Coins className="h-5 w-5 shrink-0 text-[#4A00BE] mt-0.5" />
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        100 coins per signup
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-0.5",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        Earn 100 coins for each person who joins through your
                        referral.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 shrink-0 text-[#4A00BE] mt-0.5" />
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        10% of contest winnings
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-0.5",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                       Additionally, you will earn 10% of their winnings, up to $100.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 shrink-0 text-[#4A00BE] mt-0.5" />
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        Refer more brands
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-0.5",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        Share the platform with other brands and grow the
                        community.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Gift className="h-5 w-5 shrink-0 text-[#4A00BE] mt-0.5" />
                    <div>
                      <p
                        className={cn(
                          "font-medium",
                          isDark ? "text-white" : "text-gray-900",
                        )}
                      >
                        30% subscription commission
                      </p>
                      <p
                        className={cn(
                          "text-sm mt-0.5",
                          isDark ? "text-gray-300" : "text-gray-600",
                        )}
                      >
                        If any brand signs up and pays through your referral, you earn 30% commission on subscription fees every time they pay, up to $2000.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label className={cn(isDark ? "text-white" : "text-gray-900")}>
                Referral code
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={code}
                  className={cn(
                    isDark
                      ? "bg-[#06021d] border-gray-600 text-white"
                      : "bg-white text-gray-900",
                  )}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="bg-[#4A00BE] text-white shrink-0"
                  onClick={() => copyToClipboard(code, "Referral code")}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className={cn(isDark ? "text-white" : "text-gray-900")}>
                Referral link
              </Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={primaryLink}
                  className={cn(
                    isDark
                      ? "bg-[#06021d] border-gray-600 text-white"
                      : "bg-white text-gray-900",
                  )}
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="bg-[#4A00BE] text-white shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      primaryLink,
                      isCreatorAudience ? "Creators link" : "Brands link",
                    )
                  }
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-gray-400" : "text-gray-500",
                )}
              >
                {isCreatorAudience
                  ? "Best for inviting creators (lands on /creators)."
                  : "Best for inviting brands (lands on /brands)."}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

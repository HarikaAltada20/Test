"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignPaymentModalProps {
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

export function CampaignPaymentModal({
  open,
  onClose,
  isDark,
  headerExtra,
  children,
  disabled = false,
}: CampaignPaymentModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4",
        "bg-black/60 backdrop-blur-sm",
      )}
    >
      <div
        className={cn(
          "relative flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl shadow-2xl",
          isDark
            ? "border border-white/15 bg-[#180438] text-white"
            : "border border-[#e6e6ea] bg-white text-[#1a1a1a]",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-payment-title"
      >
        <div
          className={cn(
            "flex-shrink-0 border-b px-5 py-4 sm:px-6",
            isDark ? "border-white/10" : "border-[#e6e6ea]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="campaign-payment-title"
                className={cn(
                  "text-xl font-bold tracking-tight sm:text-2xl",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                Campaign Payment
              </h2>
              <p
                className={cn(
                  "mt-1 text-sm",
                  isDark ? "text-gray-400" : "text-[#6d6d75]",
                )}
              >
                Complete payment to submit your campaign for review
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                isDark
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-[#6d6d75] hover:bg-[#f3f3f5] hover:text-[#1a1a1a]",
                disabled && "pointer-events-none opacity-50",
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {headerExtra ? <div className="mt-4">{headerExtra}</div> : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>

        <div
          className={cn(
            "flex-shrink-0 border-t px-5 py-4 sm:px-6",
            isDark ? "border-white/10" : "border-[#e6e6ea]",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={disabled}
            className={cn(
              "w-full rounded-lg",
              isDark
                ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                : "border-[#1a1a1a] bg-white text-[#1a1a1a] hover:bg-[#f3f3f5]",
            )}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

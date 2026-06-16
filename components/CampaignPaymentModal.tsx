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
            ? "border border-gray-800 bg-[#06021D] text-white"
            : "border border-gray-200 bg-white text-gray-900",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-payment-title"
      >
        <div className="flex-shrink-0 border-b px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2
                id="campaign-payment-title"
                className={cn(
                  "text-xl font-bold tracking-tight sm:text-2xl",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Campaign Payment
              </h2>
              <p
                className={cn(
                  "mt-1 text-sm",
                  isDark ? "text-gray-400" : "text-gray-600",
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
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
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
            isDark ? "border-gray-800" : "border-gray-100",
          )}
        >
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={disabled}
            className={cn(
              "w-full rounded-full",
              isDark
                ? "border-gray-600 bg-transparent text-gray-300 hover:bg-white/5 hover:text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            )}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

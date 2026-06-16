"use client";

import LoadingSpinner from "@/components/loading/LoadingSpinner";
import { cn } from "@/lib/utils";

export type CampaignPaymentProcessingPhase =
  | "verifying"
  | "submitting"
  | "redirecting";

const PHASE_COPY: Record<
  CampaignPaymentProcessingPhase,
  { title: string; subtitle: string }
> = {
  verifying: {
    title: "Processing your payment",
    subtitle: "Confirming your Stripe payment. Please don't close this page.",
  },
  submitting: {
    title: "Processing your campaign",
    subtitle: "Submitting your campaign for review. This may take a moment.",
  },
  redirecting: {
    title: "Almost done",
    subtitle: "Taking you to your campaign page…",
  },
};

type CampaignPaymentProcessingOverlayProps = {
  phase: CampaignPaymentProcessingPhase;
  className?: string;
};

export function CampaignPaymentProcessingOverlay({
  phase,
  className,
}: CampaignPaymentProcessingOverlayProps) {
  const copy = PHASE_COPY[phase];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm px-6",
        className,
      )}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="campaign-payment-processing-title"
      aria-describedby="campaign-payment-processing-subtitle"
    >
      <LoadingSpinner />
      <div className="mt-8 max-w-md text-center space-y-2">
        <h2
          id="campaign-payment-processing-title"
          className="text-xl font-semibold text-foreground"
        >
          {copy.title}
        </h2>
        <p
          id="campaign-payment-processing-subtitle"
          className="text-sm text-muted-foreground"
        >
          {copy.subtitle}
        </p>
      </div>
    </div>
  );
}

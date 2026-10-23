"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Wallet,
  Loader2,
  Lock,
  ShieldCheck,
  Check,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { allowNextBeforeUnload, markCreateFlowReturnStep, markEditFlowReturnScroll } from "@/lib/before-unload-utils";
import { PaymentAnimation } from "@/components/ui/payment-success-animation";
import { cn } from "@/lib/utils";

interface ContestPaymentSelectionProps {
  contestAmount: number;
  prizePoolAmount?: number;
  bonusBudgetAmount?: number;
  contestTitle: string;
  contestId?: string;
  commissionPercentage: number;
  returnPath?: string;
  onPaymentSuccess: (paymentDetails: any) => void;
  onPaymentError: (error: string) => void;
  disabled?: boolean;
  isIncrease?: boolean;
  isDecrease?: boolean;
  isAdminPayAsBrand?: boolean;
  targetAdvertiserId?: string;
}

export function ContestPaymentSelection({
  contestAmount,
  prizePoolAmount,
  bonusBudgetAmount,
  contestTitle,
  contestId,
  commissionPercentage,
  returnPath,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
  isIncrease = false,
  isDecrease = false,
  isAdminPayAsBrand = false,
  targetAdvertiserId,
}: ContestPaymentSelectionProps) {
  const baseBudgetInCents = Math.round(contestAmount * 100);
  const prizePoolInCents = Math.round((prizePoolAmount ?? contestAmount) * 100);
  const bonusBudgetInCents = bonusBudgetAmount
    ? Math.round(bonusBudgetAmount * 100)
    : 0;

  const commissionAmountInCents = Math.round(
    baseBudgetInCents * (commissionPercentage / 100),
  );
  const totalAmountInCents = baseBudgetInCents + commissionAmountInCents;
  const totalAmountInDollars = totalAmountInCents / 100;

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<
    "wallet" | "stripe" | "split"
  >("wallet");
  const [walletAmount, setWalletAmount] = useState<number>(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationType, setAnimationType] = useState<"success" | "failure">(
    "success",
  );
  const [animationAmount, setAnimationAmount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [defaultMethodSet, setDefaultMethodSet] = useState(false);

  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") return dataMode;
    if (document.documentElement.classList.contains("dark")) return "dark";
    return "light";
  };

  const [mode, setMode] = useState<"light" | "dark">(getInitialMode);

  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };

    setMode(readMode());

    const observer = new MutationObserver(() => setMode(readMode()));
    const dataModeTarget = document.querySelector("[data-mode]");
    if (dataModeTarget) {
      observer.observe(dataModeTarget, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const response = isAdminPayAsBrand && targetAdvertiserId
          ? await fetch(`/api/admin/advertisers/${targetAdvertiserId}/balance`)
          : await fetch("/api/payments/balance");
        const data = await response.json();
        if (data.balance !== undefined) {
          setWalletBalance(data.balance);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [isAdminPayAsBrand, targetAdvertiserId]);

  useEffect(() => {
    if (!isLoadingBalance && !defaultMethodSet) {
      let defaultMethod: "wallet" | "stripe" | "split" = "stripe";

      if (isAdminPayAsBrand) {
        defaultMethod = "wallet";
      } else if (walletBalance >= totalAmountInCents) {
        defaultMethod = "wallet";
      } else if (walletBalance > 0) {
        defaultMethod = "split";
      }

      setPaymentMethod(defaultMethod);
      setDefaultMethodSet(true);
    }
  }, [
    isLoadingBalance,
    walletBalance,
    totalAmountInCents,
    defaultMethodSet,
    isAdminPayAsBrand,
  ]);

  useEffect(() => {
    if (paymentMethod === "split") {
      const maxFromWallet = Math.min(walletBalance, totalAmountInCents);
      setWalletAmount(maxFromWallet);
    } else if (paymentMethod === "wallet") {
      setWalletAmount(totalAmountInCents);
    } else {
      setWalletAmount(0);
    }
  }, [paymentMethod, walletBalance, totalAmountInCents]);

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value as "wallet" | "stripe" | "split");
  };

  const handleWalletAmountChange = (value: number) => {
    const valueInCents = Math.round(value * 100);
    const maxWallet = Math.min(walletBalance, totalAmountInCents);

    if (valueInCents >= 0 && valueInCents <= maxWallet) {
      setWalletAmount(valueInCents);
    }
  };

  const handlePaymentSuccess = (paymentDetails: any) => {
    setAnimationAmount(contestAmount);
    setAnimationType("success");
    setShowAnimation(true);
    onPaymentSuccess(paymentDetails);
  };

  const handlePaymentError = (error: string) => {
    setAnimationAmount(contestAmount);
    setAnimationType("failure");
    setErrorMessage(error);
    onPaymentError(error);
  };

  const handleAnimationComplete = () => {
    setShowAnimation(false);
    setErrorMessage("");
  };

  const handleWalletPayment = async () => {
    setIsProcessingWallet(true);

    try {
      const endpoint =
        isAdminPayAsBrand && contestId
          ? `/api/admin/contests/${contestId}/pay-as-brand`
          : "/api/payments/contest";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          amount: totalAmountInDollars,
          paymentMethod: "wallet",
          commissionPercentage,
          isIncrease: isIncrease || false,
          isDecrease: isDecrease || false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Wallet payment failed");
      }

      handlePaymentSuccess(result);
    } catch (error: any) {
      handlePaymentError(error.message || "Wallet payment failed");
    } finally {
      setIsProcessingWallet(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (!contestId) {
      toast.error("Campaign ID is missing. Please save your campaign first.");
      return;
    }

    if (!returnPath) {
      toast.error("Payment return path is not configured.");
      return;
    }

    setIsRedirecting(true);

    try {
      const response = await fetch("/api/payments/contest/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contestId,
          amount: totalAmountInDollars,
          paymentMethod,
          commissionPercentage,
          isIncrease: isIncrease || false,
          isDecrease: isDecrease || false,
          returnPath,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to start secure checkout");
      }

      allowNextBeforeUnload();
      if (returnPath?.includes("/contests/create")) {
        markCreateFlowReturnStep("prize");
      } else if (returnPath?.includes("/edit")) {
        markEditFlowReturnScroll();
      }
      window.location.href = data.url;
    } catch (error) {
      console.error("Contest checkout error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start secure checkout",
      );
      setIsRedirecting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (paymentMethod === "wallet") {
      void handleWalletPayment();
    } else {
      void handleStripeCheckout();
    }
  };

  const canUseWallet = walletBalance >= totalAmountInCents;
  const needsStripe =
    !isAdminPayAsBrand &&
    (paymentMethod === "stripe" || paymentMethod === "split");
  const stripeAmount = needsStripe
    ? totalAmountInCents - (paymentMethod === "split" ? walletAmount : 0)
    : 0;
  const isDark = mode === "dark";
  const isBusy =
    disabled || isLoadingBalance || isRedirecting || isProcessingWallet;

  const methodCardClass = (selected: boolean, optionDisabled = false) =>
    cn(
      "relative flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all",
      selected
        ? isDark
          ? "border-white bg-white/10 ring-1 ring-white/20"
          : "border-[#1a1a1a] bg-[#f3f3f5] ring-1 ring-[#1a1a1a]/10"
        : isDark
          ? "border-white/15 hover:border-white/30"
          : "border-[#e6e6ea] hover:border-[#1a1a1a]/40",
      optionDisabled && "cursor-not-allowed opacity-50 hover:border-[#e6e6ea]",
    );

  const iconCircleClass = (selected: boolean) =>
    cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
      selected
        ? isDark
          ? "bg-white text-[#1a1a1a]"
          : "bg-[#1a1a1a] text-white"
        : isDark
          ? "bg-white/10 text-gray-400"
          : "bg-[#f3f3f5] text-[#6d6d75]",
    );

  return (
    <div className="w-full space-y-5">
      {/* Order summary */}
      <div
        className={cn(
          "rounded-xl border p-4",
          isDark
            ? "border-white/15 bg-white/5"
            : "border-[#e6e6ea] bg-[#f6f6f7]",
        )}
      >
        <div className="mb-3">
          <p
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              isDark ? "text-gray-300" : "text-[#3a3a42]",
            )}
          >
            {contestTitle}
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className={isDark ? "text-gray-400" : "text-[#6d6d75]"}>
              {isIncrease ? "Prize pool increase" : "Prize pool"}
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              {formatCurrencyFromCents(prizePoolInCents)}
            </span>
          </div>
          {bonusBudgetInCents > 0 && (
            <div className="flex justify-between">
              <span className={isDark ? "text-gray-400" : "text-[#6d6d75]"}>
                Bonus budget
              </span>
              <span
                className={cn(
                  "font-medium tabular-nums",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              >
                {formatCurrencyFromCents(bonusBudgetInCents)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className={isDark ? "text-gray-400" : "text-[#6d6d75]"}>
              Platform commission ({commissionPercentage}%)
            </span>
            <span
              className={cn(
                "font-medium tabular-nums",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              {formatCurrencyFromCents(commissionAmountInCents)}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "my-4 border-t border-dashed",
            isDark ? "border-white/15" : "border-[#d5d5db]",
          )}
        />

        <div className="flex items-end justify-between gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              isDark ? "text-gray-400" : "text-[#6d6d75]",
            )}
          >
            Total due
          </span>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              isDark ? "text-white" : "text-[#1a1a1a]",
            )}
          >
            {formatCurrencyFromCents(totalAmountInCents)}
          </span>
        </div>

        {needsStripe && (walletAmount > 0 || stripeAmount > 0) && (
          <p
            className={cn(
              "mt-2 text-xs tabular-nums",
              isDark ? "text-gray-500" : "text-gray-500",
            )}
          >
            {paymentMethod === "split" && walletAmount > 0 && (
              <>Wallet {formatCurrencyFromCents(walletAmount)}</>
            )}
            {paymentMethod === "split" &&
              walletAmount > 0 &&
              stripeAmount > 0 &&
              " · "}
            {stripeAmount > 0 && (
              <>Stripe {formatCurrencyFromCents(stripeAmount)}</>
            )}
          </p>
        )}
      </div>

      {/* Payment methods */}
      <div className="space-y-3">
        <Label
          className={cn(
            "text-sm font-semibold",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          {isAdminPayAsBrand ? "Pay as brand (wallet only)" : "Payment method"}
        </Label>

        {isLoadingBalance && (
          <div
            className={cn(
              "flex items-center gap-2 text-sm",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading payment options…
          </div>
        )}

        <RadioGroup
          value={paymentMethod}
          onValueChange={handlePaymentMethodChange}
          disabled={isBusy}
          className="space-y-2.5"
        >
          <label
            htmlFor="wallet"
            className={methodCardClass(
              paymentMethod === "wallet",
              !canUseWallet || disabled,
            )}
          >
            <RadioGroupItem
              value="wallet"
              id="wallet"
              disabled={!canUseWallet || disabled}
              className="sr-only"
            />
            <div className={iconCircleClass(paymentMethod === "wallet")}>
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Pay from wallet
                  </span>
                  {canUseWallet && (
                    <Badge
                      variant="secondary"
                      className="h-5 px-2 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      {isAdminPayAsBrand ? "Brand wallet" : "Instant"}
                    </Badge>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium tabular-nums",
                    isDark ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  {isLoadingBalance ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : (
                    `${formatCurrencyFromCents(walletBalance)} available`
                  )}
                </span>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  isDark ? "text-gray-400" : "text-gray-500",
                )}
              >
                {canUseWallet
                  ? isAdminPayAsBrand
                    ? "Deduct from brand wallet balance immediately"
                    : "Deduct from your wallet balance immediately"
                  : isAdminPayAsBrand
                    ? "Brand needs to top up wallet."
                    : `Insufficient balance — need ${formatCurrencyFromCents(totalAmountInCents - walletBalance)} more`}
              </p>
            </div>
            {paymentMethod === "wallet" && canUseWallet && (
              <Check
                className={cn(
                  "h-5 w-5 shrink-0",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              />
            )}
          </label>

          {!isAdminPayAsBrand && (
          <>
          <label
            htmlFor="stripe"
            className={methodCardClass(paymentMethod === "stripe", disabled)}
          >
            <RadioGroupItem
              value="stripe"
              id="stripe"
              disabled={disabled}
              className="sr-only"
            />
            <div className={iconCircleClass(paymentMethod === "stripe")}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span
                className={cn(
                  "font-medium",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Pay with Stripe
              </span>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  isDark ? "text-gray-400" : "text-gray-500",
                )}
              >
                Secure checkout — card, UPI, and more
              </p>
            </div>
            {paymentMethod === "stripe" && (
              <Check
                className={cn(
                  "h-5 w-5 shrink-0",
                  isDark ? "text-white" : "text-[#1a1a1a]",
                )}
              />
            )}
          </label>

          {walletBalance > 0 && walletBalance < totalAmountInCents && (
            <label
              htmlFor="split"
              className={methodCardClass(paymentMethod === "split", disabled)}
            >
              <RadioGroupItem
                value="split"
                id="split"
                disabled={disabled}
                className="sr-only"
              />
              <div className={iconCircleClass(paymentMethod === "split")}>
                <div className="flex">
                  <Wallet className="h-4 w-4" />
                  <ShieldCheck className="-ml-1 h-4 w-4" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Split payment
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-2 text-[10px] font-semibold uppercase tracking-wide",
                      isDark
                        ? "border-white/30 text-white"
                        : "border-[#1a1a1a] text-[#1a1a1a]",
                    )}
                  >
                    Recommended
                  </Badge>
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    isDark ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  Use wallet balance + Stripe for the remainder
                </p>

                {paymentMethod === "split" && (
                  <div className="mt-3 space-y-1.5">
                    <Label
                      htmlFor="wallet-amount"
                      className={cn(
                        "text-xs",
                        isDark ? "text-gray-400" : "text-gray-600",
                      )}
                    >
                      Wallet amount (max{" "}
                      {formatCurrencyFromCents(
                        Math.min(walletBalance, totalAmountInCents),
                      )}
                      )
                    </Label>
                    <Input
                      id="wallet-amount"
                      type="number"
                      value={(walletAmount / 100).toFixed(2)}
                      onChange={(e) =>
                        handleWalletAmountChange(parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      max={(
                        Math.min(walletBalance, totalAmountInCents) / 100
                      ).toFixed(2)}
                      step="0.01"
                      className={cn(
                        "text-sm",
                        isDark
                          ? "border-gray-700 bg-[#0A0618] text-white"
                          : "border-gray-200 bg-white",
                      )}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
              {paymentMethod === "split" && (
                <Check
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isDark ? "text-white" : "text-[#1a1a1a]",
                  )}
                />
              )}
            </label>
          )}
          </>
          )}
        </RadioGroup>
      </div>

      {needsStripe && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-3",
            isDark
              ? "border-white/15 bg-white/5"
              : "border-[#e6e6ea] bg-[#f6f6f7]",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isDark ? "bg-white/10 text-white" : "bg-[#1a1a1a] text-white",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <p
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              Secured by Stripe
            </p>
            <p
              className={cn(
                "text-xs leading-relaxed",
                isDark ? "text-gray-400" : "text-[#6d6d75]",
              )}
            >
              You&apos;ll pay on Stripe&apos;s secure checkout. Payment details
              never touch our servers.
            </p>
          </div>
        </div>
      )}

      {isRedirecting && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border px-4 py-3",
            isDark
              ? "border-white/15 bg-white/5"
              : "border-[#e6e6ea] bg-[#f3f3f5]",
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isDark ? "bg-white/10" : "bg-[#1a1a1a]",
            )}
          >
            <Loader2
              className={cn(
                "h-4 w-4 animate-spin",
                isDark ? "text-white" : "text-white",
              )}
            />
          </div>
          <div>
            <p
              className={cn(
                "text-sm font-medium",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
            >
              Opening secure checkout
            </p>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-gray-400" : "text-[#6d6d75]",
              )}
            >
              Redirecting you to Stripe to complete your payment safely.
            </p>
          </div>
        </div>
      )}

      <Button
        onClick={handlePrimaryAction}
        disabled={
          isBusy || (paymentMethod === "wallet" && !canUseWallet)
        }
        loading={isProcessingWallet || isRedirecting}
        loadingText={
          paymentMethod === "wallet"
            ? "Processing payment…"
            : "Opening secure checkout…"
        }
        className={cn(
          "w-full rounded-lg py-6 text-base font-semibold",
          isDark
            ? "bg-white text-[#1a1a1a] hover:bg-[#f3f3f5]"
            : "bg-[#1a1a1a] text-white hover:bg-black",
          (isRedirecting || isProcessingWallet) && "disabled:opacity-100",
        )}
        size="lg"
      >
        {paymentMethod === "wallet" ? (
          <>
            <Wallet className="mr-2 h-4 w-4" />
            {isAdminPayAsBrand
              ? `Pay ${formatCurrencyFromCents(totalAmountInCents)} as brand`
              : `Pay ${formatCurrencyFromCents(totalAmountInCents)} from wallet`}
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Continue to secure checkout
          </>
        )}
      </Button>

      <p
        className={cn(
          "text-center text-xs leading-relaxed",
          isDark ? "text-gray-500" : "text-gray-500",
        )}
      >
        Funds are held securely until the contest completes. Your campaign will
        be submitted for review after payment.
      </p>

      <PaymentAnimation
        isVisible={showAnimation}
        type={animationType}
        amount={animationAmount}
        error={errorMessage}
        onComplete={handleAnimationComplete}
      />
    </div>
  );
}

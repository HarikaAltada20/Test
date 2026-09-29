"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EnhancedTabs, Tab } from "@/components/ui/enhancedTabs";
import { toast } from "sonner";
import {
  Lock,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import { WALLET_TOP_UP_MAX_AMOUNT, WALLET_TOP_UP_MIN_AMOUNT } from "@/constants/subscriptionPlans";
import { cn } from "@/lib/utils";
import { SolanaPaymentFlow, type SolanaTopUpSuccessResult } from "./SolanaPaymentModal";
import { SolanaWalletProvider } from "@/components/solana/SolanaWalletProvider";

interface WalletTopUpProps {
  currentBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
  onTopUpSuccess?: (
    amountInCents: number,
    newBalanceInCents: number,
  ) => void;
  onClose?: () => void;
  onTransactionUpdate?: () => void;
  onProcessingChange?: (isProcessing: boolean) => void;
}

const formatDollarAmount = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

function useDashboardMode(): "light" | "dark" {
  const getInitialMode = (): "light" | "dark" => {
    if (typeof document === "undefined") return "light";
    const dataMode = document
      .querySelector("[data-mode]")
      ?.getAttribute("data-mode");
    if (dataMode === "dark" || dataMode === "light") {
      return dataMode;
    }
    if (document.documentElement.classList.contains("dark")) {
      return "dark";
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
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

    const observer = new MutationObserver(() => {
      setMode(readMode());
    });
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

  return mode;
}

export function WalletTopUp({
  currentBalance,
  onBalanceUpdate,
  onTopUpSuccess,
  onClose,
  onTransactionUpdate,
  onProcessingChange,
}: WalletTopUpProps) {
  const [amount, setAmount] = useState<number>(50);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showSolanaFlow, setShowSolanaFlow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "solana">(
    "stripe",
  );

  const isDark = useDashboardMode() === "dark";
  const predefinedAmounts = [25, 50, 100, 200, 500];

  const paymentTabs: Tab[] = [
    {
      id: "stripe",
      label: (
        <>
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs sm:text-sm leading-tight whitespace-normal">
            Stripe
          </span>
        </>
      ),
    },
    {
      id: "solana",
      label: (
        <>
          <Wallet className="h-4 w-4" />
          <span className="text-xs sm:text-sm leading-tight whitespace-normal">
            Solana (USDC/USDT)
          </span>
        </>
      ),
    },
  ];

  const handleTabChange = (id: string) => {
    setPaymentMethod(id as "stripe" | "solana");
    setShowSolanaFlow(false);
  };

  const isBelowMinimum =
    Number.isFinite(amount) && amount > 0 && amount < WALLET_TOP_UP_MIN_AMOUNT;

  const handleStripeCheckout = async () => {
    if (!amount || amount < WALLET_TOP_UP_MIN_AMOUNT) {
      toast.error(`Minimum top-up amount is $${WALLET_TOP_UP_MIN_AMOUNT}`);
      return;
    }

    if (amount > WALLET_TOP_UP_MAX_AMOUNT) {
      toast.error(
        `Maximum top-up amount is $${WALLET_TOP_UP_MAX_AMOUNT.toLocaleString()}`,
      );
      return;
    }

    setIsRedirecting(true);
    onProcessingChange?.(true);

    try {
      const response = await fetch("/api/payments/deposit/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to start secure checkout");
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Wallet top-up checkout error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to start secure checkout",
      );
      setIsRedirecting(false);
      onProcessingChange?.(false);
    }
  };

  const handleSolanaSuccess = (result: SolanaTopUpSuccessResult) => {
    if (onTopUpSuccess) {
      onTopUpSuccess(result.amountInCents, result.newBalanceCents);
    } else {
      onBalanceUpdate(result.newBalanceCents);
    }
    setShowSolanaFlow(false);
    onTransactionUpdate?.();
    onClose?.();
  };

  const amountSelector = (
    <>
      <div className="space-y-4">
        <Label
          className={cn(
            "text-sm font-medium",
            isDark ? "text-white" : "text-gray-700",
          )}
        >
          Quick amounts
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {predefinedAmounts.map((presetAmount) => (
            <Button
              className={cn(
                "border font-semibold",
                amount === presetAmount
                  ? "bg-[#7F39EC] hover:bg-[#6929D1] text-white border-[#7F39EC]"
                  : isDark
                    ? "text-white border-gray-600 bg-transparent hover:bg-white/5"
                    : "text-[#4A00BE] border-[#4A00BE] bg-white hover:bg-purple-50",
              )}
              key={presetAmount}
              variant={amount === presetAmount ? "default" : "outline"}
              size="sm"
              onClick={() => setAmount(presetAmount)}
            >
              ${presetAmount}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="custom-amount"
          className={cn(isDark ? "text-white" : "text-gray-700")}
        >
          Or enter custom amount
        </Label>
        <Input
          id="custom-amount"
          type="number"
          min={WALLET_TOP_UP_MIN_AMOUNT}
          max={WALLET_TOP_UP_MAX_AMOUNT}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          placeholder="Enter amount"
          className={cn(
            isBelowMinimum && "border-red-500 focus-visible:ring-red-500",
            isDark
              ? "bg-[#06021D] border-gray-600 text-white"
              : "bg-white text-black border-gray-300",
          )}
        />
        {isBelowMinimum ? (
          <p className="text-sm text-red-500 font-medium">
            Minimum top-up is ${WALLET_TOP_UP_MIN_AMOUNT}. Please enter at least
            $1.00.
          </p>
        ) : (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            Minimum ${WALLET_TOP_UP_MIN_AMOUNT}.00
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <EnhancedTabs
        tabs={paymentTabs}
        activeTab={paymentMethod}
        onTabChange={handleTabChange}
        isDark={isDark}
        light={!isDark}
        className="w-full"
      />

      <p
        className={cn(
          "text-xs -mt-2",
          isDark ? "text-gray-400" : "text-gray-500",
        )}
      >
        {paymentMethod === "stripe"
          ? "Pay with Stripe — debit card, credit card, UPI, and other local methods where available."
          : "Pay with any crypto wallet on the Solana network using USDC or USDT."}
      </p>

      <div
        className={cn(
          "p-4 rounded-xl border",
          isDark
            ? "border-gray-600 bg-[#0F0A27]/60"
            : "border-gray-200 bg-gray-50/80 shadow-sm",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isDark ? "text-gray-300" : "text-gray-600",
            )}
          >
            Current Balance
          </span>
          <span
            className={cn(
              "text-xl font-bold tabular-nums",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            {formatCurrencyFromCents(currentBalance)}
          </span>
        </div>
      </div>

      {paymentMethod === "stripe" ? (
        <div className="space-y-4">
          {amountSelector}

          <div
            className={cn(
              "rounded-lg border p-3 flex gap-3 items-start",
              isDark
                ? "border-[#2F2754] bg-[#120A30]/80"
                : "border-purple-100 bg-purple-50/60",
            )}
          >
            <ShieldCheck
              className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                isDark ? "text-green-400" : "text-green-600",
              )}
            />
            <div className="space-y-1">
              <p
                className={cn(
                  "text-sm font-medium",
                  isDark ? "text-white" : "text-gray-900",
                )}
              >
                Secured by Stripe
              </p>
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  isDark ? "text-gray-400" : "text-gray-600",
                )}
              >
                You&apos;ll pay on Stripe&apos;s secure checkout. Use debit card,
                credit card, UPI, or other methods supported in your region.
                Payment details never touch our servers.
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3",
              isDark ? "border-gray-600" : "border-gray-200",
            )}
          >
            <span
              className={cn(
                "text-sm font-medium",
                isDark ? "text-gray-300" : "text-gray-600",
              )}
            >
              Amount to add
            </span>
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              {formatDollarAmount(amount || 0)}
            </span>
          </div>

          {isRedirecting && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3",
                isDark
                  ? "border-[#7F39EC]/30 bg-[#7F39EC]/10"
                  : "border-[#7F39EC]/20 bg-gradient-to-r from-[#7F39EC]/5 to-purple-50",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isDark ? "bg-[#7F39EC]/25" : "bg-[#7F39EC]/15",
                )}
              >
                <ShieldCheck
                  className={cn(
                    "h-4 w-4",
                    isDark ? "text-[#C4A8FF]" : "text-[#7F39EC]",
                  )}
                />
              </div>
              <div className="space-y-0.5">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-[#E8DEFF]" : "text-[#5B21B6]",
                  )}
                >
                  Opening secure checkout
                </p>
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    isDark ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  You&apos;ll be redirected to Stripe to complete your payment
                  safely.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleStripeCheckout}
            disabled={!amount || amount < WALLET_TOP_UP_MIN_AMOUNT}
            loading={isRedirecting}
            loadingText="Opening secure checkout..."
            className={cn(
              "w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white py-6 text-base font-semibold",
              isRedirecting && "disabled:opacity-100",
            )}
            size="lg"
          >
            <Lock className="mr-2 h-4 w-4" />
            Continue to secure checkout
          </Button>

          <p
            className={cn(
              "text-[11px] text-center",
              isDark ? "text-gray-500" : "text-gray-400",
            )}
          >
            Secured by Stripe · Encrypted payment processing
          </p>
        </div>
      ) : showSolanaFlow ? (
        <SolanaWalletProvider>
          <SolanaPaymentFlow
            isDark={isDark}
            onSuccess={handleSolanaSuccess}
            onCancel={() => setShowSolanaFlow(false)}
          />
        </SolanaWalletProvider>
      ) : (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-5 text-center space-y-3",
              isDark
                ? "border-[#2F2754] bg-[#110927]/50"
                : "border-gray-200 bg-white",
            )}
          >
            <div
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                isDark ? "bg-[#7F39EC]/20" : "bg-purple-100",
              )}
            >
              <Wallet
                className={cn(
                  "h-6 w-6",
                  isDark ? "text-purple-300" : "text-[#7F39EC]",
                )}
              />
            </div>
            <h3
              className={cn(
                "text-lg font-semibold",
                isDark ? "text-white" : "text-gray-900",
              )}
            >
              Pay with Solana
            </h3>
            <p
              className={cn(
                "text-sm max-w-md mx-auto leading-relaxed",
                isDark ? "text-gray-300" : "text-gray-600",
              )}
            >
              Pay with any crypto wallet on the Solana network. Top up using
              USDC or USDT on Solana mainnet — Phantom, Trust Wallet, MetaMask,
              and others.
            </p>
            <ul
              className={cn(
                "text-sm space-y-1.5 text-left max-w-xs mx-auto",
                isDark ? "text-gray-300" : "text-gray-600",
              )}
            >
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Instant processing (1–2 minutes)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Low transaction fees
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                USDC &amp; USDT supported
              </li>
            </ul>
          </div>

          <Button
            onClick={() => setShowSolanaFlow(true)}
            className="w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white py-6 text-base font-semibold"
            size="lg"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Continue with Solana (USDC/USDT)
          </Button>

          <p
            className={cn(
              "text-[11px] text-center",
              isDark ? "text-gray-500" : "text-gray-400",
            )}
          >
            Solana mainnet · USDC or USDT only · Verify amount and token before
            sending
          </p>
        </div>
      )}
    </div>
  );
}

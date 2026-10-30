"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Lock, ShieldCheck, Wallet } from "lucide-react";
import { formatCurrencyFromCents } from "@/lib/currency-utils";
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from "@/constants/subscriptionPlans";
import { cn } from "@/lib/utils";
import {
  SolanaPaymentFlow,
  type SolanaTopUpSuccessResult,
} from "./SolanaPaymentModal";
import { SolanaWalletProvider } from "@/components/solana/SolanaWalletProvider";
import { payoutDialogTheme } from "@/components/payouts/payout-method-dialog/theme";

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
  isDark?: boolean;
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
  isDark: isDarkProp,
}: WalletTopUpProps) {
  const [amount, setAmount] = useState<number>(50);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [showSolanaFlow, setShowSolanaFlow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "solana">(
    "stripe",
  );

  const detectedDark = useDashboardMode() === "dark";
  const isDark = isDarkProp ?? detectedDark;
  const t = payoutDialogTheme(isDark, { brand: true });
  const predefinedAmounts = [25, 50, 100, 200, 500];

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
      <div className="space-y-2.5">
        <Label className={cn("text-sm font-medium", t.text)}>
          Quick amounts
        </Label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {predefinedAmounts.map((presetAmount) => {
            const selected = amount === presetAmount;
            return (
              <Button
                key={presetAmount}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAmount(presetAmount)}
                className={cn(
                  "h-10 rounded-full border font-semibold shadow-none",
                  selected
                    ? isDark
                      ? "goc-btn-primary hover:text-white"
                      : "border-[#171717] bg-[#171717] text-white hover:bg-[#2a2a2a] hover:text-white"
                    : isDark
                      ? "border-white/20 bg-transparent text-white hover:bg-white/10"
                      : "border-neutral-200 bg-white text-[#171717] hover:bg-[#F6F6F7]",
                )}
              >
                ${presetAmount}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="custom-amount"
          className={cn("text-sm font-medium", t.text)}
        >
          Or enter custom amount
        </Label>
        <div className="relative">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base",
              t.muted,
            )}
          >
            $
          </span>
          <Input
            id="custom-amount"
            type="number"
            min={WALLET_TOP_UP_MIN_AMOUNT}
            max={WALLET_TOP_UP_MAX_AMOUNT}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="0.00"
            className={cn(
              t.input,
              "pl-7 text-base tabular-nums",
              isBelowMinimum && t.inputError,
            )}
          />
        </div>
        {isBelowMinimum ? (
          <p className={cn("text-sm font-medium", t.error)}>
            Minimum top-up is ${WALLET_TOP_UP_MIN_AMOUNT}. Please enter at least
            $1.00.
          </p>
        ) : (
          <p className={cn("text-xs", t.muted)}>
            Minimum ${WALLET_TOP_UP_MIN_AMOUNT}.00 · Max $
            {WALLET_TOP_UP_MAX_AMOUNT.toLocaleString()}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "grid grid-cols-2 gap-1 rounded-xl border p-1",
          t.border,
          t.subtle,
        )}
        role="tablist"
        aria-label="Payment method"
      >
        {(
          [
            {
              id: "stripe" as const,
              label: "Stripe",
              icon: ShieldCheck,
            },
            {
              id: "solana" as const,
              label: "Solana",
              icon: Wallet,
            },
          ] as const
        ).map((tab) => {
          const active = paymentMethod === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setPaymentMethod(tab.id);
                setShowSolanaFlow(false);
              }}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                active
                  ? isDark
                    ? "bg-white text-[#171717] shadow-sm"
                    : "bg-white text-[#171717] shadow-sm ring-1 ring-black/5"
                  : isDark
                    ? "text-slate-300 hover:text-white"
                    : "text-[#55555F] hover:text-[#171717]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <p className={cn("text-xs leading-relaxed -mt-2", t.muted)}>
        {paymentMethod === "stripe"
          ? "Pay with Stripe — debit card, credit card, UPI, and other local methods where available."
          : "Pay with any crypto wallet on the Solana network using USDC or USDT."}
      </p>

      <div className={cn("rounded-xl border px-4 py-3", t.border, t.subtle)}>
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-wide",
            t.muted,
          )}
        >
          Current balance
        </p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t.text)}>
          {formatCurrencyFromCents(currentBalance)}
        </p>
      </div>

      {paymentMethod === "stripe" ? (
        <div className="space-y-4">
          {amountSelector}

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3",
              t.border,
              t.subtle,
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isDark ? "bg-emerald-500/15" : "bg-emerald-50",
              )}
            >
              <ShieldCheck
                className={cn(
                  "h-4 w-4",
                  isDark ? "text-emerald-400" : "text-emerald-700",
                )}
              />
            </div>
            <div className="space-y-1">
              <p className={cn("text-sm font-medium", t.text)}>
                Secured by Stripe
              </p>
              <p className={cn("text-xs leading-relaxed", t.muted)}>
                You&apos;ll pay on Stripe&apos;s secure checkout. Payment details
                never touch our servers.
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3",
              t.border,
            )}
          >
            <span className={cn("text-sm font-medium", t.muted)}>
              Amount to add
            </span>
            <span className={cn("text-lg font-semibold tabular-nums", t.text)}>
              {formatDollarAmount(amount || 0)}
            </span>
          </div>

          {isRedirecting && (
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3",
                isDark
                  ? "border-slate-600 bg-white/5"
                  : "border-neutral-200 bg-[#F6F6F7]",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  isDark ? "bg-white/10" : "bg-white",
                )}
              >
                <ShieldCheck className={cn("h-4 w-4", t.text)} />
              </div>
              <div className="space-y-0.5">
                <p className={cn("text-sm font-medium", t.text)}>
                  Opening secure checkout
                </p>
                <p className={cn("text-xs leading-relaxed", t.muted)}>
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
              "w-full gap-2",
              t.primaryButton,
              isRedirecting && "disabled:opacity-100",
            )}
            size="lg"
          >
            <Lock className="h-4 w-4" />
            Continue to secure checkout
          </Button>

          <p className={cn("text-center text-[11px]", t.muted)}>
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
              "space-y-4 rounded-xl border px-4 py-5",
              t.border,
              t.subtle,
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  isDark ? "bg-white/10" : "bg-white",
                )}
              >
                <Wallet className={cn("h-5 w-5", t.text)} />
              </div>
              <div className="min-w-0 space-y-1">
                <h3 className={cn("text-base font-semibold", t.text)}>
                  Pay with Solana
                </h3>
                <p className={cn("text-sm leading-relaxed", t.muted)}>
                  Top up with USDC or USDT on Solana mainnet using Phantom,
                  Trust Wallet, MetaMask, and others.
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {[
                "Instant processing (1–2 minutes)",
                "Low transaction fees",
                "USDC & USDT supported",
              ].map((item) => (
                <li
                  key={item}
                  className={cn("flex items-center gap-2 text-sm", t.text)}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full",
                      isDark ? "bg-emerald-500/15" : "bg-emerald-50",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3",
                        isDark ? "text-emerald-400" : "text-emerald-700",
                      )}
                    />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => setShowSolanaFlow(true)}
            className={cn("w-full gap-2", t.primaryButton)}
            size="lg"
          >
            <Wallet className="h-4 w-4" />
            Continue with Solana (USDC/USDT)
          </Button>

          <p className={cn("text-center text-[11px]", t.muted)}>
            Solana mainnet · USDC or USDT only · Verify amount and token before
            sending
          </p>
        </div>
      )}
    </div>
  );
}

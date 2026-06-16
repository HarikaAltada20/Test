"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Loader2,
  Info,
  Wallet,
  Shield,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { SOLANA_TOP_UP_MIN_AMOUNT } from "@/constants/subscriptionPlans";
import { SOLANA_NETWORK } from "@/lib/solana-utils";
import { WalletPaySection } from "@/components/solana/WalletPaySection";
import { SolanaWalletProvider } from "@/components/solana/SolanaWalletProvider";

const EXAMPLE_TRANSACTION_SIGNATURE =
  "5UfDuXk9HmP3vL8sR2xNwQj4Yt7Zc1Ab6De9Fg0Hi2Jk4Lm6No8Pq0Rs3Tu5Vw7Xy9Za";

export type SolanaTopUpSuccessResult = {
  amountInCents: number;
  newBalanceCents: number;
};

interface SolanaPaymentFlowProps {
  onSuccess?: (result: SolanaTopUpSuccessResult) => void;
  onCancel?: () => void;
  isDark?: boolean;
}

interface SolanaPaymentModalProps extends SolanaPaymentFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaymentRequest {
  id: string;
  referenceId: string;
  amount: number;
  amountCents: number;
  tokenType: "USDC" | "USDT";
  memo: string;
  walletAddress: string;
  expiresAt: string;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

type SolanaStep = "amount" | "instructions" | "verify";

const STEP_LABELS: Record<SolanaStep, string> = {
  amount: "Amount",
  instructions: "Send",
  verify: "Verify",
};

function StepIndicator({
  step,
  isDark,
}: {
  step: SolanaStep;
  isDark: boolean;
}) {
  const steps: SolanaStep[] = ["amount", "instructions", "verify"];
  const currentIndex = steps.indexOf(step);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((stepId, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;

        return (
          <React.Fragment key={stepId}>
            <div className="flex flex-col items-center gap-1 min-w-[4.5rem]">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors",
                  isActive
                    ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                    : isComplete
                      ? "border-green-500 bg-green-500 text-white"
                      : isDark
                        ? "border-gray-600 text-gray-500"
                        : "border-gray-300 text-gray-400",
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isActive
                    ? isDark
                      ? "text-white"
                      : "text-gray-900"
                    : isDark
                      ? "text-gray-500"
                      : "text-gray-400",
                )}
              >
                {STEP_LABELS[stepId]}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-12 mb-4",
                  index < currentIndex
                    ? "bg-green-500"
                    : isDark
                      ? "bg-gray-700"
                      : "bg-gray-200",
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function SolanaPaymentFlow({
  onSuccess,
  onCancel,
  isDark = false,
}: SolanaPaymentFlowProps) {
  const [step, setStep] = useState<SolanaStep>("amount");
  const [amount, setAmount] = useState<string>("50");
  const [tokenType, setTokenType] = useState<"USDC" | "USDT">("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(
    null,
  );
  const [transactionSignature, setTransactionSignature] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const predefinedAmounts = ["0.10", "25", "50", "100", "250", "500"];

  const resetFlow = () => {
    setStep("amount");
    setAmount("50");
    setTokenType("USDC");
    setPaymentRequest(null);
    setTransactionSignature("");
    setCopiedField(null);
  };

  const parsedAmount = parseFloat(amount);
  const isBelowMinimum =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount < SOLANA_TOP_UP_MIN_AMOUNT;

  const handleCreatePaymentRequest = async () => {
    if (!amount || parsedAmount < SOLANA_TOP_UP_MIN_AMOUNT) {
      toast.error(
        `Minimum top-up amount is $${SOLANA_TOP_UP_MIN_AMOUNT.toFixed(2)}`,
      );
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/solana/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          amount: parsedAmount,
          tokenType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment request");
      }

      setPaymentRequest(data.paymentRequest);
      setStep("instructions");
      toast.success("Payment request created — ready to send");
    } catch (error) {
      console.error("Error creating payment request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create payment request",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const verifyPayment = async (signature: string) => {
    const trimmedSignature = signature.trim();

    if (!trimmedSignature) {
      toast.error("Please enter your transaction signature");
      return;
    }

    if (!paymentRequest) {
      toast.error("No payment request found");
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/solana/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionSignature: trimmedSignature,
          referenceId: paymentRequest.referenceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      const amountInCents = Math.round(data.transaction.amount * 100);
      const newBalanceCents = Math.round(data.transaction.newBalance * 100);

      onSuccess?.({ amountInCents, newBalanceCents });
      resetFlow();
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment verification failed",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyPayment = async () => {
    await verifyPayment(transactionSignature);
  };

  const handleWalletPaymentSent = async (signature: string) => {
    await verifyPayment(signature);
  };

  const handleCancel = () => {
    resetFlow();
    onCancel?.();
  };

  const renderAmountStep = () => (
    <div className="space-y-5">
      <Alert
        className={cn(
          "border",
          isDark
            ? "bg-[#120A30] border-[#2F2754] text-blue-300"
            : "bg-blue-50 border-blue-200",
        )}
      >
        <Shield
          className={cn("h-4 w-4", isDark ? "text-blue-300" : "text-blue-600")}
        />
        <AlertDescription
          className={cn("text-sm", isDark ? "text-blue-200" : "text-blue-800")}
        >
          Send from any crypto wallet on Solana. Double-check the token
          (USDC/USDT), amount, and network before sending.
        </AlertDescription>
      </Alert>

      <div>
        <Label
          className={cn(
            "text-base font-semibold mb-2 block",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Select Token
        </Label>
        <p
          className={cn(
            "text-sm mb-4",
            isDark ? "text-gray-300" : "text-muted-foreground",
          )}
        >
          Choose USDC or USDT on the Solana network. Both are supported.
        </p>
        <RadioGroup
          value={tokenType}
          onValueChange={(value) => setTokenType(value as "USDC" | "USDT")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(["USDC", "USDT"] as const).map((token) => (
              <div
                key={token}
                className={cn(
                  "flex items-center space-x-2 border-2 rounded-lg p-4 cursor-pointer transition-all",
                  tokenType === token
                    ? "border-[#7F39EC] bg-[#7F39EC]/5"
                    : isDark
                      ? "border-[#2F2754] bg-[#110927] hover:border-[#AA8FFF]"
                      : "border-gray-200 hover:border-[#7F39EC]",
                )}
                onClick={() => setTokenType(token)}
              >
                <RadioGroupItem value={token} id={token.toLowerCase()} />
                <Label
                  htmlFor={token.toLowerCase()}
                  className={cn(
                    "cursor-pointer font-medium flex-1",
                    isDark ? "text-gray-100" : "text-gray-900",
                  )}
                >
                  <div>
                    {token}{" "}
                    {token === "USDC" && (
                      <span
                        className={cn(
                          "text-xs",
                          isDark ? "text-green-400" : "text-green-600",
                        )}
                      >
                        (Recommended)
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-400" : "text-gray-500",
                    )}
                  >
                    {token === "USDC" ? "USD Coin" : "Tether USD"}
                  </div>
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label
          className={cn(
            "text-base font-semibold mb-3 block",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Quick Amounts
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {predefinedAmounts.map((amt) => (
            <Button
              key={amt}
              variant={amount === amt ? "default" : "outline"}
              onClick={() => setAmount(amt)}
              className={
                amount === amt
                  ? "bg-[#7F39EC] hover:bg-[#6929D1] text-white"
                  : isDark
                    ? "border border-gray-600 text-gray-100 hover:border-[#AA8FFF]"
                    : "text-black"
              }
            >
              ${amt}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label
          htmlFor="solana-custom-amount"
          className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Custom Amount
        </Label>
        <div className="relative mt-2">
          <span
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            $
          </span>
          <Input
            id="solana-custom-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className={cn(
              "pl-7",
              isBelowMinimum && "border-red-500 focus-visible:ring-red-500",
              isDark
                ? "bg-[#06021D] border border-[#2F2754] text-white placeholder:text-gray-500"
                : "text-black",
            )}
            min={SOLANA_TOP_UP_MIN_AMOUNT}
            step="0.01"
          />
        </div>
        {isBelowMinimum ? (
          <p className="text-sm text-red-500 font-medium mt-2">
            Minimum top-up is ${SOLANA_TOP_UP_MIN_AMOUNT.toFixed(2)}. Please enter
            at least ${SOLANA_TOP_UP_MIN_AMOUNT.toFixed(2)}.
          </p>
        ) : (
          <p
            className={cn(
              "text-xs mt-2",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            Minimum ${SOLANA_TOP_UP_MIN_AMOUNT.toFixed(2)}
          </p>
        )}
      </div>

      <Button
        onClick={handleCreatePaymentRequest}
        disabled={
          isLoading ||
          !amount ||
          !Number.isFinite(parsedAmount) ||
          parsedAmount < SOLANA_TOP_UP_MIN_AMOUNT
        }
        className="w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white py-6 font-semibold"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing payment...
          </>
        ) : (
          <>Continue to send instructions</>
        )}
      </Button>
    </div>
  );

  const renderInstructionsStep = () => {
    if (!paymentRequest) return null;

    const expiryDate = new Date(paymentRequest.expiresAt).toLocaleString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    const formattedAmount = paymentRequest.amount.toFixed(2);

    return (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-[#7F39EC] to-[#4A00BE] text-white rounded-xl p-5 text-center shadow-sm">
          <div className="text-sm opacity-90 mb-1">Amount to send</div>
          <div className="text-3xl sm:text-4xl font-bold tabular-nums">
            ${formattedAmount}
          </div>
          <div className="text-base sm:text-lg mt-1 font-medium">
            {paymentRequest.tokenType} · Solana network only
          </div>
        </div>

        <WalletPaySection
          paymentRequest={paymentRequest}
          isDark={isDark}
          onPaymentSent={handleWalletPaymentSent}
          disabled={isVerifying}
        />

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span
              className={cn(
                "w-full border-t",
                isDark ? "border-gray-700" : "border-gray-200",
              )}
            />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span
              className={cn(
                "px-2",
                isDark ? "bg-[#06021D] text-gray-500" : "bg-white text-gray-500",
              )}
            >
              Or pay manually from any wallet app
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <p
            className={cn(
              "text-sm font-semibold",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            Manual transfer
          </p>

          <div
            className={cn(
              "rounded-xl border p-4 space-y-4",
              isDark
                ? "border-[#2F2754] bg-[#110927]/40"
                : "border-gray-200 bg-white shadow-sm",
            )}
          >
            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7F39EC] text-xs font-bold text-white">
                1
              </div>
              <p
                className={cn(
                  "text-sm leading-relaxed pt-0.5",
                  isDark ? "text-gray-200" : "text-gray-700",
                )}
              >
                Open your crypto wallet and send exactly{" "}
                <span className="font-semibold text-[#7F39EC]">
                  ${formattedAmount} {paymentRequest.tokenType}
                </span>{" "}
                via the Solana network only.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7F39EC] text-xs font-bold text-white">
                2
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <p
                  className={cn(
                    "text-sm leading-relaxed pt-0.5",
                    isDark ? "text-gray-200" : "text-gray-700",
                  )}
                >
                  Send the crypto to this wallet address:
                </p>
                <div
                  className={cn(
                    "rounded-lg border p-3 break-all text-sm font-mono",
                    isDark
                      ? "border-[#2F2754] bg-[#0F0A27] text-gray-100"
                      : "border-[#7F39EC]/20 bg-[#7F39EC]/5 text-gray-900",
                  )}
                >
                  {paymentRequest.walletAddress}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopy(paymentRequest.walletAddress, "wallet")
                  }
                  className={cn(
                    "h-8",
                    isDark ? "border-[#2F2754] text-gray-200" : "",
                  )}
                >
                  {copiedField === "wallet" ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5 text-xs">
                    {copiedField === "wallet" ? "Copied" : "Copy address"}
                  </span>
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7F39EC] text-xs font-bold text-white">
                3
              </div>
              <p
                className={cn(
                  "text-sm leading-relaxed pt-0.5",
                  isDark ? "text-gray-200" : "text-gray-700",
                )}
              >
                After sending, continue to verify with your transaction
                signature.
              </p>
            </div>
          </div>
        </div>

        <p
          className={cn(
            "text-xs text-center",
            isDark ? "text-gray-500" : "text-gray-400",
          )}
        >
          Payment request expires {expiryDate}
        </p>

        <div className="space-y-2">
          <Button
            onClick={() => setStep("verify")}
            className="w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white py-6 font-semibold"
            size="lg"
          >
            I&apos;ve sent the payment — verify now
          </Button>
          <Button
            variant="outline"
            onClick={() => setStep("amount")}
            className={cn("w-full", isDark ? "border-gray-600" : "")}
          >
            Back
          </Button>
        </div>
      </div>
    );
  };

  const renderVerifyStep = () => {
    if (!paymentRequest) return null;

    const solscanCluster =
      SOLANA_NETWORK === "mainnet-beta" ? "" : `?cluster=${SOLANA_NETWORK}`;

    return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div
          className={cn(
            "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
            isDark ? "bg-green-900/30" : "bg-green-100",
          )}
        >
          <Check
            className={cn(
              "h-6 w-6",
              isDark ? "text-green-400" : "text-green-600",
            )}
          />
        </div>
        <h3
          className={cn(
            "text-lg font-semibold",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Verify your payment
        </h3>
        <p
          className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}
        >
          Paste the transaction signature from your wallet. This is the proof
          that your payment was sent on Solana.
        </p>
      </div>

      <div
        className={cn(
          "rounded-lg border p-3 space-y-2",
          isDark
            ? "border-[#2F2754] bg-[#110927]/40"
            : "border-gray-200 bg-gray-50",
        )}
      >
        <p
          className={cn(
            "text-xs font-semibold",
            isDark ? "text-gray-200" : "text-gray-800",
          )}
        >
          How to find your transaction signature
        </p>
        <ul
          className={cn(
            "text-xs space-y-1.5 list-disc pl-4 leading-relaxed",
            isDark ? "text-gray-400" : "text-gray-600",
          )}
        >
          <li>
            <span className="font-medium text-[#7F39EC]">Phantom / Trust Wallet / MetaMask:</span>{" "}
            Open your wallet → Activity or History → select your USDC/USDT
            transfer → copy the transaction signature.
          </li>
          <li>
            Or open the transaction on{" "}
            <a
              href={`https://solscan.io${solscanCluster}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7F39EC] underline underline-offset-2"
            >
              Solscan
            </a>{" "}
            and copy the signature from the transaction page.
          </li>
        </ul>
        <p
          className={cn(
            "text-[11px] font-medium",
            isDark ? "text-gray-500" : "text-gray-500",
          )}
        >
          Example format (87–88 characters):
        </p>
        <p
          className={cn(
            "font-mono text-[11px] break-all rounded-md px-2 py-1.5",
            isDark
              ? "bg-[#0F0A27] text-gray-300 border border-[#2F2754]"
              : "bg-white text-gray-700 border border-gray-200",
          )}
        >
          {EXAMPLE_TRANSACTION_SIGNATURE}
        </p>
      </div>

      <div>
        <Label
          htmlFor="transaction-signature"
          className={cn(
            "font-semibold",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Transaction signature
        </Label>
        <Input
          id="transaction-signature"
          value={transactionSignature}
          onChange={(e) => setTransactionSignature(e.target.value)}
          placeholder="Paste transaction signature..."
          className={cn(
            "font-mono text-sm mt-2",
            isDark
              ? "bg-[#06021D] border border-[#2F2754] text-gray-100 placeholder:text-gray-500"
              : "",
          )}
        />
      </div>

      <Alert
        className={cn(
          "border",
          isDark
            ? "bg-[#0D2219] border-[#1F3A2F] text-green-200"
            : "bg-green-50 border-green-200",
        )}
      >
        <Info className="h-4 w-4" />
        <AlertDescription
          className={cn(
            "text-sm",
            isDark ? "text-green-200" : "text-green-800",
          )}
        >
          Works with any crypto wallet on the Solana network (Phantom, Trust
          Wallet, MetaMask, and others). Your balance updates immediately after
          verification.
        </AlertDescription>
      </Alert>

      <div
        className={cn(
          "rounded-lg border px-4 py-3 flex items-center justify-between gap-3",
          isDark
            ? "border-[#2F2754] bg-[#160D33]/40"
            : "border-gray-200 bg-gray-50",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            Support reference
          </p>
          <p
            className={cn(
              "font-mono font-bold text-sm truncate",
              isDark ? "text-gray-300" : "text-gray-700",
            )}
          >
            {paymentRequest.referenceId}
          </p>
          <p
            className={cn(
              "text-xs mt-1 leading-relaxed",
              isDark ? "text-gray-500" : "text-gray-500",
            )}
          >
            If verification fails or you need help, share this ID with support.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleCopy(paymentRequest.referenceId, "ref")}
          className="shrink-0"
        >
          {copiedField === "ref" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <Button
          onClick={handleVerifyPayment}
          disabled={isVerifying || !transactionSignature.trim()}
          className="w-full bg-[#7F39EC] hover:bg-[#6929D1] text-white py-6 font-semibold"
          size="lg"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>Verify payment</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setStep("instructions")}
          className={cn("w-full", isDark ? "border-gray-600" : "")}
        >
          Back
        </Button>
      </div>
    </div>
    );
  };

  return (
    <div>
      <StepIndicator step={step} isDark={isDark} />
      {step === "amount" && renderAmountStep()}
      {step === "instructions" && renderInstructionsStep()}
      {step === "verify" && renderVerifyStep()}
      {onCancel && step === "amount" && (
        <Button
          variant="ghost"
          onClick={handleCancel}
          className={cn("w-full mt-3", isDark ? "text-gray-400" : "")}
        >
          Back to payment methods
        </Button>
      )}
    </div>
  );
}

export function SolanaPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
}: SolanaPaymentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent className="w-[92vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn(
              "text-xl sm:text-2xl flex items-center gap-2",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            <Wallet className="h-5 w-5 text-[#7F39EC]" />
            Top up with Solana
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 solana-wallet-modal">
          <SolanaWalletProvider>
            <SolanaPaymentFlow
              isDark={isDark}
              onSuccess={(result) => {
                onSuccess?.(result);
                onClose();
              }}
              onCancel={onClose}
            />
          </SolanaWalletProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}

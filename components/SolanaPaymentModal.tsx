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
import { Copy, Check, Loader2, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface SolanaPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
  isDark?: boolean;
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

export function SolanaPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
}: SolanaPaymentModalProps) {
  const [step, setStep] = useState<"amount" | "instructions" | "verify">(
    "amount"
  );
  const [amount, setAmount] = useState<string>("50");
  const [tokenType, setTokenType] = useState<"USDC" | "USDT">("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(
    null
  );
  const [transactionSignature, setTransactionSignature] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const predefinedAmounts = ["25", "50", "100", "250", "500"];

  const handleCreatePaymentRequest = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/solana/payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          tokenType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create payment request");
      }

      setPaymentRequest(data.paymentRequest);
      setStep("instructions");
      toast.success("Payment request created successfully!");
    } catch (error) {
      console.error("Error creating payment request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create payment request"
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
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleVerifyPayment = async () => {
    if (!transactionSignature.trim()) {
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
          transactionSignature: transactionSignature.trim(),
          referenceId: paymentRequest.referenceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      toast.success(
        "Payment verified successfully! Your balance has been updated."
      );

      if (onSuccess) {
        onSuccess(data.transaction.newBalance * 100); // Convert to cents
      }

      // Reset and close
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error("Error verifying payment:", error);
      toast.error(
        error instanceof Error ? error.message : "Payment verification failed"
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleClose = () => {
    setStep("amount");
    setAmount("50");
    setTokenType("USDC");
    setPaymentRequest(null);
    setTransactionSignature("");
    setCopiedField(null);
    onClose();
  };

  const renderAmountStep = () => (
    <div className="space-y-6">
      <div>
        <Label
          className={cn(
            "text-base font-semibold mb-3 block",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Select Token
        </Label>
        <p
          className={cn(
            "text-sm mb-4",
            isDark ? "text-gray-300" : "text-muted-foreground"
          )}
        >
          Choose the token you have in your Phantom Wallet. Both USDC and USDT
          are supported.
        </p>
        <RadioGroup
          value={tokenType}
          onValueChange={(value) => setTokenType(value as "USDC" | "USDT")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={cn(
                "flex items-center space-x-2 border-2 rounded-lg p-4 cursor-pointer transition-all",
                isDark
                  ? "border-[#2F2754] bg-[#110927] hover:border-[#AA8FFF]"
                  : "border-gray-200 hover:border-[#7F39EC]"
              )}
              onClick={() => setTokenType("USDC")}
            >
              <RadioGroupItem value="USDC" id="usdc" />
              <Label
                htmlFor="usdc"
                className={cn(
                  "cursor-pointer font-medium flex-1",
                  isDark ? "text-gray-100" : "text-gray-900"
                )}
              >
                <div>
                  USDC{" "}
                  <span
                    className={cn(
                      "text-xs",
                      isDark ? "text-green-400" : "text-green-600"
                    )}
                  >
                    (Recommended)
                  </span>
                </div>
                <div
                  className={cn(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  USD Coin
                </div>
              </Label>
            </div>
            <div
              className={cn(
                "flex items-center space-x-2 border-2 rounded-lg p-4 cursor-pointer transition-all",
                isDark
                  ? "border-[#2F2754] bg-[#110927] hover:border-[#AA8FFF]"
                  : "border-gray-200 hover:border-[#7F39EC]"
              )}
              onClick={() => setTokenType("USDT")}
            >
              <RadioGroupItem value="USDT" id="usdt" />
              <Label
                htmlFor="usdt"
                className={cn(
                  "cursor-pointer font-medium flex-1",
                  isDark ? "text-gray-100" : "text-gray-900"
                )}
              >
                <div>USDT</div>
                <div
                  className={cn(
                    "text-xs",
                    isDark ? "text-gray-400" : "text-gray-500"
                  )}
                >
                  Tether USD
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label
          className={cn(
            "text-base font-semibold mb-3 block",
            isDark ? "text-white" : "text-gray-900"
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
                  ? "bg-[#7F39EC] hover:bg-[#6929D1]"
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
          htmlFor="custom-amount"
          className={cn(
            "text-base font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Custom Amount
        </Label>
        <div className="relative mt-2">
          <span
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2",
              isDark ? "text-gray-400" : "text-gray-500"
            )}
          >
            $
          </span>
          <Input
            id="custom-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className={cn(
              "pl-7",
              isDark
                ? "bg-[#06021D] border border-[#2F2754] textwhite placeholder:text-gray-500"
                : "text-black"
            )}
            min="1"
            step="0.01"
          />
        </div>
      </div>

      <Alert
        className={cn(
          "border",
          isDark
            ? "bg-[#120A30] border-[#2F2754] text-blue-300"
            : "bg-blue-50 border-blue-200"
        )}
      >
        <Info
          className={cn("h-4 w-4", isDark ? "text-blue-300" : "text-blue-600")}
        />
        <AlertDescription
          className={cn("text-sm", isDark ? "text-blue-200" : "text-blue-800")}
        >
          Payment will be processed automatically within 1-2 minutes after
          sending the transaction.
        </AlertDescription>
      </Alert>

      <Button
        onClick={handleCreatePaymentRequest}
        disabled={isLoading || !amount || parseFloat(amount) <= 0}
        className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
        size="lg"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating Request...
          </>
        ) : (
          <>Continue to Payment</>
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
      }
    );

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-[#7F39EC] to-[#4A00BE] text-white rounded-lg p-4 sm:p-6 text-center">
          <div className="text-sm opacity-90 mb-2">Amount to Send</div>
          <div className="text-3xl sm:text-4xl font-bold">
            ${paymentRequest.amount.toFixed(2)}
          </div>
          <div className="text-base sm:text-lg mt-1">
            {paymentRequest.tokenType}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Wallet Address
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  handleCopy(paymentRequest.walletAddress, "wallet")
                }
                className={cn(isDark ? "text-gray-200" : "")}
              >
                {copiedField === "wallet" ? (
                  <Check
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-green-400" : "text-green-600"
                    )}
                  />
                ) : (
                  <Copy
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}
                  />
                )}
              </Button>
            </div>
            <div
              className={cn(
                "rounded-lg p-3 break-all text-sm font-mono",
                isDark
                  ? "bg-[#0F0A27] border border-[#2F2754] text-gray-200"
                  : "bg-gray-100"
              )}
            >
              {paymentRequest.walletAddress}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label
                className={cn(
                  "font-semibold",
                  isDark ? "text-white" : "text-gray-900"
                )}
              >
                Reference ID
              </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(paymentRequest.referenceId, "ref")}
                className={cn(isDark ? "text-gray-200" : "")}
              >
                {copiedField === "ref" ? (
                  <Check
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-green-400" : "text-green-600"
                    )}
                  />
                ) : (
                  <Copy
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-gray-300" : "text-gray-700"
                    )}
                  />
                )}
              </Button>
            </div>
            <div
              className={cn(
                "rounded-lg p-3 break-all text-lg font-mono font-bold text-center",
                isDark
                  ? "bg-[#160D33] border border-[#2F2754] text-blue-200"
                  : "bg-blue-50 border-2 border-blue-300 text-blue-800"
              )}
            >
              {paymentRequest.referenceId}
            </div>
            <div className="mt-2">
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Keep this reference ID - you'll need it to verify your payment
                after sending
              </p>
            </div>
          </div>
        </div>

        <Alert
          className={cn(
            "border",
            isDark
              ? "bg-[#120A30] border-[#2F2754] text-blue-300"
              : "bg-blue-50 border-blue-200"
          )}
        >
          <AlertCircle
            className={cn(
              "h-4 w-4",
              isDark ? "text-blue-300" : "text-blue-600"
            )}
          />
          <AlertDescription
            className={cn(
              "text-sm",
              isDark ? "text-blue-200" : "text-blue-800"
            )}
          >
            <strong>Simple Instructions:</strong>
            <br />
            1. Send exactly{" "}
            <strong>
              ${paymentRequest.amount.toFixed(2)} {paymentRequest.tokenType}
            </strong>{" "}
            to the wallet address above
            <br />
            2. Make sure you're sending{" "}
            <strong>{paymentRequest.tokenType}</strong> (not the other token)
            <br />
            3. After sending, click "I've Sent the Payment" below
            <br />
            4. Enter your transaction signature and reference ID
            <br />
            <strong>Expires:</strong> {expiryDate}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Button
            onClick={() => setStep("verify")}
            className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
            size="lg"
          >
            I've Sent the Payment
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            className={cn(
              "w-full",
              isDark ? "border-gray-600 text-gray-200" : ""
            )}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl sm:text-6xl mb-4">✅</div>
        <h3
          className={cn(
            "text-lg font-semibold mb-2",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Verify Your Payment
        </h3>
        <p
          className={cn("text-sm", isDark ? "text-gray-300" : "text-gray-600")}
        >
          Enter your transaction signature from Phantom Wallet to verify your
          payment instantly.
        </p>
      </div>

      <div>
        <Label
          htmlFor="transaction-signature"
          className={cn(
            "font-semibold",
            isDark ? "text-white" : "text-gray-900"
          )}
        >
          Transaction Signature (Required)
        </Label>
        <p
          className={cn(
            "text-xs mb-2",
            isDark ? "text-gray-400" : "text-gray-500"
          )}
        >
          Find this in Phantom Wallet → Activity → Click your recent transaction
          → Copy signature
        </p>
        <Input
          id="transaction-signature"
          value={transactionSignature}
          onChange={(e) => setTransactionSignature(e.target.value)}
          placeholder="Enter transaction signature..."
          className={cn(
            "font-mono text-sm",
            isDark
              ? "bg-[#06021D] border border-[#2F2754] text-gray-100 placeholder:text-gray-500"
              : ""
          )}
        />
      </div>

      <Alert
        className={cn(
          "border",
          isDark
            ? "bg-[#0D2219] border-[#1F3A2F] text-green-200"
            : "bg-green-50 border-green-200"
        )}
      >
        <Info
          className={cn(
            "h-4 w-4",
            isDark ? "text-green-300" : "text-green-600"
          )}
        />
        <AlertDescription
          className={cn(
            "text-sm",
            isDark ? "text-green-200" : "text-green-800"
          )}
        >
          <strong>How to find your transaction signature:</strong>
          <br />
          1. Open Phantom Wallet
          <br />
          2. Tap "Activity" or recent transactions
          <br />
          3. Find your {paymentRequest?.tokenType} transaction
          <br />
          4. Tap/click on it to see details
          <br />
          5. Copy the signature (long string of numbers/letters)
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Button
          onClick={handleVerifyPayment}
          disabled={isVerifying || !transactionSignature.trim()}
          className="w-full bg-[#7F39EC] hover:bg-[#6929D1]"
          size="lg"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>Verify Payment Now</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={handleClose}
          className={cn(
            "w-full",
            isDark ? "border-gray-600 text-gray-200" : ""
          )}
        >
          Cancel
        </Button>
      </div>

      <p
        className={cn(
          "text-xs text-center",
          isDark ? "text-gray-400" : "text-gray-500"
        )}
      >
        Your balance will be updated immediately after verification
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
      <DialogContent className="w-[92vw] max-w-md sm:max-w-lg md:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn(
              "text-xl sm:text-2xl flex items-center gap-2",
              isDark ? "text-white" : "text-gray-900"
            )}
          >
            <span>💳</span>
            {step === "amount" && "Top Up with Solana"}
            {step === "instructions" && "Payment Instructions"}
            {step === "verify" && "Verify Payment"}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {step === "amount" && renderAmountStep()}
          {step === "instructions" && renderInstructionsStep()}
          {step === "verify" && renderVerifyStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

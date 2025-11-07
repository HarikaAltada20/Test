"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, DollarSign, Link } from "lucide-react";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { cn } from "@/lib/utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDetails: {
    paymentProofUrl: string;
    paymentDescription: string;
    amountInCents?: number;
    isCustom?: boolean;
    customRemarks?: string;
  }) => void;
  isLoading?: boolean;
  initialMode?: "standard" | "custom";
  showModeSwitcher?: boolean;
  showProofAndDescription?: boolean;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialMode = "standard",
  showModeSwitcher = true,
  showProofAndDescription = true,
}: PaymentModalProps) {
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");

  const [mode, setMode] = useState<"standard" | "custom">(initialMode);
  // Sync mode when modal opens with a specific initial mode
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  // Separate theme mode state, independent of payment mode
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");

  // Sync theme mode from data attribute without affecting payment mode
  useEffect(() => {
    const updateThemeMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (!modeElement) return;
      const current = modeElement.getAttribute("data-mode");
      if (current === "light" || current === "dark") {
        setThemeMode(current);
      }
    };

    updateThemeMode();

    const targetNode = document.querySelector("[data-mode]");
    if (!targetNode) return;

    const observer = new MutationObserver(() => updateThemeMode());
    observer.observe(targetNode, {
      attributes: true,
      attributeFilter: ["data-mode"],
    });
    return () => observer.disconnect();
  }, []);

  const handleConfirm = () => {
    const isCustom = mode === "custom";
    const amountInCents = isCustom
      ? Math.round((parseFloat(customAmount || "0") || 0) * 100)
      : undefined;
    onConfirm({
      paymentProofUrl: paymentProofUrl.trim(),
      paymentDescription: paymentDescription.trim(),
      amountInCents,
      isCustom,
      customRemarks: customMessage.trim() || undefined,
    });
    // Reset form
    setPaymentProofUrl("");
    setPaymentDescription("");
    setCustomAmount("");
    setCustomMessage("");
    setMode("standard");
  };

  const handleClose = () => {
    if (!isLoading) {
      setPaymentProofUrl("");
      setPaymentDescription("");
      onClose();
    }
  };
  const isDark = themeMode === "dark";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} isdark={isDark}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            className={cn(
              "flex items-center gap-2",
              isDark ? "text-white" : "text-gray-700"
            )}
          >
            {/* <DollarSign className="h-5 w-5 text-green-600" /> */}
            Mark Submission as Paid
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          {showModeSwitcher && (
            <EnhancedTabs
              tabs={[
                { id: "standard", label: "Mark as Paid" },
                { id: "custom", label: "Mark as Custom Paid" },
              ]}
              activeTab={mode}
              isDark={isDark}
              light={!isDark}
              onTabChange={(id) => setMode(id as "standard" | "custom")}
              className="mt-4 text-md"
            />
          )}

          {mode === "custom" && (
            <div className="space-y-2">
              <Label
                htmlFor="customAmount"
                className={cn(isDark ? "text-white" : "text-gray-700")}
              >
                Custom Amount (USD)
              </Label>
              <Input
                id="customAmount"
                type="number"
                min="0"
                step="0.01"
                className={cn(
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                This amount will be credited to the creator's wallet and
                recorded as a reward (custom).
              </p>
            </div>
          )}

          {mode === "custom" && (
            <div className="space-y-2">
              <Label
                htmlFor="customMessage"
                className={cn(isDark ? "text-white" : "text-gray-700")}
              >
                Message (optional)
              </Label>
              <Textarea
                id="customMessage"
                placeholder="Add a note that will appear in money transactions remarks"
                value={customMessage}
                className={cn(
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
                onChange={(e) => setCustomMessage(e.target.value)}
                disabled={isLoading}
                rows={2}
              />
            </div>
          )}

          {showProofAndDescription && (
            <div className="space-y-2">
              <Label
                htmlFor="paymentProofUrl"
                className={cn(
                  "flex items-center gap-2",
                  isDark ? "text-white" : "text-gray-700"
                )}
              >
                <Link className="h-4 w-4" />
                Payment Proof URL (Optional)
              </Label>
              <Input
                id="paymentProofUrl"
                type="url"
                placeholder="https://example.com/payment-proof"
                value={paymentProofUrl}
                onChange={(e) => setPaymentProofUrl(e.target.value)}
                disabled={isLoading}
                className={cn(
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Link to payment receipt, screenshot, or transaction proof
              </p>
            </div>
          )}

          {showProofAndDescription && (
            <div className="space-y-2">
              <Label
                htmlFor="paymentDescription"
                className={cn(isDark ? "text-white" : "text-gray-700")}
              >
                Payment Details
              </Label>
              <Textarea
                id="paymentDescription"
                placeholder="Enter payment details, transaction ID, or any additional notes..."
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
                className={cn(
                  isDark
                    ? "bg-[#06021D] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Describe the payment method, amount, or any relevant details
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col w-full gap-3 pt-4">
         
          <button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              (mode === "custom" &&
                (!customAmount ||
                  isNaN(parseFloat(customAmount)) ||
                  parseFloat(customAmount) <= 0))
            }
            className={cn(
              "w-full text-md rounded-full inline-flex items-center justify-center gap-2",
              isDark
                ? "bg-[#7F39EC] py-3 text-white"
                : " bg-[#D9C0FF61] py-3.5 text-[#7F39EC] "
            )}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {/* <DollarSign className="h-4 w-4 mr-2" /> */}
                {mode === "custom" ? "Confirm Custom Pay" : "Mark as Paid"}
              </>
            )}
          </button>
          <button onClick={handleClose} disabled={isLoading}
          className={cn(
            "w-full text-md rounded-full text-md",
            isDark
              ? "py-3 border border-[#FF5353] text-[#FF5353]"
              : "bg-[#FF323224] text-[#E50000] py-3.5"
          )}>
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className={cn(
        "max-w-xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl border border-[#e5e5e5] dark:border-white/10 bg-white dark:bg-[#111113] p-4 shadow-2xl",
        isDark ? "text-white" : "text-[#0a0a0a]",
      )}>
        <div className="flex items-start gap-4 mb-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <DollarSign className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#0a0a0a] dark:text-white">
              Mark Submission as Paid
            </DialogTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Record payout and update submission status.
            </p>
          </div>
        </div>

        <div className="space-y-6">
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
              className="mt-2 text-md"
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
                    ? "bg-[#161616] border border-white/10 text-white"
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
                    ? "bg-[#161616] border border-white/10 text-white"
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
                    ? "bg-[#161616] border border-white/10 text-white"
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
                    ? "bg-[#161616] border border-white/10 text-white"
                    : "bg-white text-black"
                )}
              />
              <p className="text-xs text-muted-foreground">
                Describe the payment method, amount, or any relevant details
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 dark:border-white/10 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="h-11 rounded-xl border-slate-200 dark:border-white/10 font-semibold px-5 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isLoading ||
              (mode === "custom" &&
                (!customAmount ||
                  isNaN(parseFloat(customAmount)) ||
                  parseFloat(customAmount) <= 0))
            }
            className="h-11 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:bg-slate-900 dark:hover:bg-slate-100 font-semibold px-6 shadow-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : mode === "custom" ? (
              "Confirm Custom Pay"
            ) : (
              "Mark as Paid"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

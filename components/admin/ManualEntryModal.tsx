"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Eye, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserSearchCombobox } from "@/components/admin/user-search/UserSearchCombobox";
import { UserDetailsModal } from "@/components/admin/user-search/UserDetailsModal";
import { UserAvatar } from "@/components/admin/user-search/UserAvatar";
import { UserTypeBadge } from "@/components/admin/user-search/UserTypeBadge";
import {
  type AdminSearchUser,
  userDisplayName,
} from "@/components/admin/user-search/types";

type User = AdminSearchUser;

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const readIsDarkFromDom = () => {
  if (typeof window === "undefined") return false;
  const modeElement = document.querySelector("[data-mode]");
  if (modeElement) {
    return modeElement.getAttribute("data-mode") === "dark";
  }
  const themeElement = document.documentElement;
  return themeElement.getAttribute("data-theme") === "dark";
};

export function ManualEntryModal({
  isOpen,
  onClose,
  onSuccess,
}: ManualEntryModalProps) {
  // Detect dark mode internally
  const [isDark, setIsDark] = useState<boolean>(readIsDarkFromDom);

  // Watch for theme changes
  useLayoutEffect(() => {
    const checkTheme = () => {
      const newIsDark = readIsDarkFromDom();
      setIsDark((prev) => (prev === newIsDark ? prev : newIsDark));
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transactionType, setTransactionType] = useState<"coins" | "cash">(
    "coins"
  );
  const [amount, setAmount] = useState("");
  const [cashCategory, setCashCategory] = useState<
    "contest_winnings" | "other_earnings" | "affiliate_earnings" | ""
  >("");
  const [transactionNote, setTransactionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const viewDetailsRef = useRef<HTMLButtonElement>(null);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedUser(null);
      setDetailsOpen(false);
      setTransactionType("coins");
      setAmount("");
      setCashCategory("");
      setTransactionNote("");
      setSubmitStatus({ type: null, message: "" });
    }
  }, [isOpen]);

  // Keep keyboard focus on the new card once a user is picked.
  useEffect(() => {
    if (selectedUser) viewDetailsRef.current?.focus();
  }, [selectedUser]);

  const canReceiveCash = !selectedUser || selectedUser.user_type === "creator";

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSubmitStatus({ type: null, message: "" });
    // Cash credits are creator-only (enforced by /api/admin/manual-entry too).
    if (user.user_type !== "creator" && transactionType === "cash") {
      setTransactionType("coins");
      setCashCategory("");
    }
  };

  const copySelectedId = async () => {
    if (!selectedUser) return;
    try {
      await navigator.clipboard.writeText(selectedUser.id);
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      setSubmitStatus({
        type: "error",
        message: "Please select a user",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setSubmitStatus({
        type: "error",
        message: "Amount must be greater than 0",
      });
      return;
    }

    if (transactionType === "cash" && !cashCategory) {
      setSubmitStatus({
        type: "error",
        message: "Please select a cash category",
      });
      return;
    }

    if (!transactionNote.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Transaction note is required",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const amountValue =
        transactionType === "coins"
          ? parseInt(amount)
          : Math.round(parseFloat(amount) * 100); // Convert dollars to cents for cash

      const response = await fetch("/api/admin/manual-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          transactionType,
          amount: amountValue,
          cashCategory: transactionType === "cash" ? cashCategory : undefined,
          transactionNote: transactionNote.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitStatus({
          type: "success",
          message: `Successfully credited ${
            transactionType === "coins" ? `${amount} coins` : `$${amount}`
          } to ${selectedUser.email}`,
        });

        // Reset form
        setSelectedUser(null);
        setAmount("");
        setCashCategory("");
        setTransactionNote("");
        setTransactionType("coins");

        // Call onSuccess callback to refresh table
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        setSubmitStatus({
          type: "error",
          message: data.error || "Failed to process manual entry",
        });
      }
    } catch (error) {
      console.error("Error submitting manual entry:", error);
      setSubmitStatus({
        type: "error",
        message: "An error occurred while processing the request",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} isdark={isDark}>
      <DialogContent
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto",
          isDark ? "text-white" : "bg-white text-gray-900"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
            Manual Entry System
          </DialogTitle>
          <DialogDescription
            className={cn(isDark ? "text-gray-400" : "text-gray-600")}
          >
            Credit coins or cash to any user with transaction notes and proper
            categorization
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* User Selection */}
          <div className="space-y-2">
            <Label
              htmlFor="user-search"
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              User Selection
            </Label>
            {selectedUser ? (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-3",
                  isDark
                    ? "bg-[#130a33] border-gray-700 text-white"
                    : "bg-gray-50 border-gray-300 text-gray-900"
                )}
              >
                <UserAvatar user={selectedUser} size={40} />
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {userDisplayName(selectedUser)}
                    <UserTypeBadge userType={selectedUser.user_type} isDark={isDark} />
                  </div>
                  <div className="text-sm opacity-75 break-all">
                    {selectedUser.username ? `@${selectedUser.username} · ` : ""}
                    {selectedUser.email}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs opacity-70">
                    <span className="font-mono">{selectedUser.id.slice(0, 8)}…</span>
                    <button
                      type="button"
                      onClick={copySelectedId}
                      className="inline-flex items-center gap-1 rounded px-1 hover:opacity-100"
                      aria-label="Copy user ID"
                    >
                      {idCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {idCopied ? "Copied" : "Copy ID"}
                    </button>
                    <span>· {(selectedUser.coins ?? 0).toLocaleString()} coins</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    ref={viewDetailsRef}
                    type="button"
                    size="sm"
                    onClick={() => setDetailsOpen(true)}
                    className={cn(
                      "text-white",
                      isDark
                        ? "bg-[#5F2BB1] hover:bg-[#4A00BE]"
                        : "bg-[#4A00BE] hover:bg-[#5F2BB1]"
                    )}
                  >
                    <Eye className="mr-1.5 h-4 w-4" />
                    View details
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                    className={cn(
                      isDark
                        ? "border-gray-700 bg-transparent text-white hover:bg-[#1b0f44] hover:text-white"
                        : "border-gray-300"
                    )}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : (
              <UserSearchCombobox
                isDark={isDark}
                onSelect={handleUserSelect}
                autoFocus={isOpen}
              />
            )}
          </div>

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label
              htmlFor="transaction-type"
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Transaction Type
            </Label>
            <Select
              value={transactionType}
              onValueChange={(value) => {
                setTransactionType(value as "coins" | "cash");
                setCashCategory("");
              }}
            >
              <SelectTrigger
                id="transaction-type"
                className={cn(
                  isDark
                    ? "bg-[#06021d] border-gray-700 text-white"
                    : "bg-white border-gray-300"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value="coins" isDark={isDark}>Coins</SelectItem>
                <SelectItem value="cash" isDark={isDark} disabled={!canReceiveCash}>
                  {canReceiveCash ? "Cash" : "Cash (creators only)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label
              htmlFor="amount"
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              {transactionType === "cash" ? "Amount (in dollars)" : "Coins"}
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step={transactionType === "cash" ? "0.01" : "1"}
              placeholder={transactionType === "cash" ? "0.00" : "0"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(
                isDark
                  ? "bg-[#06021d] border-gray-700 text-white"
                  : "bg-white border-gray-300"
              )}
              required
            />
          </div>

          {/* Cash Category (only visible if Type = Cash) */}
          {transactionType === "cash" && (
            <div className="space-y-2">
              <Label
                htmlFor="cash-category"
                className={cn(isDark ? "text-white" : "text-gray-900")}
              >
                Cash Category
              </Label>
              <Select
                value={cashCategory}
                onValueChange={(value) =>
                  setCashCategory(
                    value as
                      | "contest_winnings"
                      | "other_earnings"
                      | "affiliate_earnings"
                  )
                }
              >
                <SelectTrigger
                  id="cash-category"
                  className={cn(
                    isDark
                      ? "bg-[#06021d] border-gray-700 text-white"
                      : "bg-white border-gray-300"
                  )}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  <SelectItem value="contest_winnings" isDark={isDark}>
                    Contest winnings (total money won)
                  </SelectItem>
                  <SelectItem value="affiliate_earnings" isDark={isDark}>
                    Affiliate earnings
                  </SelectItem>
                  <SelectItem value="other_earnings" isDark={isDark}>
                    Other earnings (bonuses, coupons, etc.)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Transaction Note */}
          <div className="space-y-2">
            <Label
              htmlFor="transaction-note"
              className={cn(isDark ? "text-white" : "text-gray-900")}
            >
              Transaction Note <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="transaction-note"
              placeholder="e.g., Bonus reward for milestone, Manual adjustment, etc."
              value={transactionNote}
              onChange={(e) => setTransactionNote(e.target.value)}
              className={cn(
                "min-h-[100px]",
                isDark
                  ? "bg-[#06021d] border-gray-700 text-white placeholder:text-gray-500"
                  : "bg-white border-gray-300"
              )}
              required
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full",
              isDark
                ? "bg-[#5F2BB1] hover:bg-[#4A00BE] text-white"
                : "bg-[#4A00BE] hover:bg-[#5F2BB1] text-white"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Submit Manual Entry"
            )}
          </Button>

          {/* Status Message */}
          {submitStatus.type && (
            <div
              className={cn(
                "p-4 rounded-lg flex items-start gap-3",
                submitStatus.type === "success"
                  ? isDark
                    ? "bg-green-900/30 border border-green-700 text-green-300"
                    : "bg-green-50 border border-green-200 text-green-800"
                  : isDark
                  ? "bg-red-900/30 border border-red-700 text-red-300"
                  : "bg-red-50 border border-red-200 text-red-800"
              )}
            >
              {submitStatus.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
              )}
              <p className="text-sm">{submitStatus.message}</p>
            </div>
          )}
        </form>

        <UserDetailsModal
          userId={selectedUser?.id ?? null}
          open={detailsOpen && !!selectedUser}
          onOpenChange={setDetailsOpen}
          isDark={isDark}
        />
      </DialogContent>
    </Dialog>
  );
}

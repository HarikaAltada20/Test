"use client";

import { useState, useEffect, useLayoutEffect } from "react";
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
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  user_type: string;
  coins: number;
}

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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [transactionType, setTransactionType] = useState<"coins" | "cash">(
    "coins"
  );
  const [amount, setAmount] = useState("");
  const [cashCategory, setCashCategory] = useState<
    "contest_winnings" | "other_earnings" | ""
  >("");
  const [transactionNote, setTransactionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUser(null);
      setTransactionType("coins");
      setAmount("");
      setCashCategory("");
      setTransactionNote("");
      setSubmitStatus({ type: null, message: "" });
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/admin/search-users?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        if (data.success) {
          setSearchResults(data.users || []);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setSearchQuery(`${user.full_name || user.username || ""} (${user.email})`);
    setSearchResults([]);
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
        setSearchQuery("");
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
          isDark ? "bg-[#170337] text-white" : "bg-white text-gray-900"
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
            <div className="relative">
              <Search
                className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4",
                  isDark ? "text-gray-400" : "text-gray-500"
                )}
              />
              <Input
                id="user-search"
                type="text"
                placeholder="Search by name, email, username, or user ID"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedUser(null);
                }}
                className={cn(
                  "pl-10",
                  isDark
                    ? "bg-[#210B43] border-gray-700 text-white placeholder:text-gray-500"
                    : "bg-white border-gray-300"
                )}
              />
            </div>
            {isSearching && (
              <p
                className={cn(
                  "text-sm",
                  isDark ? "text-gray-400" : "text-gray-600"
                )}
              >
                Searching...
              </p>
            )}
            {searchResults.length > 0 && !selectedUser && (
              <div
                className={cn(
                  "border rounded-lg max-h-60 overflow-y-auto",
                  isDark
                    ? "border-gray-700 bg-[#210B43]"
                    : "border-gray-300 bg-white"
                )}
              >
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleUserSelect(user)}
                    className={cn(
                      "w-full text-left px-4 py-2 hover:bg-opacity-50 transition-colors",
                      isDark
                        ? "hover:bg-purple-900 text-white"
                        : "hover:bg-gray-100 text-gray-900"
                    )}
                  >
                    <div className="font-medium">
                      {user.full_name || user.username || "No name"}
                    </div>
                    <div className="text-sm opacity-75">{user.email}</div>
                    <div className="text-xs opacity-60">
                      ID: {user.id} • {user.user_type} • {user.coins} coins
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedUser && (
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  isDark
                    ? "bg-[#210B43] border-gray-700 text-white"
                    : "bg-gray-50 border-gray-300 text-gray-900"
                )}
              >
                <div className="font-medium">
                  {selectedUser.full_name || selectedUser.username || "No name"}
                </div>
                <div className="text-sm opacity-75">{selectedUser.email}</div>
                <div className="text-xs opacity-60">
                  ID: {selectedUser.id} • {selectedUser.user_type} •{" "}
                  {selectedUser.coins} coins
                </div>
              </div>
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
                    ? "bg-[#210B43] border-gray-700 text-white"
                    : "bg-white border-gray-300"
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coins">Coins</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
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
                  ? "bg-[#210B43] border-gray-700 text-white"
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
                    value as "contest_winnings" | "other_earnings"
                  )
                }
              >
                <SelectTrigger
                  id="cash-category"
                  className={cn(
                    isDark
                      ? "bg-[#210B43] border-gray-700 text-white"
                      : "bg-white border-gray-300"
                  )}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contest_winnings">
                    Contest Winnings
                  </SelectItem>
                  <SelectItem value="other_earnings">Other Earnings</SelectItem>
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
                  ? "bg-[#210B43] border-gray-700 text-white placeholder:text-gray-500"
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
      </DialogContent>
    </Dialog>
  );
}

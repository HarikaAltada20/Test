"use client";

import { useEffect, useState } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface DeleteContestButtonProps {
  contestId: string;
  contestTitle: string;
  isDeletable: boolean;
  variant?: "outline" | "destructive" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  isdark?: boolean;
  appearance?: "default" | "card";
}

export function DeleteContestButton({
  contestId,
  contestTitle,
  isDeletable,
  variant = "outline",
  isdark = false,
  className = "",
  appearance = "default",
}: DeleteContestButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
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
  // Read mode from data attribute and html class, respond to changes
  useEffect(() => {
    const readMode = (): "light" | "dark" => {
      const el = document.querySelector("[data-mode]");
      const attr = el?.getAttribute("data-mode");
      if (attr === "dark" || attr === "light") return attr;
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    };

    // Set immediately on mount to avoid any flicker
    setMode(readMode());

    // Watch for changes on either data-mode or html class
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
  // Don't show delete button if it's not deletable (e.g., live or ended contests)
  if (!isDeletable) {
    return null;
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/contests/${contestId}/delete`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete contest");
      }

      // Show success toast
      toast({
        title: "Contest Deleted",
        description:
          result.message || `"${contestTitle}" was successfully deleted.`,
        variant: "default",
      });

      // Close dialog and refresh
      setIsOpen(false);
      router.refresh();

      // Redirect to contests page if on detail page
      if (
        window.location.pathname.includes(`/dashboard/contests/${contestId}`)
      ) {
        router.push("/dashboard/contests");
      }
    } catch (error: any) {
      console.error("Error deleting contest:", error);
      toast({
        title: "Error",
        description: `Failed to delete contest: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  const isDark = mode === "dark";

  return (
    <>
      {appearance === "card" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            setIsOpen(true);
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-[13px] font-semibold shadow-[0px_1px_1px_rgba(10,10,10,0.04)]",
            isDark
              ? "border-white/15 bg-transparent text-white"
              : "border-[#e5e5e5] bg-white text-[#0a0a0a]",
            className,
          )}
        >
          <img src="/images/contest-list/trash.svg" alt="" />
          Delete
        </button>
      ) : (
        <Button
          onClick={() => setIsOpen(true)}
          variant={variant}
          size="md"
          className={`border ${
            isDark ? "text-purple-400 border-gray-600" : "text-purple-500"
          } text-[14px] ${className}`}
        >
          <Trash2 className="h-4 w-4 mb-[2px]" />
          Delete
        </Button>
      )}

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent
          className={cn(
            "max-w-lg rounded-2xl border p-4 shadow-2xl",
            isDark
              ? "bg-[#111113] border-white/10 text-white"
              : "bg-white border-[#e5e5e5] text-slate-900",
          )}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={cn(
                "absolute -top-1 -right-1 p-1.5 rounded-full transition-colors",
                isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/10"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
              )}
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                  isDark
                    ? "bg-red-950/40 border-red-900/40 text-red-400"
                    : "bg-red-50 border-red-100 text-red-500",
                )}
              >
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 pr-6">
                <AlertDialogTitle
                  className={cn(
                    "text-xl font-bold tracking-tight",
                    isDark ? "text-white" : "text-slate-900",
                  )}
                >
                  Delete Contest
                </AlertDialogTitle>
                <AlertDialogDescription
                  className={cn(
                    "mt-1.5 text-sm leading-relaxed",
                    isDark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  Are you sure you want to delete the contest &ldquo;{contestTitle}&rdquo;? This action cannot be undone.
                </AlertDialogDescription>
              </div>
            </div>

            <div
              className={cn(
                "mt-5 rounded-2xl border p-3.5 flex items-center justify-between gap-3",
                isDark
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-slate-200/90 bg-slate-50/60",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* <div
                  className={cn(
                    "h-11 w-16 shrink-0 rounded-xl",
                    isDark
                      ? "bg-gradient-to-br from-slate-700 to-slate-800"
                      : "bg-gradient-to-br from-slate-200 to-slate-300",
                  )}
                /> */}
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-bold truncate",
                      isDark ? "text-white" : "text-slate-900",
                    )}
                  >
                    {contestTitle}
                  </p>
                  <p
                    className={cn(
                      "text-xs truncate mt-0.5",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                  >
                    Contest Draft
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  isDark
                    ? "bg-white/10 text-slate-300"
                    : "bg-slate-200/70 text-slate-700",
                )}
              >
                Draft
              </span>
            </div>

            {/* <div
              className={cn(
                "mt-4 rounded-2xl border p-3.5 flex items-center gap-2.5 text-[13px]",
                isDark
                  ? "border-red-900/40 bg-red-950/25 text-red-300"
                  : "border-red-200/80 bg-red-50/70 text-red-700",
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>Deleting removes the draft, its brief and any uploaded files.</span>
            </div> */}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isDeleting}
                className={cn(
                  "rounded-xl border px-5 py-2.5 h-11 font-semibold text-sm transition-colors",
                  isDark
                    ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                )}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                loading={isDeleting}
                loadingText="Deleting..."
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 h-11 font-semibold text-sm shadow-sm gap-2 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Contest
              </Button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

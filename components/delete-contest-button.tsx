"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
}

export function DeleteContestButton({
  contestId,
  contestTitle,
  isDeletable,
  variant = "outline",
  isdark = false,
  className = "",
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
      <Button
        onClick={() => setIsOpen(true)}
        variant={variant}
        size="md"
        className={`${
          isdark ? "border border-purple-400 text-purple-300" : "text-purple-500"
        } text-[14px] ${className}`}
      >
        <Trash2 className="h-4 w-4 mb-[2px]" />
        Delete
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the contest "{contestTitle}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={isDeleting}
              className={cn(
                "w-full text-md rounded-full",
                isDark
                  ? "bg-[#7F39EC] py-3"
                  : " bg-[#D9C0FF61] py-4 text-[#7F39EC] "
              )}
              loadingText="Deleting..."
            >
              Delete Contest
            </Button>
            <Button
              className={cn(
                "w-full text-md rounded-full",
                isDark
                  ? "py-3 border border-[#FF5353] text-[#FF5353]"
                  : "bg-[#FF323224] text-[#E50000] py-4"
              )}
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

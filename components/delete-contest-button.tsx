"use client";

import { useState } from "react";
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
              className="bg-[#D9C0FF61] text-[#7F39EC] py-2 rounded-full"
              loadingText="Deleting..."
            >
              Delete Contest
            </Button>
            <Button
              className="bg-[#FF323224] text-[#E50000] py-2 rounded-full"
              variant="destructive"
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

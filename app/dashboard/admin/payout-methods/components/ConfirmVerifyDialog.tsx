"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmVerifyDialog({
  request,
  isDark,
  onClose,
}: {
  request: ConfirmRequest | null;
  isDark: boolean;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className={cn(isDark && "border-gray-700 bg-[#0B0629] text-white")}>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription className={cn(isDark && "text-gray-400")}>
            {request?.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={cn(isDark && "border-gray-700 bg-transparent text-white hover:bg-white/10")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              request?.onConfirm();
              onClose();
            }}
          >
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

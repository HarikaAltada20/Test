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
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { accessModeSwitchNotes, type AccessMode } from "@/lib/campaign-access";

export type PendingAccessModeSwitch = {
  from: AccessMode;
  to: AccessMode;
  /** Submissions so far, when known (only looked up when leaving Public). */
  submissions: number | null;
};

type Props = {
  pending: PendingAccessModeSwitch | null;
  onCancel: () => void;
  onConfirm: (mode: AccessMode) => void;
};

const LABEL: Record<AccessMode, string> = {
  public: "Public",
  private: "Private",
  restricted: "Restricted",
};

/** Explains what changes before the brand switches who can see a saved campaign. */
export function AccessModeSwitchDialog({ pending, onCancel, onConfirm }: Props) {
  const isDark = useDashboardDark();
  const notes = pending ? accessModeSwitchNotes(pending.from, pending.to, pending.submissions) : [];

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
        <AlertDialogHeader>
          <AlertDialogTitle>Make this campaign {pending ? LABEL[pending.to] : ""}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <ul className="list-disc space-y-1.5 pl-5">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p>The change applies when you save the campaign.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10"
          >
            Keep {pending ? LABEL[pending.from] : ""}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-[#7F39EC] text-white hover:bg-[#7F39EC]/90"
            onClick={() => pending && onConfirm(pending.to)}
          >
            Switch to {pending ? LABEL[pending.to] : ""}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { applicationDisplayStatus, type ContestApplication } from "@/lib/campaign-access";
import { ApplicationStatusBadge } from "./AccessBadge";
import { AnswersList } from "./ApplicationAnswers";
import { ApplicantProfileSummary } from "./ApplicantProfileSummary";
import { CreatorAvatar } from "./CreatorAvatar";
import { RelativeTime } from "./RelativeTime";
import { RequirementStateTag } from "./RequirementStateTag";

type Props = {
  applications: ContestApplication[];
  /** Index of the open application, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  canApprove: (app: ContestApplication) => boolean;
  canReject: (app: ContestApplication) => boolean;
  onApprove: (app: ContestApplication) => void;
  onReject: (app: ContestApplication) => void;
  busy: boolean;
  /** Off while another dialog (e.g. reject) is open, so its typing isn't taken as shortcuts. */
  shortcutsEnabled: boolean;
  isDark: boolean;
  /** Show whether the applicant meets the campaign's requirements. */
  requirementsApply?: boolean;
  /** Link to the creator's full profile page, when there is one. */
  profileHref?: (app: ContestApplication) => string;
};

const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function ApplicationReviewDrawer({
  applications,
  index,
  onIndexChange,
  canApprove,
  canReject,
  onApprove,
  onReject,
  busy,
  shortcutsEnabled,
  isDark,
  requirementsApply = false,
  profileHref,
}: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const app = index !== null ? applications[index] : undefined;
  const open = !!app;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < applications.length - 1;
  const approveLabel = app && app.status === "approved" ? "Re-approve" : "Approve";

  useEffect(() => {
    if (!open || !shortcutsEnabled || !app) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowright" && hasNext) onIndexChange(index! + 1);
      else if (key === "arrowleft" && hasPrev) onIndexChange(index! - 1);
      else if (key === "a" && !busy && canApprove(app)) onApprove(app);
      else if (key === "r" && !busy && canReject(app)) onReject(app);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shortcutsEnabled, app, index, hasNext, hasPrev, busy, canApprove, canReject, onApprove, onReject, onIndexChange]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <SheetContent
        side="right"
        // Start on the creator name rather than the first focusable (the date tooltip).
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
        className={cn(
          "flex w-full flex-col gap-0 p-0 sm:max-w-lg",
          isDark && "dark border-white/10 bg-[#06021D] text-white",
        )}
      >
        {app && (
          <>
            <SheetHeader className="border-b border-gray-200 p-5 pr-12 text-left dark:border-white/10">
              <div className="flex items-center gap-3">
                <CreatorAvatar
                  username={app.username}
                  fullName={app.full_name}
                  src={app.profile_picture_url}
                  className="h-12 w-12"
                />
                <div className="min-w-0">
                  <SheetTitle
                    ref={titleRef}
                    tabIndex={-1}
                    className="truncate text-gray-900 focus:outline-none dark:text-white"
                  >
                    @{app.username ?? "unknown"}
                  </SheetTitle>
                  {app.full_name && (
                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {app.full_name}
                    </p>
                  )}
                </div>
              </div>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
                  <ApplicationStatusBadge status={applicationDisplayStatus(app)} />
                  {requirementsApply && <RequirementStateTag state={app.requirement_state} />}
                  <RelativeTime value={app.created_at} prefix="Applied" />
                </div>
              </SheetDescription>
              {profileHref && (
                <Link
                  href={profileHref(app)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex w-fit items-center gap-1 rounded-sm pt-1 text-sm font-medium text-[#7F39EC] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-purple-300"
                >
                  View full profile
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
              )}
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <ApplicantProfileSummary profile={app.creator} />
              <section aria-labelledby="review-answers-heading" className="space-y-3">
                <h3
                  id="review-answers-heading"
                  className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  Answers
                </h3>
                <AnswersList answers={app.answers} />
              </section>
              {app.status === "rejected" && app.rejection_reason && (
                <section className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
                  <span className="font-medium">Rejection reason:</span> {app.rejection_reason}
                </section>
              )}
              {applicationDisplayStatus(app) === "access_removed" && (
                <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600 dark:bg-white/5 dark:text-gray-300">
                  This creator was approved, then removed from the access list. Re-approve to give
                  them access again.
                </p>
              )}
            </div>

            <div className="space-y-3 border-t border-gray-200 p-5 dark:border-white/10">
              {(canApprove(app) || canReject(app)) && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    variant="outline"
                    className={cn("text-red-600 hover:text-red-700 dark:text-red-400", outlineDark)}
                    disabled={busy || !canReject(app)}
                    onClick={() => onReject(app)}
                  >
                    <X className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                  <Button
                    size="lg"
                    className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
                    disabled={busy || !canApprove(app)}
                    onClick={() => onApprove(app)}
                  >
                    {busy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-4 w-4" />
                    )}
                    {approveLabel}
                  </Button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="dark:text-gray-200 dark:hover:bg-white/10"
                  disabled={!hasPrev}
                  onClick={() => onIndexChange(index! - 1)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <span className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                  {index! + 1} of {applications.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="dark:text-gray-200 dark:hover:bg-white/10"
                  disabled={!hasNext}
                  onClick={() => onIndexChange(index! + 1)}
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <p className="hidden text-center text-xs text-gray-400 dark:text-gray-500 sm:block">
                Shortcuts: <kbd className="font-sans font-semibold">A</kbd> approve ·{" "}
                <kbd className="font-sans font-semibold">R</kbd> reject ·{" "}
                <kbd className="font-sans font-semibold">←</kbd>/<kbd className="font-sans font-semibold">→</kbd>{" "}
                previous/next
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

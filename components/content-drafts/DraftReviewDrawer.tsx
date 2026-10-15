"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  draftReviewResultMessage,
  formatDraftRecord,
  type DraftDetail,
  type DraftListRow,
  type DraftReviewDecision,
} from "@/lib/content-drafts";
import { CreatorAvatar } from "@/components/campaign-access/CreatorAvatar";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";
import { commentOnDraft, getDraftDetail, reviewDraft } from "./api";
import { DraftDecisionDialog, type DecisionKind } from "./DraftDecisionDialog";
import { DraftStatusBadge } from "./DraftStatusBadge";
import { DraftTimeline } from "./DraftTimeline";
import { DraftVersionView } from "./DraftVersionView";

type Props = {
  rows: DraftListRow[];
  /** Index of the open draft, or null when closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** A decision or message changed the draft; refresh the list. */
  onChanged: () => void;
  isDark: boolean;
};

const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Brand/admin review of one draft, with previous/next through the list. */
export function DraftReviewDrawer({ rows, index, onIndexChange, onChanged, isDark }: Props) {
  const row = index !== null ? rows[index] : undefined;
  const open = !!row;
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<DecisionKind | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < rows.length - 1;

  const load = useCallback(async (id: string, keepVersion = false) => {
    setLoading(true);
    try {
      const d = await getDraftDetail(id);
      setDetail(d);
      if (d && !keepVersion) setVersionId(d.current_version?.id ?? d.versions.at(-1)?.id ?? null);
    } catch (e) {
      toast({ title: "Couldn't load the draft", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const rowId = row?.id;
  // Reload when another draft opens or the list row changes (status, version).
  const rowStamp = row ? `${row.id}:${row.updated_at}` : "";
  useEffect(() => {
    if (!rowId) {
      setDetail(null);
      return;
    }
    if (detail?.id !== rowId) setDetail(null);
    load(rowId, detail?.id === rowId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowStamp, load]);

  const decide = async (kind: DraftReviewDecision, reason: string | null) => {
    if (!detail) return;
    // Act on the version being reviewed: the current one, or the approved one when revoking.
    const target = detail.status === "approved" ? detail.approved_version_id : detail.current_version?.id ?? null;
    setBusy(true);
    try {
      const result = await reviewDraft(detail.id, target, kind, reason);
      const ok = result === "approved" || result === "revision_requested" || result === "rejected";
      toast({
        title: draftReviewResultMessage(result),
        variant: ok ? undefined : "destructive",
      });
      setDecision(null);
      if (ok || result === "stale" || result === "already_posted") {
        await load(detail.id);
        onChanged();
      }
    } catch (e) {
      toast({ title: "Couldn't save the decision", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const comment = async (body: string) => {
    if (!detail) return false;
    try {
      const result = await commentOnDraft(detail.id, body);
      if (result === "commented") {
        await load(detail.id, true);
        return true;
      }
      toast({
        title: result === "rate_limited" ? "Too many messages. Try again in a few minutes." : "Couldn't send the message",
        variant: "destructive",
      });
    } catch (e) {
      toast({ title: "Couldn't send the message", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
    return false;
  };

  const can = detail?.id === rowId ? detail?.can : undefined;
  const canApprove = !!can?.review;
  const canRequestRevision = !!can?.request_revision && (!!can?.review || !!can?.revoke);
  const canReject = !!can?.review || !!can?.revoke;
  const revoking = detail?.status === "approved";

  useEffect(() => {
    if (!open || decision || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if ((key === "arrowright" || key === "j") && hasNext) onIndexChange(index! + 1);
      else if ((key === "arrowleft" || key === "k") && hasPrev) onIndexChange(index! - 1);
      else if (key === "a" && canApprove) decide("approve", null);
      else if (key === "r" && canRequestRevision) setDecision("request_revision");
      else if (key === "x" && canReject) setDecision("reject");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, decision, busy, hasNext, hasPrev, index, canApprove, canRequestRevision, canReject]);

  const creator = detail?.creator ?? row?.creator ?? null;
  const record = detail?.record ?? row?.record ?? null;
  const shown = detail?.id === rowId ? detail : null;

  const brandState = (() => {
    if (!shown) return null;
    switch (shown.display_status) {
      case "revision_requested":
        return { text: "Waiting for the creator's revision.", reason: shown.decision_reason, label: "You asked" };
      case "approved":
        return { text: "Approved. Waiting for the creator to post it and submit the link.", reason: null, label: "" };
      case "posted":
        return { text: "Posted and submitted. Review the post in Submissions as usual.", reason: null, label: "" };
      case "rejected":
        return { text: "Rejected.", reason: shown.decision_reason, label: "Reason" };
      case "withdrawn":
        return { text: "The creator withdrew this draft.", reason: null, label: "" };
      default:
        return null;
    }
  })();

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
        <SheetContent
          side="right"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            titleRef.current?.focus();
          }}
          className={cn(
            "flex w-full flex-col gap-0 p-0 sm:max-w-lg",
            isDark && "dark border-white/10 bg-[#06021D] text-white",
          )}
        >
          {row && (
            <>
              <SheetHeader className="border-b border-gray-200 p-5 pr-12 text-left dark:border-white/10">
                <div className="flex items-center gap-3">
                  <CreatorAvatar
                    username={creator?.username}
                    fullName={creator?.full_name}
                    src={creator?.profile_picture_url}
                    className="h-11 w-11"
                  />
                  <div className="min-w-0">
                    <SheetTitle
                      ref={titleRef}
                      tabIndex={-1}
                      className="truncate text-gray-900 focus:outline-none dark:text-white"
                    >
                      @{creator?.username ?? "creator"}
                    </SheetTitle>
                    {creator?.full_name && (
                      <p className="truncate text-sm text-gray-500 dark:text-gray-400">{creator.full_name}</p>
                    )}
                  </div>
                </div>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-gray-500 dark:text-gray-400">
                    <DraftStatusBadge status={shown?.display_status ?? row.display_status} />
                    <RelativeTime value={row.submitted_at} prefix="Sent" />
                  </div>
                </SheetDescription>
                <p className="flex items-center gap-1.5 pt-1 text-xs text-gray-600 dark:text-gray-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#7F39EC] dark:text-purple-300" aria-hidden="true" />
                  Draft record: {formatDraftRecord(record)}
                  {record && <span className="font-medium">· Draft trust {record.draft_trust}%</span>}
                </p>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                {!shown ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-label="Loading draft" />
                  </div>
                ) : (
                  <>
                    {brandState && (
                      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-white/5 dark:text-gray-200">
                        <p className="font-medium">{brandState.text}</p>
                        {brandState.reason && (
                          <p className="mt-1 whitespace-pre-wrap">
                            {brandState.label}: {brandState.reason}
                          </p>
                        )}
                      </div>
                    )}
                    {versionId && (
                      <DraftVersionView
                        versions={shown.versions}
                        selectedId={versionId}
                        onSelect={setVersionId}
                        currentId={shown.current_version?.id ?? null}
                        approvedId={shown.approved_version_id}
                        purged={shown.files_purged}
                      />
                    )}
                    <DraftTimeline
                      events={shown.events}
                      canComment={shown.can.comment}
                      onComment={comment}
                      placeholder="Message the creator"
                    />
                  </>
                )}
              </div>

              <div className="space-y-3 border-t border-gray-200 p-5 dark:border-white/10">
                {shown && (canApprove || canReject) && (
                  <>
                    {revoking && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Changed your mind? You can withdraw the approval until the creator posts it.
                      </p>
                    )}
                    {!canRequestRevision && (shown.can.review || shown.can.revoke) && shown.max_revisions !== null && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        This draft has used its {shown.max_revisions} revision{shown.max_revisions === 1 ? "" : "s"}. Approve or reject it.
                      </p>
                    )}
                    <div className={cn("grid gap-2", canApprove ? "grid-cols-3" : "grid-cols-2")}>
                      <Button
                        variant="outline"
                        className={cn("text-red-600 hover:text-red-700 dark:text-red-400", outlineDark)}
                        disabled={busy || !canReject}
                        onClick={() => setDecision("reject")}
                      >
                        <X className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button
                        variant="outline"
                        className={cn("text-amber-700 hover:text-amber-800 dark:text-amber-300", outlineDark)}
                        disabled={busy || !canRequestRevision}
                        onClick={() => setDecision("request_revision")}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" /> {revoking ? "Ask changes" : "Revision"}
                      </Button>
                      {canApprove && (
                        <Button
                          className="bg-[#7F39EC] hover:bg-[#7F39EC]/90"
                          disabled={busy}
                          onClick={() => decide("approve", null)}
                        >
                          {busy && !decision ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </>
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
                    {index! + 1} of {rows.length}
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
                  <kbd className="font-sans font-semibold">R</kbd> revision ·{" "}
                  <kbd className="font-sans font-semibold">X</kbd> reject ·{" "}
                  <kbd className="font-sans font-semibold">←</kbd>/<kbd className="font-sans font-semibold">→</kbd>{" "}
                  previous/next
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <DraftDecisionDialog
        kind={decision}
        revoking={revoking}
        name={`@${creator?.username ?? "the creator"}'s draft`}
        busy={busy}
        isDark={isDark}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => decision && decide(decision, reason)}
      />
    </>
  );
}

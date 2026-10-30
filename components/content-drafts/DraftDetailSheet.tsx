"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Plus, RotateCcw, Send, Undo2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  draftBlockMessage,
  type CampaignDraftStatus,
  type DraftDetail,
} from "@/lib/content-drafts";
import {
  commentOnDraft,
  getCampaignDraftStatus,
  getDraftDetail,
  withdrawDraft,
} from "./api";
import { DraftStatusBadge } from "./DraftStatusBadge";
import { DraftTimeline } from "./DraftTimeline";
import { DraftVersionView } from "./DraftVersionView";
import { UploadDraftsDialog } from "./UploadDraftsDialog";

type Props = {
  draftId: string | null;
  onClose: () => void;
  /** Something changed (revision, withdrawal, new drafts); refresh lists. */
  onChanged: () => void;
  isDark: boolean;
};

const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

/** The creator's view of one draft: video, versions, state, history and actions. */
export function DraftDetailSheet({ draftId, onClose, onChanged, isDark }: Props) {
  const [detail, setDetail] = useState<DraftDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [campaignStatus, setCampaignStatus] = useState<CampaignDraftStatus | null>(null);

  const load = useCallback(
    async (id: string, { keepVersion = false } = {}) => {
      setLoading(true);
      try {
        const d = await getDraftDetail(id);
        setDetail(d);
        setMissing(!d);
        if (d && !keepVersion) setVersionId(d.current_version?.id ?? d.versions.at(-1)?.id ?? null);
      } catch (e) {
        toast({
          title: "Couldn't load the draft",
          description: e instanceof Error ? e.message : undefined,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setDetail(null);
    setMissing(false);
    if (draftId) load(draftId);
  }, [draftId, load]);

  const refresh = () => {
    if (draftId) load(draftId);
    onChanged();
  };

  const withdraw = async () => {
    if (!detail) return;
    setBusy(true);
    try {
      const result = await withdrawDraft(detail.id);
      if (result === "withdrawn") {
        toast({ title: "Draft withdrawn" });
        refresh();
      } else {
        toast({
          title:
            result === "already_posted"
              ? "This draft is already linked to a post"
              : "This draft can't be withdrawn now",
          variant: "destructive",
        });
        if (draftId) load(draftId);
      }
    } catch (e) {
      toast({ title: "Couldn't withdraw", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setBusy(false);
      setConfirmWithdraw(false);
    }
  };

  const comment = async (body: string) => {
    if (!detail) return false;
    try {
      const result = await commentOnDraft(detail.id, body);
      if (result === "commented") {
        await load(detail.id, { keepVersion: true });
        return true;
      }
      toast({
        title:
          result === "rate_limited"
            ? "You're sending messages too quickly. Try again in a few minutes."
            : "Couldn't send the message",
        variant: "destructive",
      });
    } catch (e) {
      toast({ title: "Couldn't send the message", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
    return false;
  };

  const openNewDraft = async () => {
    if (!detail) return;
    try {
      const status = await getCampaignDraftStatus(detail.contest_id);
      setCampaignStatus(status);
      if (!status.can_upload) {
        toast({ title: draftBlockMessage(status.block_reason, status) ?? "You can't send drafts right now", variant: "destructive" });
        return;
      }
      setNewOpen(true);
    } catch (e) {
      toast({ title: "Couldn't check the campaign", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const status = detail?.display_status;
  const current = detail?.current_version ?? null;
  const campaignTitle = detail?.campaign?.title ?? "the campaign";
  const blockMessage = detail?.campaign_block ? draftBlockMessage(detail.campaign_block) : null;

  const stateMessage = (() => {
    if (!detail || !status) return null;
    switch (status) {
      case "pending_review":
        return {
          tone: "purple",
          text: `The brand is reviewing v${current?.version_no ?? detail.version_count}. Please don't post it yet.`,
        };
      case "revision_requested":
        return { tone: "amber", text: "The brand asked for changes:", reason: detail.decision_reason };
      case "approved":
        return detail.campaign?.has_ended
          ? { tone: "gray", text: "Approved, but the campaign has ended, so it can't be submitted." }
          : {
              tone: "green",
              text: "Approved. Post this exact video, then submit the link.",
              reason: detail.decision_reason,
              reasonLabel: "Note from the brand",
            };
      case "posted": {
        const platforms = detail.posts.map((p) => p.platform).filter(Boolean).join(", ");
        return { tone: "slate", text: `Linked to your ${platforms || "published"} submission.` };
      }
      case "rejected":
        return { tone: "red", text: "Not approved. This draft is closed.", reason: detail.decision_reason, reasonLabel: "Reason" };
      case "withdrawn":
        return {
          tone: "gray",
          text: detail.events.some((e) => e.kind === "expired")
            ? "Closed automatically after a long time without a revision."
            : "You withdrew this draft.",
        };
    }
  })();

  const toneClass: Record<string, string> = {
    purple: "bg-[#f5f5f5] text-[#404040] dark:bg-white/10 dark:text-neutral-200",
    amber: "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200",
    green: "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200",
    slate: "bg-slate-100 text-slate-800 dark:bg-white/5 dark:text-slate-200",
    red: "bg-red-50 text-red-900 dark:bg-red-500/10 dark:text-red-200",
    gray: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  };

  return (
    <>
      <Sheet open={!!draftId} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="right"
          className={cn(
            "flex w-full flex-col gap-0 p-0 sm:max-w-lg",
            isDark && "dark border-white/10 bg-[#111113] text-white",
          )}
        >
          <SheetHeader className="border-b border-gray-200 p-5 pr-12 text-left dark:border-white/10">
            <SheetTitle className="truncate text-gray-900 dark:text-white">
              {current?.title ?? (loading ? "Loading…" : "Draft")}
            </SheetTitle>
            <SheetDescription asChild>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                {status && <DraftStatusBadge status={status} />}
                {detail?.campaign && (
                  <Link
                    href={`/dashboard/opportunities/${detail.contest_id}`}
                    className="inline-flex items-center gap-1 rounded-sm font-medium text-[#0a0a0a] dark:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] dark:focus-visible:ring-white dark:text-white"
                  >
                    {campaignTitle}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {loading && !detail ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" aria-label="Loading draft" />
              </div>
            ) : missing ? (
              <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                This draft isn&apos;t available.
              </p>
            ) : detail ? (
              <>
                {stateMessage && (
                  <div className={cn("rounded-md px-3 py-2 text-sm", toneClass[stateMessage.tone])}>
                    <p className="font-medium">{stateMessage.text}</p>
                    {"reason" in stateMessage && stateMessage.reason && (
                      <p className="mt-1 whitespace-pre-wrap">
                        {"reasonLabel" in stateMessage && stateMessage.reasonLabel
                          ? `${stateMessage.reasonLabel}: `
                          : ""}
                        {stateMessage.reason}
                      </p>
                    )}
                  </div>
                )}

                {detail.campaign && !detail.campaign.review_before_posting &&
                  (status === "pending_review" || status === "revision_requested" || status === "approved") && (
                    <p className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
                      Review is no longer required for this campaign. You can post and submit directly.
                    </p>
                  )}

                {detail.versions.length > 0 && versionId && (
                  <DraftVersionView
                    versions={detail.versions}
                    selectedId={versionId}
                    onSelect={setVersionId}
                    currentId={detail.current_version?.id ?? null}
                    approvedId={detail.approved_version_id}
                    purged={detail.files_purged}
                    noteLabel="Your note to the brand"
                  />
                )}

                {detail.posts.length > 0 && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Submitted posts
                    </h3>
                    <ul className="space-y-1 text-sm">
                      {detail.posts.map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span className="truncate capitalize text-gray-700 dark:text-gray-200">
                            {p.platform ?? "Post"} · {p.status ?? "pending"}
                          </span>
                          {p.content_link && /^https?:\/\//i.test(p.content_link) && (
                            <a
                              href={p.content_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-sm text-xs font-medium text-[#0a0a0a] dark:text-white hover:underline dark:text-white"
                            >
                              Open post
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <DraftTimeline
                  events={detail.events}
                  canComment={detail.can.comment}
                  onComment={comment}
                  placeholder="Message the brand about this draft"
                />
              </>
            ) : null}
          </div>

          {detail && (
            <div className="space-y-2 border-t border-gray-200 p-5 dark:border-white/10">
              {detail.status === "revision_requested" && blockMessage && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{blockMessage}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                {detail.can.revise && (
                  <Button className="bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200 sm:flex-1" onClick={() => setReviseOpen(true)}>
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Upload revision
                  </Button>
                )}
                {detail.can.post && detail.display_status === "approved" && (
                  <Link
                    href={`/dashboard/opportunities/${detail.contest_id}/submit?draft=${detail.id}`}
                    className={cn(buttonVariants(), "bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200 sm:flex-1")}
                  >
                    <Send aria-hidden="true" /> Submit posted link
                  </Link>
                )}
                {(detail.status === "rejected" || detail.status === "withdrawn") &&
                  !detail.campaign?.has_ended && (
                    <Button className="bg-[#0a0a0a] text-white hover:bg-[#171717] dark:bg-white dark:text-[#0a0a0a] dark:hover:bg-neutral-200 sm:flex-1" onClick={openNewDraft}>
                      <Plus className="mr-1.5 h-4 w-4" /> Start a new draft
                    </Button>
                  )}
                {detail.can.withdraw && (
                  <Button
                    variant="outline"
                    className={cn("sm:flex-1", outlineDark)}
                    disabled={busy}
                    onClick={() => setConfirmWithdraw(true)}
                  >
                    <Undo2 className="mr-1.5 h-4 w-4" /> Withdraw
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmWithdraw} onOpenChange={(o) => !busy && setConfirmWithdraw(o)}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#111113] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this draft?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-400">
              {detail?.status === "approved"
                ? "You give up this approval and can't post this draft. "
                : "The brand stops reviewing it. "}
              You can start a new draft later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark} disabled={busy}>
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                withdraw();
              }}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {detail && (
        <UploadDraftsDialog
          open={reviseOpen}
          onOpenChange={setReviseOpen}
          contestId={detail.contest_id}
          campaignTitle={detail.campaign?.title}
          revision={{
            draftId: detail.id,
            title: current?.title ?? "",
            caption: current?.caption ?? null,
            hashtags: current?.hashtags ?? [],
            nextVersionNo: detail.version_count + 1,
            feedback: detail.decision_reason,
          }}
          isDark={isDark}
          onSent={() => refresh()}
        />
      )}
      {detail && (
        <UploadDraftsDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          contestId={detail.contest_id}
          campaignTitle={detail.campaign?.title}
          slotsLeft={
            campaignStatus?.max_open != null
              ? Math.max(0, campaignStatus.max_open - (campaignStatus.open_count ?? 0))
              : null
          }
          maxOpen={campaignStatus?.max_open ?? null}
          openCount={campaignStatus?.open_count ?? 0}
          isDark={isDark}
          onSent={() => onChanged()}
        />
      )}
    </>
  );
}

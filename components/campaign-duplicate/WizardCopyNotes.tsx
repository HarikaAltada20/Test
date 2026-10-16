"use client";

import { useState } from "react";
import { Copy, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampaignAccessPanel } from "@/components/campaign-access/CampaignAccessPanel";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

/** Top of the wizard on a draft made with "Copy an existing campaign". */
export function CopiedFromBanner({ sourceTitle }: { sourceTitle: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div
      role="status"
      className="mx-auto mt-5 flex max-w-2xl items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/70 px-4 py-3 text-left text-sm text-[#4A00BE] dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100"
    >
      <Copy className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        Copied from <span className="font-semibold">{sourceTitle}</span>. Check each step before
        you submit.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="-mr-1 rounded-md p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * "Who can join" on a copied draft: creators already invited from the
 * original campaign, with the same roster the campaign page uses to manage them.
 */
export function CopiedInvitesNote({
  count,
  contestId,
  advertiserId,
  onChanged,
}: {
  count: number;
  contestId: string;
  advertiserId: string | null;
  onChanged: (count: number) => void;
}) {
  const isDark = useDashboardDark();
  const [open, setOpen] = useState(false);

  const refreshCount = async () => {
    const { count: next } = await createClient()
      .from("contest_access_list")
      .select("user_id", { count: "exact", head: true })
      .eq("contest_id", contestId);
    onChanged(next ?? 0);
  };

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm",
          isDark ? "border-violet-500/30 bg-violet-500/10" : "border-purple-200 bg-purple-50/60",
        )}
      >
        <Users className="h-4 w-4 shrink-0 text-[#7F39EC]" />
        <span className="min-w-0 flex-1">
          {count} creator{count === 1 ? " is" : "s are"} already invited (copied from the original
          campaign).
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md px-2 py-1 font-medium text-[#7F39EC] hover:bg-purple-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-violet-200 dark:hover:bg-violet-500/15"
        >
          Manage
        </button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void refreshCount();
        }}
        isdark={isDark}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] w-[calc(100vw-16px)] max-w-3xl overflow-y-auto",
            isDark && "dark text-white",
          )}
        >
          <DialogHeader className="text-left">
            <DialogTitle>Invited creators</DialogTitle>
            <DialogDescription>
              They get access when the campaign goes live. Remove anyone you don&apos;t want on this
              campaign.
            </DialogDescription>
          </DialogHeader>
          <CampaignAccessPanel contestId={contestId} advertiserId={advertiserId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

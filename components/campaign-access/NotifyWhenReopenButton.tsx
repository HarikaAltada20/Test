"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { waitlistApi } from "./api";

type Props = {
  contestId: string;
  className?: string;
};

const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

/**
 * "Notify me when applications reopen" on a paused Restricted campaign.
 * The creator gets one notification when the brand reopens applications.
 */
export function NotifyWhenReopenButton({ contestId, className }: Props) {
  const [waiting, setWaiting] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    waitlistApi
      .status(contestId)
      .then((res) => !cancelled && setWaiting(res.waiting))
      .catch(() => !cancelled && setWaiting(false));
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  const change = async (join: boolean) => {
    setBusy(true);
    try {
      const res = join ? await waitlistApi.join(contestId) : await waitlistApi.leave(contestId);
      setWaiting(res.waiting);
      toast({ title: res.message });
    } catch (e: unknown) {
      toast({
        title: "Something went wrong",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (waiting === null) {
    return (
      <Button size="sm" variant="outline" className={cn(outlineDark, className)} disabled>
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
        Notify me when applications reopen
      </Button>
    );
  }

  if (waiting) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)} aria-live="polite">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4A00BE] dark:text-purple-200">
          <BellRing className="h-4 w-4" aria-hidden="true" /> We&apos;ll notify you when applications reopen
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 dark:text-gray-300 dark:hover:bg-white/10"
          disabled={busy}
          onClick={() => change(false)}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <BellOff className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          )}
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      className={cn("bg-[#7F39EC] text-white hover:bg-[#7F39EC]/90", className)}
      disabled={busy}
      onClick={() => change(true)}
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Bell className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      Notify me when applications reopen
    </Button>
  );
}

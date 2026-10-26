"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { touchAccountSwitchSessionIfNeeded } from "@/lib/account-switch-session-touch";
import { Loader2 } from "lucide-react";

type SessionRow = {
  id: string;
  user_agent?: string | null;
  ip_address?: string | null;
  last_seen_at: string;
};

function formatSeen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function DeviceSessionsPanel({
  isDark,
  onLogOut,
}: {
  isDark: boolean;
  onLogOut?: () => void;
}) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "others" | "all">(null);
  const { toast } = useToast();

  const refresh = useCallback(async (forceTouch = false) => {
    setLoading(true);
    try {
      if (forceTouch) {
        await fetch("/api/account-switch/sessions/touch", { method: "POST" });
      } else {
        touchAccountSwitchSessionIfNeeded();
      }
      const r = await fetch("/api/account-switch/sessions");
      const d = await r.json();
      setRows((d.sessions as SessionRow[]) || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revokeOthers = async () => {
    setBusy("others");
    try {
      const r = await fetch("/api/account-switch/sessions/revoke-others", {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d.error || "Request failed");
      }
      toast({
        title: "Other sessions signed out",
        description: "Other browsers were signed out. This session stays active.",
      });
      await refresh(true);
    } catch (e: unknown) {
      toast({
        title: "Could not sign out others",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const revokeAll = async () => {
    if (
      !window.confirm(
        "Sign out on all devices including this one? You will need to sign in again.",
      )
    ) {
      return;
    }
    setBusy("all");
    try {
      const r = await fetch("/api/account-switch/sessions/revoke-all", {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) {
        throw new Error(d.error || "Request failed");
      }
      window.location.href = "/auth/signin";
    } catch (e: unknown) {
      toast({
        title: "Could not sign out everywhere",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  return (
    <Card
      className={cn(
        "rounded-2xl border shadow-none",
        isDark ? "border-slate-700 bg-slate-900" : "border-neutral-200 bg-white",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5 py-4">
        <div className="min-w-0">
          <CardTitle
            className={cn(
              "text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            Active sessions
            <span
              className={cn(
                "ml-2 text-base font-normal",
                isDark ? "text-slate-400" : "text-[#737373]",
              )}
            >
              Up to three at a time.
            </span>
          </CardTitle>
          <CardDescription
            className={cn("mt-1 text-base", isDark ? "text-slate-400" : "text-[#44403c]")}
          >
            Up to three recent browsers are remembered. Use sign-out options if
            you no longer trust a device.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 shrink-0 rounded-full px-4 text-sm font-medium shadow-none",
            isDark
              ? "border-slate-600 bg-transparent text-white hover:bg-white/10"
              : "border border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
          )}
          onClick={() => void refresh(true)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-5">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-[#171717]" />
          </div>
        ) : rows.length === 0 ? (
          <p
            className={cn(
              "text-base text-center py-4",
              isDark ? "text-slate-500" : "text-slate-500",
            )}
          >
            No session history yet. It appears after you use this account in a
            browser.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "border-t py-3 text-base first:border-t-0 first:pt-0",
                  isDark ? "border-slate-700" : "border-neutral-200",
                )}
              >
                <p
                  className={cn(
                    "font-medium line-clamp-2",
                    isDark ? "text-slate-200" : "text-slate-800",
                  )}
                >
                  {row.user_agent?.trim() || "Unknown browser"}
                </p>
                <p
                  className={cn(
                    "text-base mt-1",
                    isDark ? "text-slate-500" : "text-slate-500",
                  )}
                >
                  {row.ip_address ? `${row.ip_address} · ` : ""}
                  Last active {formatSeen(row.last_seen_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className={cn("flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap", isDark ? "border-slate-700" : "border-neutral-200")}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "border-slate-600 bg-transparent text-white hover:bg-white/10"
                : "border border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
            )}
            disabled={!!busy || loading}
            onClick={() => void revokeOthers()}
          >
            {busy === "others" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Sign out other sessions
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium shadow-none",
              isDark
                ? "border-slate-600 bg-transparent text-white hover:bg-white/10"
                : "border border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
            )}
            disabled={!!busy || loading}
            onClick={() => void revokeAll()}
          >
            {busy === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Sign out everywhere
          </Button>
          {onLogOut ? (
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-9 rounded-full px-4 text-sm font-medium shadow-none",
                isDark
                  ? "border-slate-600 bg-transparent text-white hover:bg-white/10"
                  : "border border-neutral-300 bg-white text-[#171717] hover:bg-[#F6F6F7]",
              )}
              onClick={onLogOut}
            >
              Log out
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

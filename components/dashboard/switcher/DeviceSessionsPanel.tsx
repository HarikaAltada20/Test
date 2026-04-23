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
import { Loader2, MonitorSmartphone, RefreshCw } from "lucide-react";

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

export function DeviceSessionsPanel({ isDark }: { isDark: boolean }) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "others" | "all">(null);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/account-switch/sessions/touch", { method: "POST" });
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
      await refresh();
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
        "rounded-2xl border",
        isDark ? "border-slate-800 bg-[#07031E]" : "border-slate-200 bg-white",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle
            className={cn(
              "text-lg flex items-center gap-2",
              isDark ? "text-white" : "text-slate-900",
            )}
          >
            <MonitorSmartphone className="h-5 w-5 text-violet-500" />
            Active sessions
          </CardTitle>
          <CardDescription
            className={cn(isDark ? "text-slate-400" : "text-slate-600")}
          >
            Up to three recent browsers are remembered. Use sign-out options if
            you no longer trust a device.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 rounded-lg"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          </div>
        ) : rows.length === 0 ? (
          <p
            className={cn(
              "text-sm text-center py-4",
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
                  "rounded-xl border p-3 text-sm",
                  isDark
                    ? "border-slate-800 bg-slate-900/40"
                    : "border-slate-200 bg-slate-50",
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
                    "text-xs mt-1",
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

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl flex-1"
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
            variant="destructive"
            className="rounded-xl flex-1"
            disabled={!!busy || loading}
            onClick={() => void revokeAll()}
          >
            {busy === "all" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Sign out everywhere
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

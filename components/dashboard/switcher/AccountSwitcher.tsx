"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Loader2,
  Check,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  MoreVertical,
  Link2Off,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatConnectedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function AccountCardEmailRow({
  email,
  revealed,
  onToggle,
  isDark,
}: {
  email: string | null | undefined;
  revealed: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const trimmed = email?.trim();
  if (!trimmed) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1 min-w-0 max-w-full">
      <span
        className={cn(
          "text-xs truncate",
          isDark ? "text-slate-400" : "text-slate-600",
        )}
        title={revealed ? trimmed : undefined}
      >
        {revealed ? trimmed : "••••••••••••••••"}
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }
        }}
        className={cn(
          "shrink-0 inline-flex p-1 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1",
          isDark
            ? "hover:bg-white/10 text-slate-400 hover:text-slate-200 focus-visible:ring-offset-[#07031E]"
            : "hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 focus-visible:ring-offset-white",
        )}
        aria-label={revealed ? "Hide email" : "Show email"}
        aria-pressed={revealed}
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </span>
    </div>
  );
}

function ConnectedOnLine({
  dateLabel,
  isDark,
}: {
  dateLabel: string | null;
  isDark: boolean;
}) {
  if (!dateLabel) return null;
  return (
    <p
      className={cn(
        "text-[11px] mt-0.5",
        isDark ? "text-slate-500" : "text-slate-500",
      )}
    >
      Connected on — {dateLabel}
    </p>
  );
}

interface LinkedAccount {
  id: string;
  username: string;
  avatar_url?: string;
  user_type?: string;
  relink_email_hint?: string | null;
  connected_at?: string | null;
}

export function AccountSwitcher({ 
  currentUserId, 
  currentUsername,
  currentUserEmail,
  currentUserJoinedAt,
  isDark,
  userType
}: { 
  currentUserId: string;
  currentUsername: string;
  currentUserEmail?: string | null;
  currentUserJoinedAt?: string | null;
  isDark: boolean;
  userType: string;
}) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  /** Initial / full list load (switch modal empty state + spinner) */
  const [isListLoading, setIsListLoading] = useState(false);
  /** Silent refresh after link — subtle, no full-block spinner */
  const [isAccountsRefreshing, setIsAccountsRefreshing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  /** Row that needs re-link after vault refresh failed */
  const [staleTargetId, setStaleTargetId] = useState<string | null>(null);
  const [staleUsername, setStaleUsername] = useState<string | null>(null);
  /** When true for a row key ("current" or account id), email is visible; default hidden (masked). */
  const [emailRevealed, setEmailRevealed] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const isEmailShown = (key: string) => !!emailRevealed[key];
  const toggleEmailReveal = (key: string) => {
    setEmailRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const fetchAccounts = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) {
      setIsAccountsRefreshing(true);
    } else {
      setIsListLoading(true);
    }
    try {
      const res = await fetch("/api/account-switch/list");
      const data = await res.json();
      if (data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (err) {
      console.error("[AccountSwitcher] Fetch failed:", err);
    } finally {
      if (silent) {
        setIsAccountsRefreshing(false);
      } else {
        setIsListLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (userType !== "creator") return;
    void fetch("/api/account-switch/sessions/touch", { method: "POST" }).catch(
      () => {},
    );
  }, [userType, currentUserId]);

  const handleSwitch = async (targetUserId: string) => {
    if (isSwitching) return;
    
    // Check if user is allowed to switch accounts
    if (userType !== "creator") {
      toast({ 
        title: "Access Denied", 
        description: "Only creator accounts can switch between accounts", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsSwitching(targetUserId);
    setStaleTargetId(null);
    setStaleUsername(null);

    try {
      const res = await fetch("/api/account-switch/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });

      let data: {
        success?: boolean;
        error?: string;
        code?: string;
        target_user_id?: string;
      } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Failed to switch accounts");
      }

      if (data.success) {
        toast({
          title: "Account Switched",
          description: "Opening Settings…",
        });
        window.location.href = "/dashboard/settings";
        return;
      }

      const code = data.code as string | undefined;
      const tid = (data.target_user_id as string) || targetUserId;
      if (
        code === "VAULT_REFRESH_FAILED" ||
        code === "VAULT_ROW_REMOVED" ||
        code === "NO_VAULT_ROW"
      ) {
        const acc = accounts.find((a) => a.id === tid);
        setStaleTargetId(tid);
        setStaleUsername(acc?.username ?? null);
        await fetchAccounts({ silent: true });
        toast({
          title: "Session expired",
          description:
            "Re-link this account with email and password, or use Google.",
          variant: "destructive",
          duration: 8000,
        });
        return;
      }

      throw new Error(data.error || "Failed to switch accounts");
    } catch (err: any) {
      toast({
        title: "Switch Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSwitching(null);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is allowed to add accounts
    if (userType !== "creator") {
      toast({ 
        title: "Access Denied", 
        description: "Only creator accounts can add linked accounts", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsLinking(true);

    try {
      const res = await fetch("/api/account-switch/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Account Linked Successfully",
          description: "You can switch to this account from the list anytime.",
        });
        setIsAddModalOpen(false);
        setEmail("");
        setPassword("");
        setStaleTargetId(null);
        setStaleUsername(null);
        await fetchAccounts({ silent: true });
        setIsSwitchModalOpen(true);
      } else {
        throw new Error(data.error || "Authentication failed");
      }
    } catch (err: any) {
      toast({
        title: "Connection Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleConfirmUnlink = async () => {
    if (!unlinkTarget || isUnlinking) return;
    setIsUnlinking(true);
    try {
      const res = await fetch("/api/account-switch/unlink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: unlinkTarget.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not unlink account");
      }
      toast({
        title: "Link removed",
        description: `@${unlinkTarget.username} is no longer in your switcher.`,
      });
      setUnlinkTarget(null);
      if (staleTargetId === unlinkTarget.id) {
        setStaleTargetId(null);
        setStaleUsername(null);
      }
      await fetchAccounts({ silent: true });
    } catch (err: unknown) {
      toast({
        title: "Unlink failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsUnlinking(false);
    }
  };

  const openAddForRelink = () => {
    const acc = staleTargetId
      ? accounts.find((a) => a.id === staleTargetId)
      : undefined;
    const hint = acc?.relink_email_hint;
    if (hint) {
      setEmail(hint);
    } else {
      setEmail("");
    }
    setIsSwitchModalOpen(false);
    setIsAddModalOpen(true);
  };

  return (
    <div className="py-2 px-1">
      {/* Quick Action - Account Switcher */}
      <button
        onClick={() => {
          if (userType === "creator") {
            setIsSwitchModalOpen(true);
          } else {
            toast({ 
              title: "Access Denied", 
              description: "Only creator accounts can switch between accounts", 
              variant: "destructive" 
            });
          }
        }}
        className={cn(
          "flex justify-between items-center border rounded-lg px-4 py-3 w-full transition-all group",
          userType === "creator"
            ? (isDark 
              ? "border-[#7F39EC] bg-[#D9C0FF26] hover:bg-[#D9C0FF40]" 
              : "border-[#7F39EC] bg-[#D9C0FF26] hover:bg-[#D9C0FF40]")
            : (isDark 
              ? "border-slate-700 bg-slate-800/50 cursor-not-allowed opacity-60" 
              : "border-slate-300 bg-slate-100 cursor-not-allowed opacity-60")
        )}
      >
        <div className="flex items-center">
          <div
            className={cn(
              "flex rounded-full p-3 items-center mr-2.5",
              userType === "creator"
                ? (isDark
                  ? "bg-[#FFFFFF42] text-white"
                  : "bg-[#D8C3FF] text-purple-600")
                : (isDark
                  ? "bg-slate-700 text-slate-400"
                  : "bg-slate-300 text-slate-500")
            )}
          >
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div
              className={cn(
                "font-medium text-md",
                userType === "creator"
                  ? (isDark ? "text-white" : "text-black")
                  : (isDark ? "text-slate-400" : "text-slate-600")
              )}
            >
              Switch Account
              {userType !== "creator" && (
                <span className="block text-xs font-normal mt-1">
                  Creator only feature
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "h-3 w-3 transition-all",
            userType === "creator" 
              ? "group-hover:translate-x-0.5"
              : "",
            userType === "creator"
              ? (isDark ? "text-white" : "text-purple-600")
              : (isDark ? "text-slate-500" : "text-slate-400")
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </button>

      {/* Account Switch Modal */}
      <Dialog
        open={isSwitchModalOpen}
        onOpenChange={(open) => {
          setIsSwitchModalOpen(open);
          if (!open) {
            setStaleTargetId(null);
            setStaleUsername(null);
            setUnlinkTarget(null);
          }
        }}
      >
        <DialogContent className={cn(
          "max-w-[95vw] sm:max-w-[540px] max-h-[600px] rounded-3xl p-6 overflow-y-auto", 
          isDark 
            ? "bg-[#07031E] border-slate-800 text-white" 
            : "bg-white border-slate-200"
        )}>
          <DialogHeader>
            <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-fit mb-2">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Account Switcher</DialogTitle>
            <DialogDescription className="text-center">
              Choose an account to switch to, or link another creator profile.
            </DialogDescription>
          </DialogHeader>
          <p
            className={cn(
              "text-xs text-center -mt-1",
              isDark ? "text-slate-400" : "text-slate-600",
            )}
          >
            Linked accounts are shared across your switcher pool, so accounts
            added from one profile appear on other linked profiles too.
          </p>

          {isAccountsRefreshing && (
            <div className="flex justify-center py-1">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            </div>
          )}

          {staleTargetId &&
            !accounts.some((a) => a.id === staleTargetId) && (
              <div
                className={cn(
                  "flex flex-col gap-2 p-3 rounded-xl border",
                  isDark
                    ? "bg-amber-950/30 border-amber-800/40"
                    : "bg-amber-50 border-amber-200",
                )}
              >
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {staleUsername
                    ? `@${staleUsername} needs to be re-linked.`
                    : "A linked account needs to be re-linked."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-amber-300 text-amber-900 dark:text-amber-100"
                  onClick={openAddForRelink}
                >
                  Re-link account
                </Button>
              </div>
            )}
          
          <div className="space-y-3 pt-4">
            {/* Current Account (Read only in list) */}
            <div 
              className={cn(
                "w-full flex items-start justify-between gap-2 p-3 rounded-xl border",
                isDark 
                  ? "bg-violet-500/10 border-violet-500/30" 
                  : "bg-violet-50 border-violet-200"
              )}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                 <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 border-2 border-violet-500">
                      <AvatarFallback className="bg-violet-600 text-[10px] text-white font-bold">
                        {currentUsername.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full h-3.5 w-3.5 border-2 border-white dark:border-[#07031E] flex items-center justify-center">
                       <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    </div>
                 </div>
                 <div className="text-left min-w-0 flex-1">
                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                       @{currentUsername}
                    </p>
                    <p className="text-xs text-violet-500 font-medium tracking-tight">Active Now</p>
                    <AccountCardEmailRow
                      email={currentUserEmail}
                      revealed={isEmailShown("current")}
                      onToggle={() => toggleEmailReveal("current")}
                      isDark={isDark}
                    />
                    <ConnectedOnLine
                      dateLabel={formatConnectedOn(currentUserJoinedAt)}
                      isDark={isDark}
                    />
                 </div>
              </div>
              <Check className="h-5 w-5 text-violet-500 shrink-0 mt-1" />
            </div>

            {/* Saved Accounts */}
            {accounts.map((acc) => {
              const isStaleRow = staleTargetId === acc.id;
              const switchDisabled =
                isStaleRow || !!isSwitching;
              return (
                <div key={acc.id} className="space-y-2">
                  <div
                    className={cn(
                      "w-full flex items-stretch gap-2 p-3 rounded-xl border text-left transition-all group",
                      isStaleRow &&
                        (isDark
                          ? "border-amber-600/50 bg-amber-950/20"
                          : "border-amber-300 bg-amber-50/80"),
                      !isStaleRow &&
                        (isDark
                          ? "bg-slate-900/40 border-slate-800 hover:border-violet-500/40 hover:bg-violet-500/5"
                          : "bg-white border-slate-200 hover:border-violet-300 hover:bg-slate-50"),
                    )}
                  >
                    <div
                      tabIndex={switchDisabled ? -1 : 0}
                      aria-disabled={switchDisabled}
                      aria-label={
                        isStaleRow
                          ? `Linked account @${acc.username}, session expired`
                          : `Switch to @${acc.username}`
                      }
                      onClick={() => {
                        if (!switchDisabled) handleSwitch(acc.id);
                      }}
                      onKeyDown={(e) => {
                        if (switchDisabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSwitch(acc.id);
                        }
                      }}
                      className={cn(
                        "flex min-w-0 flex-1 items-start gap-3 rounded-lg outline-none",
                        switchDisabled
                          ? "cursor-not-allowed opacity-80"
                          : "cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                        isDark
                          ? "focus-visible:ring-offset-[#07031E]"
                          : "focus-visible:ring-offset-white",
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0 grayscale-[0.5] group-hover:grayscale-0 transition-all border border-slate-200 dark:border-slate-800">
                        <AvatarImage src={acc.avatar_url} />
                        <AvatarFallback className="bg-slate-500 text-[10px] text-white">
                          {acc.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isDark
                              ? "text-slate-300 group-hover:text-white"
                              : "text-slate-700 group-hover:text-slate-900",
                          )}
                        >
                          @{acc.username}
                        </p>
                        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                          {isStaleRow ? "session expired" : acc.user_type}
                        </p>
                        <AccountCardEmailRow
                          email={acc.relink_email_hint}
                          revealed={isEmailShown(acc.id)}
                          onToggle={() => toggleEmailReveal(acc.id)}
                          isDark={isDark}
                        />
                        <ConnectedOnLine
                          dateLabel={formatConnectedOn(acc.connected_at)}
                          isDark={isDark}
                        />
                      </div>
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-0.5 self-center pr-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!!isSwitching || isUnlinking}
                            className={cn(
                              "h-9 w-9 shrink-0 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                              isDark &&
                                "text-slate-400 hover:bg-white/10 hover:text-slate-100",
                            )}
                            aria-haspopup="menu"
                            aria-label={`More options for @${acc.username}`}
                            title="More options"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={6}
                          className={cn(
                            "w-[min(100vw-2rem,16rem)] rounded-xl border p-1 shadow-lg",
                            isDark
                              ? "border-slate-700 bg-[#0f0a24] text-slate-100"
                              : "border-slate-200 bg-white",
                          )}
                        >
                          <DropdownMenuLabel
                            className={cn(
                              "font-normal text-xs normal-case text-slate-500",
                              isDark && "text-slate-400",
                            )}
                          >
                            @{acc.username}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator
                            className={cn(
                              "bg-slate-200",
                              isDark && "bg-slate-700",
                            )}
                          />
                          <DropdownMenuItem
                            className={cn(
                              "cursor-pointer rounded-lg text-sm focus:text-destructive",
                              isDark
                                ? "text-red-300 focus:bg-red-950/50 focus:text-red-200"
                                : "text-destructive focus:bg-destructive/10",
                            )}
                            disabled={!!isSwitching}
                            onSelect={() =>
                              setUnlinkTarget({
                                id: acc.id,
                                username: acc.username,
                              })
                            }
                          >
                            <Link2Off className="h-4 w-4" />
                            Remove from switcher
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {isSwitching === acc.id ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-violet-500" />
                      ) : !isStaleRow ? (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-violet-500 opacity-70 group-hover:opacity-100"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                  </div>
                  {isStaleRow && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddForRelink();
                      }}
                    >
                      Re-link @{acc.username}
                    </Button>
                  )}
                </div>
              );
            })}

            {accounts.length === 0 && !isListLoading && (
              <div className={cn(
                "flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed",
                 isDark ? "border-slate-800" : "border-slate-200"
              )}>
                 <Users className="h-8 w-8 text-slate-500 mb-3 opacity-50" />
                 <p className="text-sm text-slate-500 text-center italic">
                    No linked accounts yet. Add your first account below.
                 </p>
              </div>
            )}

            {accounts.length >= 5 && (
              <div className={cn(
                "flex flex-col items-center justify-center py-6 px-4 rounded-xl border",
                 isDark ? "bg-red-950/20 border-red-800/30" : "bg-red-50 border-red-200"
              )}>
                 <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                 <p className="text-sm text-red-600 text-center font-medium">
                    Maximum account limit reached (5/5)
                 </p>
                 <p className={cn(
                   "text-xs text-center mt-1 max-w-sm",
                   isDark ? "text-red-300/90" : "text-red-600/90",
                 )}>
                   Open the ⋮ menu on a linked account, tap “Remove from switcher”, then you can add another.
                 </p>
              </div>
            )}
            
            {isListLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            )}
          </div>

          {/* Add Account Button - Only show if under limit */}
          {accounts.length < 5 && (
            <div className="pt-4">
              <Button 
                onClick={() => {
                  setIsSwitchModalOpen(false);
                  setIsAddModalOpen(true);
                }}
                variant="outline" 
                className={cn(
                  "w-full h-11 rounded-xl font-semibold transition-all",
                  isDark 
                    ? "border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300" 
                    : "border-violet-200 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                )}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Account
              </Button>
            </div>
          )}
          
          {/* Account counter - Always show */}
          {/* <div className="pt-2">
            <p className={cn(
              "text-xs text-center",
              isDark ? "text-slate-400" : "text-slate-500"
            )}>
              {accounts.length}/5 accounts linked
            </p>
          </div> */}

        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!unlinkTarget}
        onOpenChange={(open) => {
          if (!open && !isUnlinking) setUnlinkTarget(null);
        }}
      >
        <AlertDialogContent
          className={cn(
            "rounded-2xl sm:rounded-2xl max-w-md",
            isDark
              ? "border-slate-800 bg-[#07031E] text-white"
              : "border-slate-200 bg-white",
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-left text-lg">
              {unlinkTarget
                ? `Remove @${unlinkTarget.username} from your switcher?`
                : "Remove linked account?"}
            </AlertDialogTitle>
            <AlertDialogDescription
              className={cn(
                "text-left text-sm leading-relaxed",
                isDark ? "text-slate-400" : "text-slate-600",
              )}
            >
              {unlinkTarget ? (
                <>
                  This only removes the quick-switch link and saved sign-in for{" "}
                  <strong
                    className={cn(
                      "font-semibold",
                      isDark ? "text-slate-100" : "text-slate-900",
                    )}
                  >
                    @{unlinkTarget.username}
                  </strong>
                  . Their creator account is not deleted. You can link them again
                  anytime with email, password, or Google.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
            <AlertDialogCancel
              disabled={isUnlinking}
              className={cn(
                "mt-0 rounded-xl border sm:mt-0",
                isDark &&
                  "border-slate-600 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white",
              )}
            >
              Keep linked
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="w-full rounded-xl sm:w-auto"
              disabled={isUnlinking}
              onClick={() => void handleConfirmUnlink()}
            >
              {isUnlinking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing…
                </>
              ) : (
                "Remove link"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Account Modal */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            setPassword("");
          }
        }}
      >
        <DialogContent className={cn(
          "max-w-[95vw] sm:max-w-[400px] h-[80vh] max-h-[600px] rounded-3xl p-6 overflow-y-auto", 
          isDark 
            ? "bg-[#07031E] border-slate-800 text-white" 
            : "bg-white border-slate-200"
        )}>
          <DialogHeader>
            <div className="mx-auto bg-violet-500/10 p-4 rounded-full w-fit mb-2">
              <Users className="h-8 w-8 text-violet-500" />
            </div>
            <DialogTitle className="text-2xl text-center font-bold">Link New Account</DialogTitle>
            <DialogDescription className="text-center">
              Link another creator account to your switcher. You stay signed in as
              you are now; switch from the list when you are ready.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full h-11 rounded-xl font-semibold",
                isDark
                  ? "border-white/15 hover:bg-white/5"
                  : "border-slate-200",
              )}
              disabled={isLinking}
              onClick={() => {
                window.location.href = "/api/account-switch/google/start";
              }}
            >
              Link with Google
            </Button>
            <p
              className={cn(
                "text-[11px] text-center mt-2",
                isDark ? "text-slate-500" : "text-slate-500",
              )}
            >
              Opens Google sign-in, then returns here after linking.
            </p>
          </div>

          <p
            className={cn(
              "text-xs text-center pt-2",
              isDark ? "text-slate-500" : "text-slate-500",
            )}
          >
            Or use email and password
          </p>
          
          <form onSubmit={handleAddAccount} className="space-y-4 pt-2">
             <div className="space-y-2">
               <Label htmlFor="s-email" className="text-sm font-semibold ml-1">Account Email</Label>
               <Input 
                 id="s-email" 
                 type="email" 
                 value={email} 
                 onChange={e => setEmail(e.target.value)} 
                 placeholder="your@email.com"
                 className={cn(
                   "h-11 rounded-xl px-4",
                   isDark 
                     ? "bg-white/[0.03] border-white/10 focus:ring-violet-500" 
                     : "bg-slate-50 border-slate-200 focus:ring-violet-400"
                 )}
                 required 
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="s-password" className="text-sm font-semibold ml-1">Password</Label>
               <div className="relative">
                 <Input 
                   id="s-password" 
                   type={showPassword ? "text" : "password"} 
                   value={password} 
                   onChange={e => setPassword(e.target.value)}
                   placeholder="••••••••"
                   className={cn(
                     "h-11 rounded-xl px-4 pr-12",
                     isDark 
                       ? "bg-white/[0.03] border-white/10 focus:ring-violet-500" 
                       : "bg-slate-50 border-slate-200 focus:ring-violet-400"
                   )}
                   required 
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className={cn(
                     "absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md transition-colors",
                     isDark 
                       ? "hover:bg-white/10 text-slate-400 hover:text-slate-300" 
                       : "hover:bg-slate-100 text-slate-500 hover:text-slate-600"
                   )}
                 >
                   {showPassword ? (
                     <EyeOff className="h-4 w-4" />
                   ) : (
                     <Eye className="h-4 w-4" />
                   )}
                 </button>
               </div>
             </div>

             {/* <div className={cn(
               "flex items-start gap-3 p-3 rounded-xl",
               isDark ? "bg-amber-950/20 text-amber-200/80" : "bg-amber-50 text-amber-700"
             )}>
               <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
               <p className="text-[11px] leading-tight">
                 For security, you may be asked to re-authenticate periodically if a session group is inactive.
               </p>
             </div> */}

             <DialogFooter className="pt-4 flex sm:justify-center gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLinking} 
                  className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-8 h-11 font-bold shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                >
                  {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

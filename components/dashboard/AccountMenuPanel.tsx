"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  HelpCircle,
  LogOut,
  Settings,
  UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AccountRole = "advertiser" | "creator" | "admin";

export function accountRoleLabel(userRole?: AccountRole | null) {
  if (userRole === "creator") return "Creator";
  if (userRole === "advertiser") return "Brand";
  if (userRole === "admin") return "Admin";
  return null;
}

export function AccountRoleBadge({
  userRole,
  isDark,
  className,
}: {
  userRole?: AccountRole | null;
  isDark: boolean;
  className?: string;
}) {
  const label = accountRoleLabel(userRole);
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none",
        isDark
          ? "bg-[rgb(var(--accent-rgb)/0.22)] text-[rgb(var(--accent-2-rgb))]"
          : "bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--violet-600)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

type AccountMenuPanelProps = {
  userRole?: AccountRole | null;
  userName: string;
  userEmail?: string;
  isDark: boolean;
  isSigningOut?: boolean;
  onNavigate?: () => void;
  onSignOut?: () => void;
  className?: string;
};

export function AccountMenuPanel({
  userRole,
  userName,
  userEmail,
  isDark,
  isSigningOut = false,
  onNavigate,
  onSignOut,
  className,
}: AccountMenuPanelProps) {
  const billingHref =
    userRole === "creator"
      ? "/dashboard/earnings"
      : "/dashboard/billing?tab=subscription";
  const helpHref =
    userRole === "admin" ? "/dashboard/admin/support" : "/dashboard/help";
  const itemClass = cn(
    "flex items-center gap-2.5 px-3 py-2 text-sm",
    isDark ? "hover:bg-white/10" : "hover:bg-[#e6e6e8]",
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border py-1 shadow-lg",
        isDark
          ? "border-white/10 bg-[#161616] text-white"
          : "border-[#e6e6e8] bg-white text-[#1a1a1a]",
        className,
      )}
    >
      <div className="px-3 py-2.5">
        <div className="truncate text-sm font-semibold">{userName}</div>
        {userEmail ? (
          <div
            className={cn(
              "mt-0.5 truncate text-xs",
              isDark ? "text-white/55" : "text-[#8b8b93]",
            )}
          >
            {userEmail}
          </div>
        ) : null}
      </div>
      <div className={cn("mx-2 h-px", isDark ? "bg-white/10" : "bg-[#eeeef0]")} />
      {userRole === "admin" ? (
        <Link href="/dashboard/profile" onClick={onNavigate} className={itemClass}>
          <UserCircle className="h-4 w-4" strokeWidth={1.75} />
          Profile
        </Link>
      ) : (
        <>
          <Link href="/dashboard/settings" onClick={onNavigate} className={itemClass}>
            <Settings className="h-4 w-4" strokeWidth={1.75} />
            Settings
          </Link>
          {userRole === "creator" ? (
            <Link href="/dashboard/profile" onClick={onNavigate} className={itemClass}>
              <UserCircle className="h-4 w-4" strokeWidth={1.75} />
              Profile
            </Link>
          ) : userRole ? (
            <Link href={billingHref} onClick={onNavigate} className={itemClass}>
              <CreditCard className="h-4 w-4" strokeWidth={1.75} />
              Plan and billing
            </Link>
          ) : null}
          <Link href={helpHref} onClick={onNavigate} className={itemClass}>
            <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
            Help
          </Link>
        </>
      )}
      <div
        className={cn("mx-2 my-1 h-px", isDark ? "bg-white/10" : "bg-[#eeeef0]")}
      />
      <button
        type="button"
        onClick={() => {
          onNavigate?.();
          onSignOut?.();
        }}
        disabled={isSigningOut}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-60",
          isDark ? "hover:bg-white/10" : "hover:bg-[#e6e6e8]",
        )}
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} />
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

type HeaderAccountMenuProps = {
  userRole?: AccountRole | null;
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
  avatarFallback: string;
  isDark: boolean;
  isSigningOut?: boolean;
  onSignOut?: () => void;
};

export function HeaderAccountMenu({
  userRole,
  userName,
  userEmail,
  avatarUrl,
  avatarFallback,
  isDark,
  isSigningOut,
  onSignOut,
}: HeaderAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "h-auto min-h-9 py-1.5 px-2.5 sm:px-3 gap-0 rounded-xl border transition-colors",
          isDark
            ? "border-transparent hover:border-white/10 hover:bg-white/10"
            : "border-transparent hover:border-[#e6e6e8] hover:bg-[#e6e6e8]",
        )}
      >
        <div className="flex items-center gap-2.5">
          {avatarUrl ? (
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={avatarUrl} alt={userName} />
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  isDark ? "bg-white/15 text-white" : "bg-[#ececef] text-[#3a3a40]",
                )}
              >
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                isDark ? "bg-white/15 text-white" : "bg-[#ececef] text-[#3a3a40]",
              )}
            >
              {avatarFallback}
            </div>
          )}
          <div className="hidden sm:flex min-w-0 flex-col items-start text-left">
            <span
              className={cn(
                "max-w-[9rem] truncate text-sm font-semibold leading-tight md:max-w-[11rem]",
                isDark ? "text-white" : "text-[#1a1a1a]",
              )}
              title={userName}
            >
              {userName}
            </span>
            <AccountRoleBadge
              userRole={userRole}
              isDark={isDark}
              className="mt-1"
            />
          </div>
        </div>
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64">
          <AccountMenuPanel
            userRole={userRole}
            userName={userName}
            userEmail={userEmail}
            isDark={isDark}
            isSigningOut={isSigningOut}
            onNavigate={() => setOpen(false)}
            onSignOut={onSignOut}
          />
        </div>
      ) : null}
    </div>
  );
}

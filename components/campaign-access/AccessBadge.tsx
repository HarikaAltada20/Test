import type { ReactNode } from "react";
import {
  CircleCheck,
  CircleX,
  ClipboardList,
  Clock,
  Globe,
  Lock,
  Undo2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APPLICATION_DISPLAY_STATUS_LABELS,
  type AccessMode,
  type ApplicationDisplayStatus,
  type InviteLinkStatus,
} from "@/lib/campaign-access";

/**
 * Badge colours for campaign access. Dark colours use `dark:` classes, so the
 * badge must sit under an element with the `dark` class when the dashboard is dark.
 */
export type BadgeTone = "green" | "slate" | "purple" | "amber" | "red" | "gray";

const TONES: Record<BadgeTone, string> = {
  green:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-[#0F2E22] dark:text-emerald-300",
  slate:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/30 dark:bg-[#1E2633] dark:text-slate-200",
  purple:
    "border-purple-200 bg-purple-50 text-[#4A00BE] dark:border-[#7F39EC]/40 dark:bg-[#2B1159] dark:text-purple-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-[#3A2A0A] dark:text-amber-300",
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-[#3B1216] dark:text-red-300",
  gray: "border-gray-200 bg-gray-100 text-gray-600 dark:border-white/15 dark:bg-[#23202E] dark:text-gray-300",
};

type BaseProps = {
  tone: BadgeTone;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

export function CampaignBadge({ tone, icon: Icon, size = "sm", className, children }: BaseProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />}
      {children}
    </span>
  );
}

const MODE_BADGES: Record<AccessMode, { tone: BadgeTone; icon: LucideIcon; label: string }> = {
  public: { tone: "green", icon: Globe, label: "Public" },
  private: { tone: "slate", icon: Lock, label: "Private" },
  restricted: { tone: "purple", icon: ClipboardList, label: "Restricted" },
};

export function AccessModeBadge({
  mode,
  label,
  size,
  className,
}: {
  mode: AccessMode;
  /** Overrides the default label, e.g. "Restricted · apply to join". */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const badge = MODE_BADGES[mode];
  return (
    <CampaignBadge tone={badge.tone} icon={badge.icon} size={size} className={className}>
      {label ?? badge.label}
    </CampaignBadge>
  );
}

const STATUS_BADGES: Record<ApplicationDisplayStatus, { tone: BadgeTone; icon: LucideIcon }> = {
  pending: { tone: "amber", icon: Clock },
  approved: { tone: "green", icon: CircleCheck },
  rejected: { tone: "red", icon: CircleX },
  withdrawn: { tone: "gray", icon: Undo2 },
  access_removed: { tone: "gray", icon: UserX },
};

export function ApplicationStatusBadge({
  status,
  label,
  size,
  className,
}: {
  status: ApplicationDisplayStatus;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const badge = STATUS_BADGES[status];
  return (
    <CampaignBadge tone={badge.tone} icon={badge.icon} size={size} className={className}>
      {label ?? APPLICATION_DISPLAY_STATUS_LABELS[status]}
    </CampaignBadge>
  );
}

const INVITE_BADGES: Record<InviteLinkStatus, { tone: BadgeTone; label: string }> = {
  active: { tone: "green", label: "Active" },
  full: { tone: "gray", label: "Full" },
  expired: { tone: "gray", label: "Expired" },
  revoked: { tone: "gray", label: "Revoked" },
};

export function InviteLinkStatusBadge({ status }: { status: InviteLinkStatus }) {
  const badge = INVITE_BADGES[status];
  return <CampaignBadge tone={badge.tone}>{badge.label}</CampaignBadge>;
}

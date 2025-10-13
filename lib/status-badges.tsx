import React from "react";
import { Info, AlertCircle, CheckCircle, DollarSign } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { SUBMISSION_STATUS, type SubmissionStatus } from "./constants-status";

export interface StatusBadgeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  className: string;
  showInLeaderboard: boolean;
}

export const STATUS_BADGE_CONFIG: Record<SubmissionStatus, StatusBadgeConfig> = {
  [SUBMISSION_STATUS.pending]: {
    label: "Pending",
    icon: Info,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
    showInLeaderboard: true,
  },
  [SUBMISSION_STATUS.rejected]: {
    label: "Rejected", 
    icon: AlertCircle,
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    showInLeaderboard: true,
  },
  [SUBMISSION_STATUS.verified]: {
    label: "Verified",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    showInLeaderboard: false,
  },
  [SUBMISSION_STATUS.paid]: {
    label: "Paid",
    icon: DollarSign,
    className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    showInLeaderboard: false,
  },
};

export function renderStatusBadge(status: SubmissionStatus, contestType?: string | null) {
  if (contestType !== "cpm" && contestType !== "leaderboard") return null;

  const config = STATUS_BADGE_CONFIG[status];
  if (!config.showInLeaderboard) return null;

  const Icon = config.icon;

  return React.createElement(Badge, {
    variant: "secondary",
    className: `${config.className} text-xs font-medium`
  }, 
    React.createElement(Icon, { className: "h-3 w-3 mr-1" }),
    config.label
  );
}
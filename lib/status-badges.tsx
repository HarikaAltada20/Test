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
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800",
    showInLeaderboard: true,
  },
  [SUBMISSION_STATUS.rejected]: {
    label: "Rejected",
    icon: AlertCircle,
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    showInLeaderboard: true,
  },
  [SUBMISSION_STATUS.verified]: {
    label: "Verified",
    icon: CheckCircle,
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800",
    showInLeaderboard: false,
  },
  [SUBMISSION_STATUS.paid]: {
    label: "Paid",
    icon: DollarSign,
    className:
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    showInLeaderboard: false,
  },
};

const SUBMISSION_STATUS_VALUES = new Set<string>(Object.values(SUBMISSION_STATUS));

/** Map submission / Twitter moderation values to a canonical submission status. */
export function normalizeLeaderboardSubmissionStatus(
  status?: string | null,
  moderationStatus?: string | null,
): SubmissionStatus | null {
  const raw = String(status || moderationStatus || "").toLowerCase();
  if (!raw) return null;
  if (raw === "approved") return SUBMISSION_STATUS.verified;
  if (SUBMISSION_STATUS_VALUES.has(raw)) {
    return raw as SubmissionStatus;
  }
  return null;
}

/** Pick the status badge to show when a creator has multiple submissions. */
export function resolveAggregateLeaderboardStatus(
  entries: Array<{
    status?: string | null;
    moderation_status?: string | null;
  }>,
): SubmissionStatus | null {
  let hasPending = false;
  let hasRejected = false;

  for (const entry of entries) {
    const normalized = normalizeLeaderboardSubmissionStatus(
      entry.status,
      entry.moderation_status,
    );
    if (normalized === SUBMISSION_STATUS.pending) hasPending = true;
    if (normalized === SUBMISSION_STATUS.rejected) hasRejected = true;
  }

  if (hasPending) return SUBMISSION_STATUS.pending;
  if (hasRejected) return SUBMISSION_STATUS.rejected;
  return null;
}

export type LeaderboardBadgeSource = {
  status?: string | null;
  moderation_status?: string | null;
  display_status?: string | null;
  submissions?: Array<{
    status?: string | null;
    moderation_status?: string | null;
  }>;
};

export function resolveLeaderboardBadgeStatus(
  source: LeaderboardBadgeSource | string | null | undefined,
): SubmissionStatus | null {
  if (!source) return null;
  if (typeof source === "string") {
    return normalizeLeaderboardSubmissionStatus(source);
  }

  if (source.submissions?.length) {
    const aggregated = resolveAggregateLeaderboardStatus(source.submissions);
    if (aggregated) return aggregated;
  }

  if (source.display_status) {
    return normalizeLeaderboardSubmissionStatus(source.display_status);
  }

  // Server-side creator-wise rows set display_status to null when every
  // submission is verified/paid — do not infer pending from missing fields.
  if ("display_status" in source && source.display_status == null) {
    return null;
  }

  return normalizeLeaderboardSubmissionStatus(
    source.status,
    source.moderation_status,
  );
}

export function renderStatusBadge(
  status: SubmissionStatus,
  _contestType?: string | null,
) {
  const config = STATUS_BADGE_CONFIG[status];
  if (!config?.showInLeaderboard) return null;

  const Icon = config.icon;

  return React.createElement(
    Badge,
    {
      variant: "secondary",
      className: `${config.className} text-xs font-medium`,
    },
    React.createElement(Icon, { className: "h-3 w-3 mr-1" }),
    config.label,
  );
}

export function renderLeaderboardStatusBadge(
  source: LeaderboardBadgeSource | string | null | undefined,
): React.ReactNode | null {
  const normalized = resolveLeaderboardBadgeStatus(source);
  if (!normalized) return null;
  return renderStatusBadge(normalized);
}

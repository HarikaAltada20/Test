"use client";

import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InlineSubmissionVideoPlayer } from "@/components/InlineSubmissionVideoPlayer";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";

type SubmissionDetailedViewCardProps = {
  submissionId: string;
  contentLink: string;
  platform?: string | null;
  videoId?: string | null;
  videoThumbnailUrl?: string | null;
  rank: number;
  creatorDisplayName?: string | null;
  creatorUsername?: string | null;
  creatorAvatarUrl?: string | null;
  statusBadge: ReactNode;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  platformLabel?: string;
  actions: ReactNode;
  isDark?: boolean;
  className?: string;
};

export function SubmissionDetailedViewCard({
  submissionId,
  contentLink,
  platform,
  videoId,
  videoThumbnailUrl,
  rank,
  creatorDisplayName,
  creatorUsername,
  creatorAvatarUrl,
  statusBadge,
  metrics,
  platformLabel,
  actions,
  isDark = false,
  className,
}: SubmissionDetailedViewCardProps) {
  const metricItems = [
    { label: "Views", value: metrics.views ?? 0, icon: Eye },
    { label: "Likes", value: metrics.likes ?? 0, icon: Heart },
    { label: "Comments", value: metrics.comments ?? 0, icon: MessageCircle },
    { label: "Shares", value: metrics.shares ?? 0, icon: Share2 },
  ];

  return (
    <article
      className={cn(
        "grid grid-cols-1 gap-4 p-4 md:p-5 rounded-2xl border shadow-sm",
        "lg:grid-cols-[minmax(200px,260px)_1fr]",
        isDark
          ? "bg-[#0f172a] border-slate-800"
          : "bg-white border-slate-200",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <InlineSubmissionVideoPlayer
          submissionId={submissionId}
          contentLink={contentLink}
          platform={platform}
          videoId={videoId}
          videoThumbnailUrl={videoThumbnailUrl}
          isDark={isDark}
        />
        {platformLabel && (
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            {platformLabel}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                isDark
                  ? "bg-violet-900/50 text-violet-200"
                  : "bg-violet-100 text-violet-700",
              )}
            >
              #{rank}
            </span>
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={creatorAvatarUrl || undefined} />
              <AvatarFallback>
                {(creatorDisplayName || creatorUsername || "C")
                  .charAt(0)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className={cn(
                  "font-semibold truncate",
                  isDark ? "text-white" : "text-slate-900",
                )}
              >
                {creatorDisplayName || "Unknown Creator"}
              </p>
              <p
                className={cn(
                  "text-xs font-mono truncate",
                  isDark ? "text-slate-400" : "text-slate-600",
                )}
              >
                {creatorUsername || "unknown"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">{statusBadge}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {metricItems.map(({ label, value, icon: Icon }) => (
            <Badge
              key={label}
              variant="outline"
              className={cn(
                "gap-1.5 px-2.5 py-1 text-xs font-semibold",
                isDark
                  ? "border-slate-700 bg-slate-800/60 text-slate-200"
                  : "border-slate-200 bg-slate-50 text-slate-700",
              )}
            >
              <Icon className="h-3.5 w-3.5 opacity-70" />
              {label}: {value.toLocaleString()}
            </Badge>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-end border-t pt-3 border-slate-200/80 dark:border-slate-700">
          {actions}
        </div>
      </div>
    </article>
  );
}

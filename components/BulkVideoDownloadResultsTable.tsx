"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BulkVideoDownloadResultRow } from "@/lib/video-download-ui";

function formatViews(views: number): string {
  return Number(views || 0).toLocaleString();
}

function rowDisplayName(row: BulkVideoDownloadResultRow): string {
  return (
    row.displayName?.trim() ||
    row.username?.trim() ||
    "Unknown Creator"
  );
}

function rowInitial(row: BulkVideoDownloadResultRow): string {
  return rowDisplayName(row).charAt(0).toUpperCase() || "U";
}

function creatorGroupKey(row: BulkVideoDownloadResultRow): string {
  if (row.creatorId) return `id:${row.creatorId}`;
  return `user:${(row.username || "unknown").trim().toLowerCase()}`;
}

type CreatorGroup = {
  key: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalViews: number;
  videos: BulkVideoDownloadResultRow[];
};

export function BulkVideoDownloadResultsTable({
  rows,
  isDark = false,
}: {
  rows: BulkVideoDownloadResultRow[];
  isDark?: boolean;
}) {
  const [tab, setTab] = useState<"success" | "failed">("success");
  const [viewMode, setViewMode] = useState<"normal" | "creators">("normal");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!viewMenuRef.current?.contains(event.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [viewMenuOpen]);

  const succeeded = useMemo(
    () => rows.filter((row) => row.status === "success"),
    [rows],
  );
  const failed = useMemo(
    () => rows.filter((row) => row.status === "failed"),
    [rows],
  );
  const visible = tab === "success" ? succeeded : failed;

  const creatorGroups = useMemo(() => {
    const map = new Map<string, CreatorGroup>();
    for (const row of visible) {
      const key = creatorGroupKey(row);
      const existing = map.get(key);
      if (existing) {
        existing.videos.push(row);
        existing.totalViews += Number(row.views) || 0;
        if (!existing.avatarUrl && row.avatarUrl) {
          existing.avatarUrl = row.avatarUrl;
        }
        if (
          (!existing.displayName || existing.displayName === existing.username) &&
          row.displayName?.trim()
        ) {
          existing.displayName = row.displayName.trim();
        }
      } else {
        map.set(key, {
          key,
          username: row.username || "unknown",
          displayName: rowDisplayName(row),
          avatarUrl: row.avatarUrl ?? null,
          totalViews: Number(row.views) || 0,
          videos: [row],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.totalViews - a.totalViews,
    );
  }, [visible]);

  if (rows.length === 0) return null;

  const emptyMessage = (
    <div
      className={cn(
        "px-4 py-10 text-center text-sm",
        isDark ? "text-slate-400" : "text-slate-500",
      )}
    >
      No {tab === "success" ? "successful" : "failed"} videos in this batch.
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("success")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === "success"
                ? "bg-emerald-600 text-white"
                : isDark
                  ? "bg-white/10 text-slate-300 hover:bg-white/15"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            Succeeded ({succeeded.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("failed")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              tab === "failed"
                ? "bg-red-600 text-white"
                : isDark
                  ? "bg-white/10 text-slate-300 hover:bg-white/15"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            Failed ({failed.length})
          </button>
        </div>

        <div className="relative" ref={viewMenuRef}>
          <button
            type="button"
            aria-label="Results view mode"
            aria-haspopup="listbox"
            aria-expanded={viewMenuOpen}
            onClick={() => setViewMenuOpen((open) => !open)}
            className={cn(
              "flex h-9 w-[160px] items-center justify-between rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? "border-gray-700 bg-[#07031D] text-white hover:bg-gray-700"
                : "border-input bg-white text-slate-800 hover:bg-accent/50",
            )}
          >
            <span>{viewMode === "creators" ? "Creators wise" : "Normal"}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 opacity-50 transition-transform",
                viewMenuOpen && "rotate-180",
              )}
            />
          </button>
          {viewMenuOpen && (
            <div
              role="listbox"
              className={cn(
                "absolute right-0 z-20 mt-1 w-[160px] overflow-hidden rounded-lg border shadow-lg",
                isDark
                  ? "border-gray-700 bg-[#07031D] text-white"
                  : "border-slate-200 bg-white text-slate-900",
              )}
            >
              {(
                [
                  { value: "normal", label: "Normal" },
                  { value: "creators", label: "Creators wise" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={viewMode === option.value}
                  onClick={() => {
                    setViewMode(option.value);
                    setViewMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-xs font-medium transition-colors",
                    viewMode === option.value
                      ? "bg-purple-600 text-white"
                      : isDark
                        ? "hover:bg-purple-500/30"
                        : "hover:bg-purple-100 hover:text-purple-800",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "max-h-[28rem] overflow-auto rounded-lg border",
          isDark ? "border-gray-600" : "border-slate-200",
        )}
      >
        {visible.length === 0 ? (
          emptyMessage
        ) : viewMode === "normal" ? (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {visible.map((row, index) => (
              <li
                key={row.submissionId}
                className={cn(
                  "flex items-start justify-between gap-4 px-4 py-3.5",
                  index % 2 === 1 &&
                    (isDark ? "bg-white/[0.03]" : "bg-slate-50/80"),
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage
                      src={row.avatarUrl || undefined}
                      alt={rowDisplayName(row)}
                    />
                    <AvatarFallback
                      className={cn(
                        "text-sm font-semibold",
                        isDark
                          ? "bg-violet-500/20 text-violet-200"
                          : "bg-violet-100 text-violet-700",
                      )}
                    >
                      {rowInitial(row)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        isDark ? "text-slate-100" : "text-slate-900",
                      )}
                    >
                      {rowDisplayName(row)}
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      @{row.username || "unknown"}
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs max-w-[18rem] sm:max-w-[24rem]",
                        isDark ? "text-slate-300" : "text-slate-600",
                      )}
                      title={row.videoTitle}
                    >
                      {row.videoTitle || "Untitled"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                      {row.link ? (
                        <a
                          href={row.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center gap-1 text-xs font-medium hover:underline",
                            isDark ? "text-sky-300" : "text-blue-600",
                          )}
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          View Content
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </a>
                      ) : (
                        <span
                          className={cn(
                            "text-xs",
                            isDark ? "text-slate-500" : "text-slate-400",
                          )}
                        >
                          No video link
                        </span>
                      )}
                      {tab === "failed" && row.error && (
                        <span
                          className={cn(
                            "text-xs max-w-[14rem] truncate",
                            isDark ? "text-red-300" : "text-red-600",
                          )}
                          title={row.error}
                        >
                          {row.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right pt-0.5">
                  <p
                    className={cn(
                      "text-base font-semibold tabular-nums leading-none",
                      isDark ? "text-slate-100" : "text-slate-900",
                    )}
                  >
                    {formatViews(row.views)}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[10px] uppercase tracking-wide",
                      isDark ? "text-slate-500" : "text-slate-400",
                    )}
                  >
                    views
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {creatorGroups.map((group, index) => (
              <li
                key={group.key}
                className={cn(
                  "px-4 py-3.5",
                  index % 2 === 1 &&
                    (isDark ? "bg-white/[0.03]" : "bg-slate-50/80"),
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage
                        src={group.avatarUrl || undefined}
                        alt={group.displayName}
                      />
                      <AvatarFallback
                        className={cn(
                          "text-sm font-semibold",
                          isDark
                            ? "bg-violet-500/20 text-violet-200"
                            : "bg-violet-100 text-violet-700",
                        )}
                      >
                        {group.displayName.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 space-y-1">
                      <p
                        className={cn(
                          "truncate text-sm font-semibold",
                          isDark ? "text-slate-100" : "text-slate-900",
                        )}
                      >
                        {group.displayName}
                      </p>
                      <p
                        className={cn(
                          "truncate text-xs",
                          isDark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        @{group.username}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          isDark ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        {group.videos.length} video
                        {group.videos.length === 1 ? "" : "s"}
                      </p>
                      <div className="flex flex-col gap-1 pt-1">
                        {group.videos.map((video) => (
                          <div
                            key={video.submissionId}
                            className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                          >
                            {video.link ? (
                              <a
                                href={video.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-medium hover:underline",
                                  isDark ? "text-sky-300" : "text-blue-600",
                                )}
                                title={video.videoTitle || "Untitled"}
                              >
                                <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                                <span className="max-w-[14rem] truncate sm:max-w-[20rem]">
                                  {video.videoTitle || "View Content"}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                              </a>
                            ) : (
                              <span
                                className={cn(
                                  "text-xs truncate max-w-[16rem]",
                                  isDark ? "text-slate-500" : "text-slate-400",
                                )}
                              >
                                {video.videoTitle || "Untitled"}
                              </span>
                            )}
                            <span
                              className={cn(
                                "text-[11px] tabular-nums",
                                isDark ? "text-slate-500" : "text-slate-400",
                              )}
                            >
                              {formatViews(video.views)} views
                            </span>
                            {tab === "failed" && video.error && (
                              <span
                                className={cn(
                                  "text-xs max-w-[12rem] truncate",
                                  isDark ? "text-red-300" : "text-red-600",
                                )}
                                title={video.error}
                              >
                                {video.error}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right pt-0.5">
                    <p
                      className={cn(
                        "text-base font-semibold tabular-nums leading-none",
                        isDark ? "text-slate-100" : "text-slate-900",
                      )}
                    >
                      {formatViews(group.totalViews)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] uppercase tracking-wide",
                        isDark ? "text-slate-500" : "text-slate-400",
                      )}
                    >
                      views
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

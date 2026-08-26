"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import type { BulkVideoDownloadResultRow } from "@/lib/video-download-ui";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const TITLE_MAX_CHARS = 72;

function formatViews(views: number): string {
  return Number(views || 0).toLocaleString();
}

function truncateTitle(title: string | undefined | null): string {
  const text = (title || "Untitled").trim() || "Untitled";
  if (text.length <= TITLE_MAX_CHARS) return text;
  return `${text.slice(0, TITLE_MAX_CHARS).trimEnd()}...`;
}

function rowDisplayName(row: BulkVideoDownloadResultRow): string {
  return row.displayName?.trim() || row.username?.trim() || "Unknown Creator";
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

type ResultsPage = { kind: "list" } | { kind: "creator"; groupKey: string };

function VideoResultRow({
  row,
  isDark,
  striped,
}: {
  row: BulkVideoDownloadResultRow;
  isDark: boolean;
  striped?: boolean;
}) {
  const fullTitle = row.videoTitle?.trim() || "Untitled";
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 px-4 py-3.5",
        striped && (isDark ? "bg-white/[0.03]" : "bg-slate-50/80"),
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
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
        <div className="min-w-0 flex-1 space-y-1">
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
              "text-xs break-words",
              isDark ? "text-slate-300" : "text-slate-600",
            )}
            title={fullTitle}
          >
            {truncateTitle(fullTitle)}
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
    </div>
  );
}

function ResultsPagination({
  page,
  pageSize,
  totalItems,
  isDark,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  isDark: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return (
    <div
      className={cn(
        "border-t px-3 py-3",
        isDark ? "border-gray-600" : "border-slate-200",
      )}
    >
      <PaginationControls
        page={page}
        limit={pageSize}
        total={totalItems}
        totalPages={totalPages}
        hasNextPage={page < totalPages}
        hasPreviousPage={page > 1}
        onPageChange={onPageChange}
        onLimitChange={onPageSizeChange}
        isDark={isDark}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        hide200Option
      />
    </div>
  );
}

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
  const [page, setPage] = useState<ResultsPage>({ kind: "list" });
  const [listPage, setListPage] = useState(1);
  const [creatorVideosPage, setCreatorVideosPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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

  useEffect(() => {
    setPage({ kind: "list" });
    setListPage(1);
  }, [tab, viewMode]);

  useEffect(() => {
    setCreatorVideosPage(1);
  }, [page]);

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize);
    setListPage(1);
    setCreatorVideosPage(1);
  };

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
          (!existing.displayName ||
            existing.displayName === existing.username) &&
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
    return Array.from(map.values()).sort((a, b) => b.totalViews - a.totalViews);
  }, [visible]);

  const activeCreator =
    page.kind === "creator"
      ? (creatorGroups.find((group) => group.key === page.groupKey) ?? null)
      : null;

  const listItems = viewMode === "normal" ? visible : creatorGroups;
  const listTotalPages = Math.max(1, Math.ceil(listItems.length / pageSize));
  const safeListPage = Math.min(listPage, listTotalPages);
  const pagedListItems = listItems.slice(
    (safeListPage - 1) * pageSize,
    safeListPage * pageSize,
  );

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

  if (page.kind === "creator" && activeCreator) {
    const creatorTotalPages = Math.max(
      1,
      Math.ceil(activeCreator.videos.length / pageSize),
    );
    const safeCreatorPage = Math.min(creatorVideosPage, creatorTotalPages);
    const pagedVideos = activeCreator.videos.slice(
      (safeCreatorPage - 1) * pageSize,
      safeCreatorPage * pageSize,
    );

    return (
      <div className="space-y-3 w-full">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPage({ kind: "list" })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              isDark
                ? "bg-white/10 text-slate-200 hover:bg-white/15"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to creators
          </button>
          <span
            className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Creators wise · {activeCreator.displayName}
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
            isDark
              ? "border-gray-600 bg-white/[0.03]"
              : "border-slate-200 bg-slate-50",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={activeCreator.avatarUrl || undefined}
                alt={activeCreator.displayName}
              />
              <AvatarFallback
                className={cn(
                  "text-sm font-semibold",
                  isDark
                    ? "bg-violet-500/20 text-violet-200"
                    : "bg-violet-100 text-violet-700",
                )}
              >
                {activeCreator.displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  isDark ? "text-slate-100" : "text-slate-900",
                )}
              >
                {activeCreator.displayName}
              </p>
              <p
                className={cn(
                  "truncate text-xs",
                  isDark ? "text-slate-400" : "text-slate-500",
                )}
              >
                @{activeCreator.username} · {activeCreator.videos.length} video
                {activeCreator.videos.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-base font-semibold tabular-nums leading-none",
                isDark ? "text-slate-100" : "text-slate-900",
              )}
            >
              {formatViews(activeCreator.totalViews)}
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

        <div
          className={cn(
            "w-full rounded-lg border",
            isDark ? "border-gray-600" : "border-slate-200",
          )}
        >
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {pagedVideos.map((video, index) => (
              <li key={video.submissionId}>
                <VideoResultRow
                  row={video}
                  isDark={isDark}
                  striped={index % 2 === 1}
                />
              </li>
            ))}
          </ul>
          <ResultsPagination
            page={safeCreatorPage}
            pageSize={pageSize}
            totalItems={activeCreator.videos.length}
            isDark={isDark}
            onPageChange={setCreatorVideosPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
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
              "flex h-9 min-w-[200px] max-w-[260px] items-center justify-between rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              isDark
                ? "border-gray-700 bg-[#07031D] text-white hover:bg-gray-700"
                : "border-input bg-white text-slate-800 hover:bg-accent/50",
            )}
          >
            <span className="truncate pr-1">
              {viewMode === "creators"
                ? "Creator-wise view"
                : "Individual Submission view"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 opacity-50 transition-transform",
                viewMenuOpen && "rotate-180",
              )}
            />
          </button>
          {viewMenuOpen && (
            <div
              role="listbox"
              className={cn(
                "absolute right-0 z-20 mt-1 w-[240px] overflow-hidden rounded-lg border shadow-lg",
                isDark
                  ? "border-gray-700 bg-[#07031D] text-white"
                  : "border-slate-200 bg-white text-slate-900",
              )}
            >
              {(
                [
                  {
                    value: "normal",
                    label: "Individual Submission view",
                  },
                  {
                    value: "creators",
                    label: "Creator-wise view",
                  },
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
                    "flex w-full items-center px-3 py-2 text-left text-sm font-medium transition-colors",
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
          "w-full rounded-lg border",
          isDark ? "border-gray-600" : "border-slate-200",
        )}
      >
        {visible.length === 0 ? (
          emptyMessage
        ) : viewMode === "normal" ? (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {(pagedListItems as BulkVideoDownloadResultRow[]).map(
              (row, index) => (
                <li key={row.submissionId}>
                  <VideoResultRow
                    row={row}
                    isDark={isDark}
                    striped={index % 2 === 1}
                  />
                </li>
              ),
            )}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {(pagedListItems as CreatorGroup[]).map((group, index) => {
              const videoCount = group.videos.length;
              return (
                <li
                  key={group.key}
                  className={cn(
                    index % 2 === 1 &&
                      (isDark ? "bg-white/[0.03]" : "bg-slate-50/80"),
                  )}
                >
                  <div className="flex items-start justify-between gap-4 px-4 py-3.5">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
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
                      <div className="min-w-0 space-y-1.5">
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
                        <button
                          type="button"
                          onClick={() =>
                            setPage({ kind: "creator", groupKey: group.key })
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                            isDark
                              ? "bg-white/10 text-sky-300 hover:bg-white/15"
                              : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                          )}
                        >
                          View all ({videoCount})
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
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
              );
            })}
          </ul>
        )}
        {visible.length > 0 && (
          <ResultsPagination
            page={safeListPage}
            pageSize={pageSize}
            totalItems={listItems.length}
            isDark={isDark}
            onPageChange={setListPage}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>
    </div>
  );
}

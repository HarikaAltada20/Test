"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Monitor, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VIDEO_FILENAME_PATTERN,
  VIDEO_FILENAME_PATTERNS,
  VIDEO_FILENAME_PATTERN_LABELS,
  isVideoFilenamePattern,
  toBulkZipDownloadFilename,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";
import {
  DEFAULT_VIDEOS_PER_ZIP,
  MAX_BULK_VIDEO_DOWNLOADS,
  MIN_BULK_VIDEO_DOWNLOADS,
  parseVideosPerZip,
  readPendingBulkZipJob,
} from "@/lib/video-download-ui";
import { toast } from "@/hooks/use-toast";

function isValidVideosPerZipInput(raw: string): boolean {
  if (!raw.trim()) return false;
  const n = Number(raw);
  return (
    Number.isInteger(n) &&
    n >= MIN_BULK_VIDEO_DOWNLOADS &&
    n <= MAX_BULK_VIDEO_DOWNLOADS
  );
}

const DESKTOP_DOWNLOAD_ENABLED =
  process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_ENABLED === "true";
const CLOUD_FALLBACK_ENABLED =
  process.env.NEXT_PUBLIC_CLOUD_DOWNLOAD_FALLBACK_ENABLED !== "false";
const INSTALL_URL =
  process.env.NEXT_PUBLIC_GOC_DOWNLOADER_INSTALL_URL?.trim() || "";

type DownloadPath = "desktop" | "cloud";

async function downloadDesktopManifest(options: {
  submissionIds: string[];
  contestId?: string;
  namingPattern: VideoFilenamePattern;
  videosPerZip: number;
  zipFilename?: string;
}): Promise<void> {
  const response = await fetch("/api/admin/bulk-download/desktop-manifest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submissionIds: options.submissionIds,
      contestId: options.contestId,
      namingPattern: options.namingPattern,
      videosPerZip: options.videosPerZip,
      zipFilename: options.zipFilename,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(data.error || "Failed to create desktop download manifest");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || "download.gocdownload";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function BulkVideoDownloadDialog({
  open,
  onOpenChange,
  isDark,
  videoCount,
  zipFilenamePrefix,
  downloading = false,
  onConfirm,
  submissionIds,
  contestId,
  hasInstagramSelection = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  videoCount: number;
  zipFilenamePrefix: string;
  downloading?: boolean;
  onConfirm: (
    namingPattern: VideoFilenamePattern,
    videosPerZip: number,
  ) => void | Promise<void>;
  /** Ordered submission IDs for desktop manifest (same order as cloud). */
  submissionIds?: string[];
  contestId?: string;
  /** When true, desktop path is blocked — Instagram requires cloud. */
  hasInstagramSelection?: boolean;
}) {
  const [pattern, setPattern] = useState<VideoFilenamePattern>(
    DEFAULT_VIDEO_FILENAME_PATTERN,
  );
  const [videosPerZipInput, setVideosPerZipInput] = useState(
    String(DEFAULT_VIDEOS_PER_ZIP),
  );
  const [canResume, setCanResume] = useState(false);
  const [downloadPath, setDownloadPath] = useState<DownloadPath>(
    DESKTOP_DOWNLOAD_ENABLED && !hasInstagramSelection ? "desktop" : "cloud",
  );
  const [desktopBusy, setDesktopBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPattern(DEFAULT_VIDEO_FILENAME_PATTERN);
      setVideosPerZipInput(String(DEFAULT_VIDEOS_PER_ZIP));
      // In-memory pending only (same tab); reload resumes from Supabase.
      setCanResume(!!readPendingBulkZipJob());
      setDownloadPath(
        DESKTOP_DOWNLOAD_ENABLED && !hasInstagramSelection
          ? "desktop"
          : "cloud",
      );
      setDesktopBusy(false);
    }
  }, [open, hasInstagramSelection]);

  const selectedMeta = VIDEO_FILENAME_PATTERN_LABELS[pattern];
  const videosPerZipValid = isValidVideosPerZipInput(videosPerZipInput);
  const videosPerZip = videosPerZipValid
    ? parseVideosPerZip(videosPerZipInput)
    : DEFAULT_VIDEOS_PER_ZIP;
  const zipCount = Math.max(1, Math.ceil(videoCount / videosPerZip));

  const exampleZipName = useMemo(() => {
    const prefix =
      zipCount > 1
        ? `${zipFilenamePrefix}_part_1_of_${zipCount}`
        : zipFilenamePrefix;
    return toBulkZipDownloadFilename(prefix);
  }, [zipCount, zipFilenamePrefix]);

  const queueHint = useMemo(() => {
    if (!videosPerZipValid) {
      return `Enter ${MIN_BULK_VIDEO_DOWNLOADS}–${MAX_BULK_VIDEO_DOWNLOADS} videos per ZIP.`;
    }
    if (videoCount === 1) {
      return "1 selected video will download into a ZIP folder.";
    }
    if (zipCount > 1) {
      return `${videoCount} selected videos will download as ${zipCount} ZIP files of up to ${videosPerZip} videos each.`;
    }
    return `${videoCount} selected videos will download into one ZIP folder of up to ${videosPerZip} videos.`;
  }, [videoCount, videosPerZip, videosPerZipValid, zipCount]);

  const showDesktopPath = DESKTOP_DOWNLOAD_ENABLED;
  const resolvedIds = submissionIds || [];
  const canUseDesktop =
    showDesktopPath &&
    !hasInstagramSelection &&
    resolvedIds.length >= 2;

  const busy = downloading || desktopBusy;

  const openDesktopApp = () => {
    try {
      window.location.href = "goc-downloader://import";
    } catch {
      // ignore — user can still download the .gocdownload file
    }
  };

  const handleDesktopDownload = async () => {
    if (!canUseDesktop) return;
    setDesktopBusy(true);
    try {
      openDesktopApp();
      await downloadDesktopManifest({
        submissionIds: resolvedIds,
        contestId,
        namingPattern: pattern,
        videosPerZip,
        zipFilename: toBulkZipDownloadFilename(zipFilenamePrefix),
      });
      toast({
        title: "Manifest downloaded",
        description:
          "Open the .gocdownload file with Game of Creators Downloader (or use Open app).",
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Desktop download failed",
        description:
          error instanceof Error ? error.message : "Could not create manifest",
        variant: "destructive",
      });
    } finally {
      setDesktopBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      isdark={isDark}
    >
      <DialogContent className="sm:max-w-[520px] z-[70]">
        <DialogHeader>
          <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
            Download videos
          </DialogTitle>
          <DialogDescription
            className={cn(isDark ? "text-slate-400" : "text-slate-600")}
          >
            Choose how files are named inside the ZIP and how many videos go in
            each archive.
          </DialogDescription>
        </DialogHeader>

        {showDesktopPath && (
          <div
            className={cn(
              "rounded-lg border p-3 space-y-3",
              isDark
                ? "border-gray-600 bg-[#170337]/60"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <Label
              className={cn(
                "text-sm font-medium block",
                isDark ? "text-slate-100" : "text-slate-800",
              )}
            >
              Download method
            </Label>
            <RadioGroup
              value={
                hasInstagramSelection
                  ? "cloud"
                  : downloadPath
              }
              onValueChange={(value) => {
                if (value === "desktop" || value === "cloud") {
                  setDownloadPath(value);
                }
              }}
              className="space-y-1"
            >
              <div
                className={cn(
                  "flex items-start gap-3 rounded-md px-2 py-2",
                  isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
                  hasInstagramSelection && "opacity-50",
                )}
              >
                <RadioGroupItem
                  id="bulk-path-desktop"
                  value="desktop"
                  disabled={hasInstagramSelection}
                  className={cn(
                    "mt-0.5",
                    isDark && "border-gray-500 text-[#4A00BE]",
                  )}
                />
                <Label
                  htmlFor="bulk-path-desktop"
                  className={cn(
                    "flex-1 cursor-pointer space-y-0.5",
                    isDark ? "text-slate-200" : "text-slate-800",
                    hasInstagramSelection && "cursor-not-allowed",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Monitor className="h-3.5 w-3.5" />
                    Download on this computer
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded",
                        isDark
                          ? "bg-emerald-900/50 text-emerald-300"
                          : "bg-emerald-100 text-emerald-800",
                      )}
                    >
                      Recommended
                    </span>
                  </span>
                  <span
                    className={cn(
                      "block text-xs font-normal",
                      isDark ? "text-slate-400" : "text-slate-500",
                    )}
                  >
                    Faster local YouTube downloads via the desktop app. Opens a
                    signed .gocdownload manifest.
                  </span>
                </Label>
              </div>
              {CLOUD_FALLBACK_ENABLED && (
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2",
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
                  )}
                >
                  <RadioGroupItem
                    id="bulk-path-cloud"
                    value="cloud"
                    className={cn(
                      "mt-0.5",
                      isDark && "border-gray-500 text-[#4A00BE]",
                    )}
                  />
                  <Label
                    htmlFor="bulk-path-cloud"
                    className={cn(
                      "flex-1 cursor-pointer space-y-0.5",
                      isDark ? "text-slate-200" : "text-slate-800",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Cloud className="h-3.5 w-3.5" />
                      Cloud fallback
                    </span>
                    <span
                      className={cn(
                        "block text-xs font-normal",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      Server builds ZIP archives (supports Instagram + YouTube).
                    </span>
                  </Label>
                </div>
              )}
            </RadioGroup>
            {hasInstagramSelection && (
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-amber-300" : "text-amber-700",
                )}
              >
                Instagram selections require the cloud download path. Remove
                Instagram videos to use Download on this computer.
              </p>
            )}
            {INSTALL_URL && canUseDesktop && downloadPath === "desktop" && (
              <p
                className={cn(
                  "text-xs",
                  isDark ? "text-slate-400" : "text-slate-600",
                )}
              >
                Need the app?{" "}
                <a
                  href={INSTALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "underline",
                    isDark ? "text-purple-300" : "text-purple-700",
                  )}
                >
                  Install Game of Creators Downloader
                </a>
              </p>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-lg border p-3",
            isDark
              ? "border-gray-600 bg-[#170337]/60"
              : "border-slate-200 bg-slate-50",
          )}
        >
          <Label
            htmlFor="bulk-videos-per-zip"
            className={cn(
              "text-sm font-medium mb-2 block",
              isDark ? "text-slate-100" : "text-slate-800",
            )}
          >
           Videos per ZIP: Choose a maximum of up to {MAX_BULK_VIDEO_DOWNLOADS}
          </Label>
          <Input
            id="bulk-videos-per-zip"
            type="number"
            min={0}
            max={MAX_BULK_VIDEO_DOWNLOADS}
            step={1}
            inputMode="numeric"
            disabled={busy}
            value={videosPerZipInput}
            onChange={(event) => setVideosPerZipInput(event.target.value)}
            className={cn(
              "h-10",
              isDark
                ? "border-gray-600 bg-[#1a0a2e] text-white"
                : "bg-white",
            )}
          />
          <p
            className={cn(
              "mt-1.5 text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Each ZIP file will contain at most this many videos.
          </p>
        </div>

        <div
          className={cn(
            "rounded-lg border p-3",
            isDark
              ? "border-gray-600 bg-[#170337]/60"
              : "border-slate-200 bg-slate-50",
          )}
        >
          <Label
            className={cn(
              "text-sm font-medium mb-3 block",
              isDark ? "text-slate-100" : "text-slate-800",
            )}
          >
            File naming
          </Label>
          <RadioGroup
            value={pattern}
            onValueChange={(value) => {
              if (isVideoFilenamePattern(value)) setPattern(value);
            }}
            className="space-y-1"
          >
            {VIDEO_FILENAME_PATTERNS.map((option) => {
              const id = `bulk-video-name-${option}`;
              const meta = VIDEO_FILENAME_PATTERN_LABELS[option];
              return (
                <div
                  key={option}
                  className={cn(
                    "flex items-start gap-3 rounded-md px-2 py-2",
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
                  )}
                >
                  <RadioGroupItem
                    id={id}
                    value={option}
                    className={cn(
                      "mt-0.5",
                      isDark && "border-gray-500 text-[#4A00BE]",
                    )}
                  />
                  <Label
                    htmlFor={id}
                    className={cn(
                      "flex-1 cursor-pointer space-y-0.5",
                      isDark ? "text-slate-200" : "text-slate-800",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      {meta.label}
                    </span>
                    <span
                      className={cn(
                        "block text-xs font-normal",
                        isDark ? "text-slate-400" : "text-slate-500",
                      )}
                    >
                      {meta.description}
                    </span>
                    <span
                      className={cn(
                        "block text-xs font-mono font-normal truncate",
                        isDark ? "text-purple-300" : "text-purple-700",
                      )}
                    >
                      {meta.example}
                    </span>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <p
          className={cn(
            "text-xs",
            isDark ? "text-slate-400" : "text-slate-600",
          )}
        >
          {queueHint} Example file:{" "}
          <span className="font-mono">{selectedMeta.example}</span>
        </p>
        <p
          className={cn(
            "text-xs",
            isDark ? "text-slate-400" : "text-slate-600",
          )}
        >
          ZIP name:{" "}
          <span className="font-mono break-all">{exampleZipName}</span>
        </p>

        {canResume && !busy && downloadPath === "cloud" && (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-amber-300" : "text-amber-700",
            )}
          >
            A ZIP job is still running. Click Resume to continue without starting over.
          </p>
        )}

        <DialogFooter className="flex-row justify-end gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className={cn(
              isDark
                ? "border-gray-600 text-slate-200 hover:bg-white/5"
                : undefined,
            )}
          >
            Cancel
          </Button>
          {canUseDesktop && downloadPath === "desktop" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !videosPerZipValid}
                onClick={openDesktopApp}
                className={cn(
                  isDark
                    ? "border-gray-600 text-slate-200 hover:bg-white/5"
                    : undefined,
                )}
              >
                Open app
              </Button>
              <Button
                type="button"
                loading={desktopBusy}
                loadingText="Preparing..."
                disabled={busy || videoCount < 2 || !videosPerZipValid}
                onClick={() => {
                  void handleDesktopDownload();
                }}
                className="bg-purple-600 text-white hover:bg-purple-700"
              >
                <Monitor className="h-4 w-4 mr-1" />
                Download on this computer
              </Button>
            </>
          ) : (
            <Button
              type="button"
              loading={downloading}
              loadingText="Starting..."
              disabled={busy || videoCount < 2 || !videosPerZipValid}
              onClick={() => {
                void onConfirm(pattern, videosPerZip);
              }}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              <Download className="h-4 w-4 mr-1" />
              {canResume ? "Resume download" : "Download ZIP"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

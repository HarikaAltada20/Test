"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Download,
  Monitor,
  ExternalLink,
  FolderDown,
  CheckCircle2,
} from "lucide-react";
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
import {
  getDesktopDeepLinkImportUrl,
  getDesktopDownloaderInstallUrl,
  isDesktopDownloadEnabled,
} from "@/lib/goc-download/config";
import { toast } from "@/hooks/use-toast";
import { useBulkVideoDownloadProgress } from "@/components/BulkVideoDownloadProgressProvider";

function isValidVideosPerZipInput(raw: string): boolean {
  if (!raw.trim()) return false;
  const n = Number(raw);
  return (
    Number.isInteger(n) &&
    n >= MIN_BULK_VIDEO_DOWNLOADS &&
    n <= MAX_BULK_VIDEO_DOWNLOADS
  );
}

const DESKTOP_DOWNLOAD_ENABLED = isDesktopDownloadEnabled();
const INSTALL_URL = getDesktopDownloaderInstallUrl() || "";

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
    throw new Error(data.error || "Failed to create desktop download file");
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
  // Keep blob URL alive long enough for browsers that download asynchronously.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}

function openDesktopAppNonNavigating() {
  const url = getDesktopDeepLinkImportUrl();
  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      iframe.remove();
    }, 2000);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
}

function Section({
  isDark,
  children,
  className,
}: {
  isDark: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isDark
          ? "border-gray-600 bg-[#170337]/60"
          : "border-slate-200 bg-slate-50",
        className,
      )}
    >
      {children}
    </div>
  );
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
  youtubeSubmissionIds,
  instagramSubmissionIds,
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
    options?: { submissionIds?: string[] },
  ) => void | Promise<void>;
  /** Ordered submission IDs for the full selection (legacy fallback). */
  submissionIds?: string[];
  /** Ordered YouTube IDs for desktop (.gocdownload). */
  youtubeSubmissionIds?: string[];
  /** Ordered Instagram IDs for cloud ZIP. */
  instagramSubmissionIds?: string[];
  contestId?: string;
  /** When true and no explicit ID lists, treat selection as including Instagram. */
  hasInstagramSelection?: boolean;
}) {
  const { hydrateContestJobs } = useBulkVideoDownloadProgress();
  const [pattern, setPattern] = useState<VideoFilenamePattern>(
    DEFAULT_VIDEO_FILENAME_PATTERN,
  );
  const [videosPerZipInput, setVideosPerZipInput] = useState(
    String(DEFAULT_VIDEOS_PER_ZIP),
  );
  const [canResume, setCanResume] = useState(false);
  const [desktopBusy, setDesktopBusy] = useState(false);
  const [manifestReady, setManifestReady] = useState(false);

  const youtubeIds = useMemo(() => {
    if (Array.isArray(youtubeSubmissionIds)) return youtubeSubmissionIds;
    if (hasInstagramSelection) return [];
    return submissionIds || [];
  }, [youtubeSubmissionIds, hasInstagramSelection, submissionIds]);

  const instagramIds = useMemo(() => {
    if (Array.isArray(instagramSubmissionIds)) return instagramSubmissionIds;
    if (hasInstagramSelection) return submissionIds || [];
    return [];
  }, [instagramSubmissionIds, hasInstagramSelection, submissionIds]);

  const desktopEnabled = DESKTOP_DOWNLOAD_ENABLED;
  const useDesktopForYoutube = desktopEnabled && youtubeIds.length >= 1;
  const useCloudForInstagram = instagramIds.length >= 1;
  const isMixed = useDesktopForYoutube && useCloudForInstagram;
  const desktopOnly = useDesktopForYoutube && !useCloudForInstagram;
  const cloudOnly = useCloudForInstagram && !useDesktopForYoutube;

  // Legacy fallback when desktop is off: all selected IDs go cloud.
  const cloudIds =
    desktopEnabled && useCloudForInstagram
      ? instagramIds
      : !desktopEnabled
        ? submissionIds || [...youtubeIds, ...instagramIds]
        : instagramIds;

  useEffect(() => {
    if (open) {
      setPattern(DEFAULT_VIDEO_FILENAME_PATTERN);
      setVideosPerZipInput(String(DEFAULT_VIDEOS_PER_ZIP));
      setCanResume(!!readPendingBulkZipJob());
      setDesktopBusy(false);
      setManifestReady(false);
    }
  }, [open]);

  const selectedMeta = VIDEO_FILENAME_PATTERN_LABELS[pattern];
  const videosPerZipValid = isValidVideosPerZipInput(videosPerZipInput);
  const videosPerZip = videosPerZipValid
    ? parseVideosPerZip(videosPerZipInput)
    : DEFAULT_VIDEOS_PER_ZIP;

  const cloudCount = cloudIds.length;
  const desktopCount = useDesktopForYoutube ? youtubeIds.length : 0;
  const zipCount = Math.max(1, Math.ceil(Math.max(cloudCount, 1) / videosPerZip));

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
    if (isMixed) {
      return `${desktopCount} YouTube → desktop file · ${cloudCount} Instagram → server ZIP (up to ${videosPerZip} each).`;
    }
    if (desktopOnly) {
      return desktopCount === 1
        ? "1 YouTube video will download via the desktop app."
        : `${desktopCount} YouTube videos → signed .gocdownload file for the desktop app.`;
    }
    if (cloudCount === 1) {
      return "1 Instagram video will download into a ZIP folder.";
    }
    if (zipCount > 1) {
      return `${cloudCount} Instagram videos → ${zipCount} ZIP files (up to ${videosPerZip} each).`;
    }
    return `${cloudCount || videoCount} selected videos → one ZIP (up to ${videosPerZip} videos).`;
  }, [
    videoCount,
    videosPerZip,
    videosPerZipValid,
    zipCount,
    isMixed,
    desktopOnly,
    desktopCount,
    cloudCount,
  ]);

  const busy = downloading || desktopBusy;
  const hasWork =
    (useDesktopForYoutube && youtubeIds.length >= 1) ||
    cloudIds.length >= 1 ||
    (!desktopEnabled && videoCount >= 1);
  const primaryDisabled = busy || !hasWork || !videosPerZipValid;

  const handleDesktopDownload = async (ids: string[]) => {
    if (!ids.length) return;
    setDesktopBusy(true);
    try {
      await downloadDesktopManifest({
        submissionIds: ids,
        contestId,
        namingPattern: pattern,
        videosPerZip,
        zipFilename: toBulkZipDownloadFilename(zipFilenamePrefix),
      });
      setManifestReady(true);
      openDesktopAppNonNavigating();
      if (contestId) {
        void hydrateContestJobs(contestId).catch(() => undefined);
      }
      toast({
        title: "Download file ready",
        description:
          "Open the .gocdownload file with Game of Creators Downloader. Install the app first if you have not already.",
      });
    } catch (error) {
      toast({
        title: "Could not prepare download",
        description:
          error instanceof Error ? error.message : "Could not create file",
        variant: "destructive",
      });
      throw error;
    } finally {
      setDesktopBusy(false);
    }
  };

  const handlePrimary = async () => {
    if (isMixed) {
      setDesktopBusy(true);
      try {
        await handleDesktopDownload(youtubeIds);
        await onConfirm(pattern, videosPerZip, {
          submissionIds: cloudIds,
        });
      } catch {
        // Errors already toasted for desktop; cloud handler toasts separately.
      } finally {
        setDesktopBusy(false);
      }
      return;
    }
    if (desktopOnly) {
      void handleDesktopDownload(youtubeIds);
      return;
    }
    void onConfirm(pattern, videosPerZip, {
      submissionIds: cloudIds.length ? cloudIds : submissionIds,
    });
  };

  const title = isMixed
    ? "Download videos"
    : desktopOnly
      ? "Download YouTube videos"
      : cloudOnly || hasInstagramSelection
        ? "Download Instagram videos"
        : "Download videos";

  const description = isMixed
    ? "YouTube downloads run on your computer. Instagram downloads are prepared as server ZIP files."
    : desktopOnly
      ? "YouTube downloads run on your computer. Get a signed file, then open it in the desktop app."
      : cloudOnly || hasInstagramSelection
        ? "Instagram downloads are prepared on our servers and delivered as ZIP files."
        : "Choose how files are named inside the ZIP and how many videos go in each archive.";

  const primaryLabel = isMixed
    ? "Download both"
    : desktopOnly
      ? manifestReady
        ? "Download file again"
        : "Download file"
      : canResume
        ? "Resume download"
        : "Download ZIP";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      isdark={isDark}
    >
      <DialogContent className="sm:max-w-[520px] z-[70] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={cn(isDark ? "text-white" : "text-gray-900")}>
            {title}
          </DialogTitle>
          <DialogDescription
            className={cn(isDark ? "text-slate-400" : "text-slate-600")}
          >
            {description}
          </DialogDescription>
        </DialogHeader>

        {useDesktopForYoutube ? (
          <Section isDark={isDark}>
            <div className="flex items-start gap-2.5">
              <Monitor
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  isDark ? "text-emerald-300" : "text-emerald-700",
                )}
              />
              <div className="space-y-2 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isDark ? "text-slate-100" : "text-slate-800",
                  )}
                >
                  YouTube on this computer
                  {isMixed ? ` (${desktopCount})` : ""}
                </p>
                <ol
                  className={cn(
                    "text-xs space-y-1.5 list-decimal list-inside",
                    isDark ? "text-slate-400" : "text-slate-600",
                  )}
                >
                  <li>
                    {INSTALL_URL ? (
                      <>
                        Install{" "}
                        <a
                          href={INSTALL_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "underline font-medium",
                            isDark ? "text-purple-300" : "text-purple-700",
                          )}
                        >
                          Game of Creators Downloader
                        </a>{" "}
                        once (skip if already installed).
                      </>
                    ) : (
                      "Install Game of Creators Downloader once (skip if already installed)."
                    )}
                  </li>
                  <li>
                    Download a{" "}
                    <code className="text-[11px]">.gocdownload</code> file for
                    the YouTube videos.
                  </li>
                  <li>
                    Open that file with the app to download and ZIP locally.
                  </li>
                </ol>
                {INSTALL_URL && (
                  <a
                    href={INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium underline",
                      isDark ? "text-purple-300" : "text-purple-700",
                    )}
                  >
                    Get the desktop app
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {manifestReady && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs font-medium",
                      isDark ? "text-emerald-300" : "text-emerald-700",
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    File downloaded — open it with the app to continue.
                  </p>
                )}
              </div>
            </div>
          </Section>
        ) : null}

        {useCloudForInstagram || (!desktopEnabled && !useDesktopForYoutube) ? (
          <Section isDark={isDark}>
            <p
              className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-slate-600",
              )}
            >
              {isMixed
                ? `Instagram (${cloudCount}) uses server ZIP downloads.`
                : "Instagram downloads use server ZIP archives."}
            </p>
          </Section>
        ) : null}

        <Section isDark={isDark}>
          <Label
            htmlFor="bulk-videos-per-zip"
            className={cn(
              "text-sm font-medium block",
              isDark ? "text-slate-100" : "text-slate-800",
            )}
          >
            Videos per ZIP
            <span
              className={cn(
                "ml-1 font-normal",
                isDark ? "text-slate-400" : "text-slate-500",
              )}
            >
              (max {MAX_BULK_VIDEO_DOWNLOADS})
            </span>
          </Label>
          <Input
            id="bulk-videos-per-zip"
            type="number"
            min={MIN_BULK_VIDEO_DOWNLOADS}
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
              "text-xs",
              isDark ? "text-slate-400" : "text-slate-500",
            )}
          >
            Each ZIP will contain at most this many videos.
          </p>
        </Section>

        <Section isDark={isDark}>
          <Label
            className={cn(
              "text-sm font-medium block",
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
            className="space-y-0.5"
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
        </Section>

        <div className="space-y-1">
          <p
            className={cn(
              "text-xs",
              isDark ? "text-slate-400" : "text-slate-600",
            )}
          >
            {queueHint} Example:{" "}
            <span className="font-mono">{selectedMeta.example}</span>
          </p>
          {(useCloudForInstagram || !desktopEnabled) && (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-slate-400" : "text-slate-600",
              )}
            >
              ZIP name:{" "}
              <span className="font-mono break-all">{exampleZipName}</span>
            </p>
          )}
          {canResume && !busy && !desktopOnly && (
            <p
              className={cn(
                "text-xs",
                isDark ? "text-amber-300" : "text-amber-700",
              )}
            >
              A ZIP job is still running. Click Resume to continue without
              starting over.
            </p>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 flex-wrap sm:space-x-0">
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
            {manifestReady ? "Done" : "Cancel"}
          </Button>

          {useDesktopForYoutube ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={openDesktopAppNonNavigating}
              className={cn(
                isDark
                  ? "border-gray-600 text-slate-200 hover:bg-white/5"
                  : undefined,
              )}
            >
              Open app
            </Button>
          ) : null}

          <Button
            type="button"
            loading={busy}
            loadingText="Preparing…"
            disabled={primaryDisabled}
            onClick={() => {
              void handlePrimary();
            }}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            {desktopOnly || isMixed ? (
              <FolderDown className="h-4 w-4 mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            {primaryLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

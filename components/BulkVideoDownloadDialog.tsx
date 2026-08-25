"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
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

const PATTERN_STORAGE_KEY = "goc-bulk-video-naming-pattern";
const VIDEOS_PER_ZIP_STORAGE_KEY = "goc-bulk-videos-per-zip";

function readStoredPattern(): VideoFilenamePattern {
  if (typeof window === "undefined") return DEFAULT_VIDEO_FILENAME_PATTERN;
  try {
    return isVideoFilenamePattern(window.localStorage.getItem(PATTERN_STORAGE_KEY))
      ? (window.localStorage.getItem(PATTERN_STORAGE_KEY) as VideoFilenamePattern)
      : DEFAULT_VIDEO_FILENAME_PATTERN;
  } catch {
    return DEFAULT_VIDEO_FILENAME_PATTERN;
  }
}

function persistPattern(pattern: VideoFilenamePattern): void {
  try {
    window.localStorage.setItem(PATTERN_STORAGE_KEY, pattern);
  } catch {
    // ignore quota / private-mode failures
  }
}

function readStoredVideosPerZip(): number {
  if (typeof window === "undefined") return DEFAULT_VIDEOS_PER_ZIP;
  try {
    return parseVideosPerZip(
      window.localStorage.getItem(VIDEOS_PER_ZIP_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_VIDEOS_PER_ZIP;
  }
}

function persistVideosPerZip(videosPerZip: number): void {
  try {
    window.localStorage.setItem(
      VIDEOS_PER_ZIP_STORAGE_KEY,
      String(videosPerZip),
    );
  } catch {
    // ignore quota / private-mode failures
  }
}

function isValidVideosPerZipInput(raw: string): boolean {
  if (!raw.trim()) return false;
  const n = Number(raw);
  return (
    Number.isInteger(n) &&
    n >= MIN_BULK_VIDEO_DOWNLOADS &&
    n <= MAX_BULK_VIDEO_DOWNLOADS
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
}) {
  const [pattern, setPattern] = useState<VideoFilenamePattern>(
    DEFAULT_VIDEO_FILENAME_PATTERN,
  );
  const [videosPerZipInput, setVideosPerZipInput] = useState(
    String(DEFAULT_VIDEOS_PER_ZIP),
  );
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    if (open) {
      setPattern(readStoredPattern());
      setVideosPerZipInput(String(readStoredVideosPerZip()));
      setCanResume(!!readPendingBulkZipJob());
    }
  }, [open]);

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (downloading) return;
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
            Videos per ZIP (0–{MAX_BULK_VIDEO_DOWNLOADS})
          </Label>
          <Input
            id="bulk-videos-per-zip"
            type="number"
            min={0}
            max={MAX_BULK_VIDEO_DOWNLOADS}
            step={1}
            inputMode="numeric"
            disabled={downloading}
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

        {canResume && !downloading && (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-amber-300" : "text-amber-700",
            )}
          >
            A ZIP job is still running. Click Resume to continue without starting over.
          </p>
        )}

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={downloading}
            onClick={() => onOpenChange(false)}
            className={cn(
              isDark
                ? "border-gray-600 text-slate-200 hover:bg-white/5"
                : undefined,
            )}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={downloading}
            loadingText="Starting..."
            disabled={downloading || videoCount < 2 || !videosPerZipValid}
            onClick={() => {
              persistPattern(pattern);
              persistVideosPerZip(videosPerZip);
              void onConfirm(pattern, videosPerZip);
            }}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Download className="h-4 w-4 mr-1" />
            {canResume ? "Resume download" : "Download ZIP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

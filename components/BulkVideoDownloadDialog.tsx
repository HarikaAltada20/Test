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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VIDEO_FILENAME_PATTERN,
  VIDEO_FILENAME_PATTERNS,
  VIDEO_FILENAME_PATTERN_LABELS,
  isVideoFilenamePattern,
  type VideoFilenamePattern,
} from "@/lib/video-download-filename";
import { BulkVideoDownloadProgress } from "@/components/BulkVideoDownloadProgress";
import type { BulkVideoDownloadProgressState } from "@/components/BulkVideoDownloadProgress";

const STORAGE_KEY = "goc-bulk-video-naming-pattern";

function readStoredPattern(): VideoFilenamePattern {
  if (typeof window === "undefined") return DEFAULT_VIDEO_FILENAME_PATTERN;
  try {
    return isVideoFilenamePattern(window.localStorage.getItem(STORAGE_KEY))
      ? (window.localStorage.getItem(STORAGE_KEY) as VideoFilenamePattern)
      : DEFAULT_VIDEO_FILENAME_PATTERN;
  } catch {
    return DEFAULT_VIDEO_FILENAME_PATTERN;
  }
}

function persistPattern(pattern: VideoFilenamePattern): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pattern);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function BulkVideoDownloadDialog({
  open,
  onOpenChange,
  isDark,
  videoCount,
  downloading = false,
  progress = null,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  videoCount: number;
  downloading?: boolean;
  progress?: BulkVideoDownloadProgressState | null;
  onConfirm: (namingPattern: VideoFilenamePattern) => void | Promise<void>;
}) {
  const [pattern, setPattern] = useState<VideoFilenamePattern>(
    DEFAULT_VIDEO_FILENAME_PATTERN,
  );

  useEffect(() => {
    if (open) setPattern(readStoredPattern());
  }, [open]);

  const selectedMeta = VIDEO_FILENAME_PATTERN_LABELS[pattern];

  const queueHint = useMemo(() => {
    if (videoCount === 1) {
      return "1 selected video will download into a ZIP folder.";
    }
    return `${videoCount} selected videos will download into one ZIP folder.`;
  }, [videoCount]);

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
            Choose how files are named inside the ZIP. 
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
          {queueHint} Example with the current option:{" "}
          <span className="font-mono">{selectedMeta.example}</span>
        </p>

        {downloading && (
          <div
            className={cn(
              "rounded-lg border p-3",
              isDark
                ? "border-gray-600 bg-[#170337]/60"
                : "border-slate-200 bg-slate-50",
            )}
          >
            <p
              className={cn(
                "text-sm font-medium mb-2",
                isDark ? "text-slate-100" : "text-slate-800",
              )}
            >
              Download progress
            </p>
            <BulkVideoDownloadProgress
              successCount={progress?.successCount ?? 0}
              failedCount={progress?.failedCount ?? 0}
              total={progress?.total ?? videoCount}
              isDark={isDark}
            />
          </div>
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
            loadingText="Downloading..."
            disabled={downloading || videoCount < 2}
            onClick={() => {
              persistPattern(pattern);
              void onConfirm(pattern);
            }}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Download className="h-4 w-4 mr-1" />
            Download ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

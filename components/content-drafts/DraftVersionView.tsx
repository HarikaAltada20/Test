"use client";

import { cn } from "@/lib/utils";
import { formatBytes, formatDuration, type DraftVersion } from "@/lib/content-drafts";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";
import { DraftVideoPlayer } from "./media";

type Props = {
  versions: DraftVersion[];
  selectedId: string;
  onSelect: (id: string) => void;
  currentId: string | null;
  approvedId: string | null;
  purged: boolean;
  /** Label for the creator's note, e.g. "Your note". */
  noteLabel?: string;
};

/** Version tabs (v1, v2 …), the player and the selected version's details. */
export function DraftVersionView({
  versions,
  selectedId,
  onSelect,
  currentId,
  approvedId,
  purged,
  noteLabel = "Note from the creator",
}: Props) {
  const selected = versions.find((v) => v.id === selectedId) ?? versions[versions.length - 1];
  if (!selected) return null;

  return (
    <div className="space-y-4">
      {versions.length > 1 && (
        <div role="tablist" aria-label="Versions" className="flex flex-wrap gap-1.5">
          {versions.map((v) => {
            const active = v.id === selected.id;
            const label =
              v.id === approvedId ? "approved" : v.id === currentId ? "current" : null;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(v.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] dark:focus-visible:ring-white",
                  active
                    ? "border-[#0a0a0a] bg-[#0a0a0a] text-white dark:border-white dark:bg-white dark:text-[#0a0a0a]"
                    : "border-[#e5e5e5] text-[#404040] hover:bg-[#fafafa] dark:border-white/15 dark:text-neutral-200 dark:hover:bg-white/5",
                )}
              >
                v{v.version_no}
                {label && <span className={cn("ml-1", active ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>({label})</span>}
              </button>
            );
          })}
        </div>
      )}

      <DraftVideoPlayer versionId={selected.id} purged={purged} />

      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-semibold text-gray-900 dark:text-white">{selected.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            v{selected.version_no} ·{" "}
            {[formatDuration(selected.duration_sec), formatBytes(Number(selected.size_bytes))]
              .filter(Boolean)
              .join(" · ")}{" "}
            · <RelativeTime value={selected.created_at} prefix="Uploaded" />
          </p>
        </div>
        {selected.caption && (
          <p className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">{selected.caption}</p>
        )}
        {selected.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.hashtags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#404040] dark:bg-white/10 dark:text-neutral-200"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        {selected.creator_note && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-gray-700 dark:bg-white/5 dark:text-gray-200">
            <span className="font-medium">{noteLabel}:</span> {selected.creator_note}
          </p>
        )}
      </div>
    </div>
  );
}

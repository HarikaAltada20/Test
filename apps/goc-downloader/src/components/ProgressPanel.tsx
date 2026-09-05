import type { DownloadStage, ProgressEvent } from "../lib/types";

const STAGES: DownloadStage[] = [
  "validating",
  "extracting",
  "downloading",
  "merging",
  "verifying",
  "archiving",
];

function formatBytes(n?: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatSpeed(bps?: number): string {
  if (bps == null) return "—";
  return `${formatBytes(bps)}/s`;
}

function formatEta(seconds?: number): string {
  if (seconds == null || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function stageState(
  stage: DownloadStage,
  current?: DownloadStage,
): "done" | "current" | "todo" {
  if (!current) return "todo";
  if (current === "done") return "done";
  if (current === "error") return stage === current ? "current" : "todo";
  const ci = STAGES.indexOf(current);
  const si = STAGES.indexOf(stage);
  if (si < 0) return "todo";
  if (si < ci) return "done";
  if (si === ci) return "current";
  return "todo";
}

interface ProgressPanelProps {
  progress?: ProgressEvent | null;
  title?: string;
}

export function ProgressPanel({ progress, title = "Progress" }: ProgressPanelProps) {
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const current = progress?.stage;

  return (
    <section className="progress-panel" aria-label={title}>
      <div className="progress-stages" role="list" aria-label="Download stages">
        {STAGES.map((stage) => (
          <span
            key={stage}
            role="listitem"
            className="stage-chip"
            data-state={stageState(stage, current)}
          >
            {stage}
          </span>
        ))}
      </div>
      <div
        className="progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={title}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-meta">
        <span>Bytes: {formatBytes(progress?.bytesDownloaded)} / {formatBytes(progress?.bytesTotal)}</span>
        <span>Speed: {formatSpeed(progress?.speedBps)}</span>
        <span>ETA: {formatEta(progress?.etaSeconds)}</span>
        {progress?.message ? <span>{progress.message}</span> : null}
      </div>
    </section>
  );
}

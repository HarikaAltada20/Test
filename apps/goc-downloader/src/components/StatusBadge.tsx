import type { JobStatus } from "../lib/types";

const LABELS: Record<JobStatus, string> = {
  pending: "Pending",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  resumable: "Resumable",
};

function toneFor(status: JobStatus): string {
  switch (status) {
    case "running":
      return "badge-active";
    case "completed":
      return "badge-success";
    case "failed":
    case "cancelled":
      return "badge-error";
    case "paused":
    case "resumable":
      return "badge-warning";
    default:
      return "badge-idle";
  }
}

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`badge ${toneFor(status)}`} role="status">
      {LABELS[status]}
    </span>
  );
}

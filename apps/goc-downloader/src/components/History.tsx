import { useCallback, useEffect, useState } from "react";
import { cancelJob, listJobs, openPath } from "../lib/tauri";
import type { Job } from "../lib/types";
import { EmptyState } from "./EmptyState";
import { StatusBadge } from "./StatusBadge";

export function History() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await listJobs();
      setJobs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setJobs([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh(false);
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function onCancel(jobId: string) {
    try {
      await cancelJob(jobId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onOpen(dest: string) {
    try {
      await openPath(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading) {
    return <p className="hint">Loading history…</p>;
  }

  if (!jobs.length) {
    return (
      <EmptyState
        title="No jobs yet"
        description="Manual downloads and GoC imports will appear here."
        action={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Kind</th>
              <th scope="col">Status</th>
              <th scope="col">Items</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <code>{job.id.slice(0, 8)}</code>
                  {job.sourceLabel ? (
                    <div className="hint">{job.sourceLabel}</div>
                  ) : null}
                </td>
                <td>{job.kind}</td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td>
                  {job.completedCount}/{job.itemCount}
                  {job.failedCount > 0 ? ` (${job.failedCount} failed)` : ""}
                </td>
                <td>{new Date(job.updatedAt).toLocaleString()}</td>
                <td>
                  <div className="row">
                    {(job.status === "running" || job.status === "pending") && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => onCancel(job.id)}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onOpen(job.destination)}
                    >
                      Open folder
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

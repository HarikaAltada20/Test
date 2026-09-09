import { useCallback, useEffect, useState, type DragEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import {
  getSettings,
  importManifest,
  verifyManifestFile,
} from "../lib/tauri";
import type {
  AppSettings,
  ConflictPolicy,
  GocManifest,
  Job,
  ProgressEvent,
  QualityPreference,
} from "../lib/types";
import { EmptyState } from "./EmptyState";
import { ProgressPanel } from "./ProgressPanel";

export function GocImport({
  initialPath,
  onInitialPathConsumed,
}: {
  initialPath?: string | null;
  onInitialPathConsumed?: () => void;
} = {}) {
  const [path, setPath] = useState<string | null>(null);
  const [manifest, setManifest] = useState<GocManifest | null>(null);
  const [destination, setDestination] = useState("");
  const [quality, setQuality] = useState<QualityPreference>("best");
  const [conflict, setConflict] = useState<ConflictPolicy>("rename");
  const [createZip, setCreateZip] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    getSettings()
      .then((s: AppSettings) => {
        setDestination(s.destination);
        setQuality(s.defaultQuality);
        setConflict(s.conflict);
        setCreateZip(s.createZipByDefault);
      })
      .catch(() => undefined);
  }, []);

  const loadManifest = useCallback(async (filePath: string) => {
    setError(null);
    setJob(null);
    setProgress(null);
    setBusy(true);
    try {
      const verified = await verifyManifestFile(filePath);
      setPath(filePath);
      setManifest(verified);
    } catch (e) {
      setManifest(null);
      setPath(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!initialPath) return;
    void loadManifest(initialPath).finally(() => onInitialPathConsumed?.());
  }, [initialPath, loadManifest, onInitialPathConsumed]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<ProgressEvent>("download-progress", (event) => {
      if (!job || event.payload.jobId === job.id) {
        setProgress(event.payload);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, [job]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") {
          setDragActive(true);
        } else if (event.payload.type === "leave") {
          setDragActive(false);
        } else if (event.payload.type === "drop") {
          setDragActive(false);
          const paths = event.payload.paths || [];
          const match = paths.find((p) =>
            p.toLowerCase().endsWith(".gocdownload"),
          );
          if (match) void loadManifest(match);
          else setError("Only .gocdownload files are supported.");
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, [loadManifest]);

  async function pickFile() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "GoC Download", extensions: ["gocdownload"] }],
      });
      if (typeof selected === "string") await loadManifest(selected);
    } catch {
      setError("File picker is only available in the desktop app.");
    }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    setDragActive(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".gocdownload")) {
      setError("Only .gocdownload files are supported.");
      return;
    }
    const anyFile = file as File & { path?: string };
    if (anyFile.path) {
      await loadManifest(anyFile.path);
      return;
    }
    setError("Use Browse or drop the file onto the app window.");
  }

  async function pickDestination() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") setDestination(selected);
    } catch {
      setError("Folder picker is only available in the desktop app.");
    }
  }

  async function onDownload() {
    if (!path) return;
    if (!destination.trim()) {
      setError("Choose a destination folder.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await importManifest({
        manifestPath: path,
        destination: destination.trim(),
        quality,
        conflict,
        createZip,
      });
      setJob(created);
      setProgress({
        jobId: created.id,
        stage: "validating",
        percent: 0,
        message: "Job queued",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel stack">
      <div
        className="dropzone"
        data-active={dragActive}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="region"
        aria-label="Manifest drop zone"
      >
        <p>Drag and drop a .gocdownload file here</p>
        <div className="row" style={{ justifyContent: "center", marginTop: "0.75rem" }}>
          <button type="button" className="btn btn-secondary" onClick={pickFile} disabled={busy}>
            Browse…
          </button>
        </div>
      </div>

      {!manifest ? (
        <EmptyState
          title="No manifest loaded"
          description="Select a signed .gocdownload file to preview URLs before downloading."
        />
      ) : (
        <div className="manifest-preview stack">
          <h3>Manifest preview</h3>
          <p className="hint">
            Key: {manifest.signature.keyId} · Schema v{manifest.version} · Expires{" "}
            {new Date(manifest.context.expiresAt).toLocaleString()}
          </p>
          {manifest.context.contestId ? (
            <p className="hint">Contest: {manifest.context.contestId}</p>
          ) : null}
          <p className="hint">
            {manifest.items.length} video(s) · {manifest.archives.length} archive(s)
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Filename</th>
                  <th scope="col">URL</th>
                </tr>
              </thead>
              <tbody>
                {manifest.items.map((item) => (
                  <tr key={item.itemId}>
                    <td>
                      <code title={item.filename}>{item.filename}</code>
                    </td>
                    <td>
                      <code title={item.url}>
                        {item.url.length > 64
                          ? `${item.url.slice(0, 61)}…`
                          : item.url}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field">
            <label htmlFor="goc-dest">Destination</label>
            <div className="row">
              <input
                id="goc-dest"
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                style={{ flex: 1, minWidth: "12rem" }}
              />
              <button type="button" className="btn btn-secondary" onClick={pickDestination}>
                Browse
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="goc-quality">Quality</label>
            <select
              id="goc-quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityPreference)}
            >
              <option value="best">Best available (MP4)</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
              <option value="audio">Audio only</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="goc-conflict">If file exists</label>
            <select
              id="goc-conflict"
              value={conflict}
              onChange={(e) => setConflict(e.target.value as ConflictPolicy)}
            >
              <option value="rename">Rename</option>
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
            </select>
          </div>

          <label className="checkbox-row" htmlFor="goc-create-zip">
            <input
              id="goc-create-zip"
              type="checkbox"
              checked={createZip}
              onChange={(e) => setCreateZip(e.target.checked)}
            />
            Create ZIP archive when finished
          </label>

          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onDownload}
              disabled={busy}
            >
              {busy ? "Working…" : "Download from manifest"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {job ? (
        <p className="success-text">
          Import job {job.id.slice(0, 8)} started with {job.itemCount} items.
        </p>
      ) : null}
      {progress ? <ProgressPanel progress={progress} /> : null}
    </div>
  );
}

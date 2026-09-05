import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { startManualDownload, getSettings } from "../lib/tauri";
import type {
  AppSettings,
  ConflictPolicy,
  Job,
  ProgressEvent,
  QualityPreference,
} from "../lib/types";
import { ProgressPanel } from "./ProgressPanel";

function parseUrls(raw: string): string[] {
  return raw
    .split(/[\r\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function NewDownload() {
  const [url, setUrl] = useState("");
  const [bulk, setBulk] = useState("");
  const [destination, setDestination] = useState("");
  const [quality, setQuality] = useState<QualityPreference>("best");
  const [conflict, setConflict] = useState<ConflictPolicy>("rename");
  const [createZip, setCreateZip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    getSettings()
      .then((s: AppSettings) => {
        setDestination(s.destination);
        setQuality(s.defaultQuality);
        setConflict(s.conflict);
        setCreateZip(s.createZipByDefault);
      })
      .catch(() => {
        /* browser preview without Tauri */
      });
  }, []);

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

  async function pickFolder() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") setDestination(selected);
    } catch {
      setError("Folder picker is only available in the desktop app.");
    }
  }

  async function onImportTxt() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (typeof selected !== "string") return;
      const text = await fetch(`file://${selected}`).then((r) => r.text()).catch(() => null);
      if (text) {
        setBulk((prev) => (prev ? `${prev}\n${text}` : text));
        return;
      }
      setError("Could not read the selected text file. Paste URLs into the list field.");
    } catch {
      setError("File picker is only available in the desktop app.");
    }
  }

  async function onStart() {
    setError(null);
    const urls = [...parseUrls(url), ...parseUrls(bulk)];
    const unique = [...new Set(urls)];
    if (unique.length === 0) {
      setError("Add at least one YouTube URL.");
      return;
    }
    if (!destination.trim()) {
      setError("Choose a destination folder.");
      return;
    }
    setBusy(true);
    try {
      const created = await startManualDownload({
        urls: unique,
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
      <div className="field">
        <label htmlFor="single-url">YouTube URL</label>
        <input
          id="single-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label htmlFor="bulk-urls">URL list (one per line)</label>
        <textarea
          id="bulk-urls"
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
          placeholder="Paste multiple URLs or import a .txt file"
        />
        <div className="row">
          <button type="button" className="btn btn-secondary" onClick={onImportTxt}>
            Import .txt
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="quality">Quality</label>
        <select
          id="quality"
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
        <label htmlFor="destination">Destination</label>
        <div className="row">
          <input
            id="destination"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            style={{ flex: 1, minWidth: "12rem" }}
          />
          <button type="button" className="btn btn-secondary" onClick={pickFolder}>
            Browse
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="conflict">If file exists</label>
        <select
          id="conflict"
          value={conflict}
          onChange={(e) => setConflict(e.target.value as ConflictPolicy)}
        >
          <option value="rename">Rename</option>
          <option value="skip">Skip</option>
          <option value="overwrite">Overwrite</option>
        </select>
      </div>

      <label className="checkbox-row">
        <input
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
          onClick={onStart}
          disabled={busy}
        >
          {busy ? "Starting…" : "Start download"}
        </button>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {job ? (
        <p className="success-text">
          Job {job.id.slice(0, 8)} queued ({job.itemCount} item{job.itemCount === 1 ? "" : "s"}).
        </p>
      ) : null}
      {progress ? <ProgressPanel progress={progress} /> : null}
    </div>
  );
}

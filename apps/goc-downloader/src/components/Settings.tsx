import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getSettings, openPath, saveSettings } from "../lib/tauri";
import type { AppSettings, ConflictPolicy, QualityPreference } from "../lib/types";

const DEFAULTS: AppSettings = {
  destination: "",
  concurrency: 1,
  defaultQuality: "best",
  conflict: "rename",
  createZipByDefault: false,
  openFolderOnComplete: true,
};

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  async function pickDestination() {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") {
        setSettings((s) => ({ ...s, destination: selected }));
      }
    } catch {
      setError("Folder picker is only available in the desktop app.");
    }
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveSettings(settings);
      setSettings(saved);
      setMessage("Settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onOpenFolder() {
    if (!settings.destination) return;
    try {
      await openPath(settings.destination);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="panel stack">
      <div className="field">
        <label htmlFor="settings-dest">Default destination</label>
        <div className="row">
          <input
            id="settings-dest"
            type="text"
            value={settings.destination}
            onChange={(e) =>
              setSettings((s) => ({ ...s, destination: e.target.value }))
            }
            style={{ flex: 1, minWidth: "12rem" }}
          />
          <button type="button" className="btn btn-secondary" onClick={pickDestination}>
            Browse
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onOpenFolder}
            disabled={!settings.destination}
          >
            Open folder
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="concurrency">Concurrency (1–2)</label>
        <input
          id="concurrency"
          type="number"
          min={1}
          max={2}
          value={settings.concurrency}
          onChange={(e) => {
            const n = Number(e.target.value);
            const concurrency = n >= 2 ? 2 : 1;
            setSettings((s) => ({ ...s, concurrency }));
          }}
        />
        <span className="hint">Limited to two parallel downloads for stability.</span>
      </div>

      <div className="field">
        <label htmlFor="settings-quality">Default quality</label>
        <select
          id="settings-quality"
          value={settings.defaultQuality}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              defaultQuality: e.target.value as QualityPreference,
            }))
          }
        >
          <option value="best">Best available (MP4)</option>
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
          <option value="audio">Audio only</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="settings-conflict">Default conflict policy</label>
        <select
          id="settings-conflict"
          value={settings.conflict}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              conflict: e.target.value as ConflictPolicy,
            }))
          }
        >
          <option value="rename">Rename</option>
          <option value="skip">Skip</option>
          <option value="overwrite">Overwrite</option>
        </select>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.createZipByDefault}
          onChange={(e) =>
            setSettings((s) => ({ ...s, createZipByDefault: e.target.checked }))
          }
        />
        Create ZIP by default
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={settings.openFolderOnComplete}
          onChange={(e) =>
            setSettings((s) => ({
              ...s,
              openFolderOnComplete: e.target.checked,
            }))
          }
        />
        Open destination folder when a job completes
      </label>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>

      {message ? <p className="success-text" role="status">{message}</p> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
    </div>
  );
}

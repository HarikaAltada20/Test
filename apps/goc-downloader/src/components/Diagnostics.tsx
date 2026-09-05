import { useEffect, useState } from "react";
import { getDiagnostics, openPath } from "../lib/tauri";
import type { DiagnosticsInfo } from "../lib/types";
import { EmptyState } from "./EmptyState";

export function Diagnostics() {
  const [info, setInfo] = useState<DiagnosticsInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setInfo(await getDiagnostics());
    } catch (e) {
      setInfo(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) {
    return <p className="hint">Collecting diagnostics…</p>;
  }

  if (!info) {
    return (
      <EmptyState
        title="Diagnostics unavailable"
        description={error ?? "Could not read sidecar and log status."}
        action={
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="panel stack">
      <div className="row">
        <button type="button" className="btn btn-secondary" onClick={refresh}>
          Refresh
        </button>
        <span className="hint">App {info.appVersion}</span>
      </div>

      <div className="field">
        <label>Checksum status</label>
        <p>
          <span className={`badge ${info.checksumStatus === "ok" ? "badge-success" : info.checksumStatus === "mismatch" ? "badge-error" : "badge-idle"}`}>
            {info.checksumStatus}
          </span>
        </p>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Sidecar</th>
              <th scope="col">Present</th>
              <th scope="col">Version</th>
              <th scope="col">Checksum</th>
            </tr>
          </thead>
          <tbody>
            {info.sidecars.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.present ? "Yes" : "No"}</td>
                <td>{s.version ?? "—"}</td>
                <td>
                  {s.checksumOk == null
                    ? "—"
                    : s.checksumOk
                      ? "OK"
                      : "Mismatch"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="field">
        <label>Logs path</label>
        <div className="row">
          <code style={{ flex: 1 }}>{info.logsPath}</code>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => openPath(info.logsPath).catch((e) => setError(String(e)))}
          >
            Open
          </button>
        </div>
      </div>

      <div className="field">
        <label>Database path</label>
        <code>{info.dbPath}</code>
      </div>

      <div className="field">
        <label>Public keys path</label>
        <code>{info.publicKeysPath}</code>
      </div>

      {error ? <p className="error-text" role="alert">{error}</p> : null}
    </div>
  );
}

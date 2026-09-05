import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  DiagnosticsInfo,
  GocManifest,
  ImportManifestRequest,
  Job,
  ManualDownloadRequest,
} from "./types";

export async function startManualDownload(
  request: ManualDownloadRequest,
): Promise<Job> {
  return invoke<Job>("start_manual_download", { request });
}

export async function importManifest(
  request: ImportManifestRequest,
): Promise<Job> {
  return invoke<Job>("import_manifest", { request });
}

export async function verifyManifestFile(path: string): Promise<GocManifest> {
  return invoke<GocManifest>("verify_manifest_file", { path });
}

export async function cancelJob(jobId: string): Promise<void> {
  return invoke("cancel_job", { jobId });
}

export async function listJobs(): Promise<Job[]> {
  return invoke<Job[]>("list_jobs");
}

export async function getJob(jobId: string): Promise<Job> {
  return invoke<Job>("get_job", { jobId });
}

export async function openPath(path: string): Promise<void> {
  return invoke("open_path", { path });
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  return invoke<AppSettings>("save_settings", { settings });
}

export async function getDiagnostics(): Promise<DiagnosticsInfo> {
  return invoke<DiagnosticsInfo>("get_diagnostics");
}

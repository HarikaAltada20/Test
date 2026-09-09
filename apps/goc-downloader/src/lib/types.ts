export type JobStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "resumable";

export type DownloadStage =
  | "validating"
  | "extracting"
  | "downloading"
  | "merging"
  | "verifying"
  | "archiving"
  | "done"
  | "error";

export type QualityPreference = "best" | "1080p" | "720p" | "480p" | "audio";

export type ConflictPolicy = "skip" | "overwrite" | "rename";

export interface DownloadItem {
  id: string;
  jobId: string;
  url: string;
  title?: string;
  status: JobStatus;
  stage?: DownloadStage;
  outputPath?: string;
  bytesDownloaded?: number;
  bytesTotal?: number;
  speedBps?: number;
  etaSeconds?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  kind: "manual" | "manifest";
  status: JobStatus;
  destination: string;
  quality: QualityPreference;
  conflict: ConflictPolicy;
  createZip: boolean;
  sourceLabel?: string;
  itemCount: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  items?: DownloadItem[];
}

/** Named GocManifest to avoid clashing with the DOM `Manifest` interface. */
export interface GocManifestItem {
  itemId: string;
  submissionId?: string;
  url: string;
  filename: string;
  platform: "youtube";
}

export interface GocManifestArchive {
  archiveId: string;
  zipFilename: string;
  itemIds: string[];
}

export interface GocManifest {
  version: number;
  context: {
    jobId: string;
    contestId?: string;
    userId: string;
    namingPattern: string;
    createdAt: string;
    expiresAt: string;
  };
  archives: GocManifestArchive[];
  items: GocManifestItem[];
  callback: {
    statusUrl: string;
    statusToken: string;
  };
  signature: {
    keyId: string;
    algorithm: "Ed25519";
    value: string;
  };
}

export type Manifest = GocManifest;
export type ManifestItem = GocManifestItem;

export interface ProgressEvent {
  jobId: string;
  itemId?: string;
  stage: DownloadStage;
  percent?: number;
  bytesDownloaded?: number;
  bytesTotal?: number;
  speedBps?: number;
  etaSeconds?: number;
  message?: string;
}

export interface AppSettings {
  destination: string;
  concurrency: 1 | 2;
  defaultQuality: QualityPreference;
  conflict: ConflictPolicy;
  createZipByDefault: boolean;
  openFolderOnComplete: boolean;
}

export interface SidecarInfo {
  name: string;
  present: boolean;
  version?: string;
  path?: string;
  checksumOk?: boolean | null;
}

export interface DiagnosticsInfo {
  sidecars: SidecarInfo[];
  logsPath: string;
  dbPath: string;
  publicKeysPath: string;
  checksumStatus: "unknown" | "ok" | "mismatch" | "missing";
  appVersion: string;
}

export interface ManualDownloadRequest {
  urls: string[];
  destination: string;
  quality: QualityPreference;
  conflict: ConflictPolicy;
  createZip: boolean;
}

export interface ImportManifestRequest {
  manifestPath: string;
  destination: string;
  quality: QualityPreference;
  conflict: ConflictPolicy;
  createZip: boolean;
}

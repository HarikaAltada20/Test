use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("validation: {0}")]
    Validation(String),
    #[error("path safety: {0}")]
    PathSafety(String),
    #[error("url not allowed: {0}")]
    UrlNotAllowed(String),
    #[error("manifest: {0}")]
    Manifest(String),
    #[error("signature invalid")]
    SignatureInvalid,
    #[error("manifest expired")]
    ManifestExpired,
    #[error("database: {0}")]
    Database(String),
    #[error("download: {0}")]
    Download(String),
    #[error("archive: {0}")]
    Archive(String),
    #[error("settings: {0}")]
    Settings(String),
    #[error("io: {0}")]
    Io(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("cancelled")]
    Cancelled,
    #[error("internal: {0}")]
    Internal(String),
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        AppError::Io(value.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        AppError::Database(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        AppError::Internal(value.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum JobStatus {
    Pending,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
    Resumable,
}

impl JobStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            JobStatus::Pending => "pending",
            JobStatus::Running => "running",
            JobStatus::Paused => "paused",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
            JobStatus::Resumable => "resumable",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "running" => JobStatus::Running,
            "paused" => JobStatus::Paused,
            "completed" => JobStatus::Completed,
            "failed" => JobStatus::Failed,
            "cancelled" => JobStatus::Cancelled,
            "resumable" => JobStatus::Resumable,
            _ => JobStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DownloadStage {
    Validating,
    Extracting,
    Downloading,
    Merging,
    Verifying,
    Archiving,
    Done,
    Error,
}

impl DownloadStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            DownloadStage::Validating => "validating",
            DownloadStage::Extracting => "extracting",
            DownloadStage::Downloading => "downloading",
            DownloadStage::Merging => "merging",
            DownloadStage::Verifying => "verifying",
            DownloadStage::Archiving => "archiving",
            DownloadStage::Done => "done",
            DownloadStage::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum QualityPreference {
    Best,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "480p")]
    P480,
    Audio,
}

impl QualityPreference {
    pub fn as_str(&self) -> &'static str {
        match self {
            QualityPreference::Best => "best",
            QualityPreference::P1080 => "1080p",
            QualityPreference::P720 => "720p",
            QualityPreference::P480 => "480p",
            QualityPreference::Audio => "audio",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "1080p" => QualityPreference::P1080,
            "720p" => QualityPreference::P720,
            "480p" => QualityPreference::P480,
            "audio" => QualityPreference::Audio,
            _ => QualityPreference::Best,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConflictPolicy {
    Skip,
    Overwrite,
    Rename,
}

impl ConflictPolicy {
    pub fn as_str(&self) -> &'static str {
        match self {
            ConflictPolicy::Skip => "skip",
            ConflictPolicy::Overwrite => "overwrite",
            ConflictPolicy::Rename => "rename",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s {
            "skip" => ConflictPolicy::Skip,
            "overwrite" => ConflictPolicy::Overwrite,
            _ => ConflictPolicy::Rename,
        }
    }
}

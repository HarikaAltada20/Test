//! Metadata-only status callbacks to GoViral.
//! Auth: Bearer token from the signed manifest (`callback.statusToken`).
//! Never transmit media bytes.

use crate::error::{AppError, AppResult};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatusEvent {
    pub event_id: String,
    pub event_type: String,
    pub job_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub item_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub archive_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submission_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub occurred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub failed_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub zip_part_index: Option<u32>,
}

/// POST a metadata-only event. Rejects any attempt to attach media fields.
pub async fn post_desktop_status(
    status_url: &str,
    status_token: &str,
    event: DesktopStatusEvent,
) -> AppResult<()> {
    let body = serde_json::to_value(&event)?;
    if let serde_json::Value::Object(map) = &body {
        for forbidden in ["media", "bytes", "file", "contentBase64"] {
            if map.contains_key(forbidden) {
                return Err(AppError::Internal(
                    "refusing to send media on status callback".into(),
                ));
            }
        }
    }

    let client = reqwest::Client::new();
    let res = client
        .post(status_url)
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {status_token}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("status callback: {e}")))?;

    if !res.status().is_success() {
        return Err(AppError::Internal(format!(
            "status callback HTTP {}",
            res.status()
        )));
    }
    Ok(())
}

pub fn make_event(
    event_type: &str,
    job_id: &str,
    success_count: Option<u32>,
    failed_count: Option<u32>,
    total_count: Option<u32>,
) -> DesktopStatusEvent {
    DesktopStatusEvent {
        event_id: Uuid::new_v4().to_string(),
        event_type: event_type.to_string(),
        job_id: job_id.to_string(),
        item_id: None,
        archive_id: None,
        submission_id: None,
        error: None,
        occurred_at: chrono::Utc::now().to_rfc3339(),
        success_count,
        failed_count,
        total_count,
        zip_part_index: None,
    }
}

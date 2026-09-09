//! Metadata-only status callbacks to GoViral.
//! Auth: Bearer token from the signed manifest (`callback.statusToken`).
//! Never transmit media bytes.
//!
//! Delivery is durable via the SQLite outbox — local downloads never block on
//! callback availability.

use crate::db::Db;
use crate::error::{AppError, AppResult};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use uuid::Uuid;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_ATTEMPTS: u32 = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    event: &DesktopStatusEvent,
) -> AppResult<()> {
    let body = serde_json::to_value(event)?;
    if let serde_json::Value::Object(map) = &body {
        for forbidden in ["media", "bytes", "file", "contentBase64"] {
            if map.contains_key(forbidden) {
                return Err(AppError::Internal(
                    "refusing to send media on status callback".into(),
                ));
            }
        }
    }

    let client = reqwest::Client::builder()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|e| AppError::Internal(format!("status http client: {e}")))?;

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

pub fn make_item_event(
    event_type: &str,
    job_id: &str,
    item_id: &str,
    submission_id: Option<&str>,
    success_count: Option<u32>,
    failed_count: Option<u32>,
    total_count: Option<u32>,
    error: Option<&str>,
) -> DesktopStatusEvent {
    DesktopStatusEvent {
        event_id: Uuid::new_v4().to_string(),
        event_type: event_type.to_string(),
        job_id: job_id.to_string(),
        item_id: Some(item_id.to_string()),
        archive_id: None,
        submission_id: submission_id.map(|s| s.to_string()),
        error: error.map(|s| s.to_string()),
        occurred_at: chrono::Utc::now().to_rfc3339(),
        success_count,
        failed_count,
        total_count,
        zip_part_index: None,
    }
}

pub fn make_archive_event(
    job_id: &str,
    archive_id: &str,
    zip_part_index: u32,
    success_count: Option<u32>,
    failed_count: Option<u32>,
    total_count: Option<u32>,
) -> DesktopStatusEvent {
    DesktopStatusEvent {
        event_id: Uuid::new_v4().to_string(),
        event_type: "archive_completed".to_string(),
        job_id: job_id.to_string(),
        item_id: None,
        archive_id: Some(archive_id.to_string()),
        submission_id: None,
        error: None,
        occurred_at: chrono::Utc::now().to_rfc3339(),
        success_count,
        failed_count,
        total_count,
        zip_part_index: Some(zip_part_index),
    }
}

/// Enqueue a callback into the durable outbox and kick a background flush.
pub fn enqueue_status(
    db: &Mutex<Db>,
    status_url: &str,
    status_token: &str,
    event: &DesktopStatusEvent,
) -> AppResult<()> {
    let payload = serde_json::to_string(event)?;
    db.lock().enqueue_callback(
        &event.event_id,
        &event.job_id,
        status_url,
        status_token,
        &payload,
    )?;
    Ok(())
}

/// Flush pending outbox rows with exponential backoff. Safe to call concurrently.
pub async fn flush_outbox(db: Arc<Mutex<Db>>) {
    let pending = match db.lock().list_pending_callbacks(25) {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!("outbox list failed: {e}");
            return;
        }
    };

    for row in pending {
        if row.attempts >= MAX_ATTEMPTS {
            let _ = db.lock().mark_callback_dead(&row.id, "max attempts exceeded");
            continue;
        }
        let event: DesktopStatusEvent = match serde_json::from_str(&row.payload) {
            Ok(e) => e,
            Err(e) => {
                let _ = db
                    .lock()
                    .mark_callback_dead(&row.id, &format!("invalid payload: {e}"));
                continue;
            }
        };
        match post_desktop_status(&row.status_url, &row.status_token, &event).await {
            Ok(()) => {
                let _ = db.lock().mark_callback_sent(&row.id);
            }
            Err(e) => {
                let backoff_secs = 2u64.saturating_pow(row.attempts.min(6));
                let next = chrono::Utc::now() + chrono::Duration::seconds(backoff_secs as i64);
                let _ = db.lock().mark_callback_retry(
                    &row.id,
                    &e.to_string(),
                    next.to_rfc3339().as_str(),
                );
            }
        }
    }
}

/// Spawn a non-blocking flush (fire-and-forget).
pub fn spawn_flush(db: Arc<Mutex<Db>>) {
    tauri::async_runtime::spawn(async move {
        flush_outbox(db).await;
    });
}

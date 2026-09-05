use crate::db::{new_job_id, Db, DownloadItem, Job};
use crate::diagnostics::{collect_diagnostics, DiagnosticsInfo};
use crate::error::{
    AppError, AppResult, ConflictPolicy, JobStatus, QualityPreference,
};
use crate::manifest::Manifest;
use crate::settings::{load_settings, AppSettings};
use crate::urls::validate_youtube_url;
use chrono::Utc;
use parking_lot::Mutex;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub db: Mutex<Db>,
    pub app_data: PathBuf,
    pub cancel_flags: Mutex<std::collections::HashSet<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualDownloadRequest {
    pub urls: Vec<String>,
    pub destination: String,
    pub quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub create_zip: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportManifestRequest {
    pub manifest_path: String,
    pub destination: String,
    pub quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub create_zip: bool,
}

fn public_keys_path(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("resources").join("public_keys.json");
        if p.exists() {
            return p;
        }
        let p2 = dir.join("public_keys.json");
        if p2.exists() {
            return p2;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/public_keys.json")
}

fn sidecar_dir(app: &AppHandle) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("binaries");
        if p.exists() {
            return p;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries")
}

fn logs_dir(app_data: &std::path::Path) -> PathBuf {
    let p = app_data.join("logs");
    let _ = std::fs::create_dir_all(&p);
    p
}

#[tauri::command]
pub fn start_manual_download(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    request: ManualDownloadRequest,
) -> AppResult<Job> {
    if request.urls.is_empty() {
        return Err(AppError::Validation("no URLs provided".into()));
    }
    let mut validated = Vec::new();
    for url in &request.urls {
        validate_youtube_url(url)?;
        validated.push(url.trim().to_string());
    }

    let now = Utc::now();
    let job_id = new_job_id();
    let items: Vec<DownloadItem> = validated
        .iter()
        .map(|url| DownloadItem {
            id: new_job_id(),
            job_id: job_id.clone(),
            url: url.clone(),
            title: None,
            status: JobStatus::Pending,
            stage: None,
            output_path: None,
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            error: None,
            created_at: now,
            updated_at: now,
        })
        .collect();

    let job = Job {
        id: job_id,
        kind: "manual".into(),
        status: JobStatus::Pending,
        destination: request.destination.clone(),
        quality: request.quality.clone(),
        conflict: request.conflict.clone(),
        create_zip: request.create_zip,
        source_label: Some(format!("{} URL(s)", items.len())),
        item_count: items.len() as u32,
        completed_count: 0,
        failed_count: 0,
        created_at: now,
        updated_at: now,
        items: Some(items.clone()),
    };

    state.db.lock().insert_job(&job, &items)?;

    let state_clone = Arc::clone(&state);
    let job_clone = job.clone();
    let items_clone = items;
    tauri::async_runtime::spawn(async move {
        run_job(app, state_clone, job_clone, items_clone).await;
    });

    Ok(job)
}

#[tauri::command]
pub fn import_manifest(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    request: ImportManifestRequest,
) -> AppResult<Job> {
    let keys = public_keys_path(&app);
    let manifest_path = request.manifest_path.clone();
    let manifest =
        crate::manifest::verify_manifest_file(std::path::Path::new(&manifest_path), &keys)?;

    let now = Utc::now();
    let job_id = manifest.context.job_id.clone();
    let items: Vec<DownloadItem> = manifest
        .items
        .iter()
        .map(|m| DownloadItem {
            id: m.item_id.clone(),
            job_id: job_id.clone(),
            url: m.url.clone(),
            title: Some(m.filename.clone()),
            status: JobStatus::Pending,
            stage: None,
            output_path: None,
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            error: None,
            created_at: now,
            updated_at: now,
        })
        .collect();

    let source_label = manifest
        .context
        .contest_id
        .clone()
        .or_else(|| Some(format!("job {job_id}")));

    let job = Job {
        id: job_id,
        kind: "manifest".into(),
        status: JobStatus::Pending,
        destination: request.destination,
        quality: request.quality,
        conflict: request.conflict,
        create_zip: request.create_zip,
        source_label,
        item_count: items.len() as u32,
        completed_count: 0,
        failed_count: 0,
        created_at: now,
        updated_at: now,
        items: Some(items.clone()),
    };

    state.db.lock().insert_job(&job, &items)?;

    let callback_url = manifest.callback.status_url.clone();
    let callback_token = manifest.callback.status_token.clone();
    let state_clone = Arc::clone(&state);
    let job_clone = job.clone();
    tauri::async_runtime::spawn(async move {
        let _ = crate::status_callback::post_desktop_status(
            &callback_url,
            &callback_token,
            crate::status_callback::make_event(
                "accepted",
                &job_clone.id,
                None,
                None,
                Some(job_clone.item_count),
            ),
        )
        .await;
        let _ = crate::status_callback::post_desktop_status(
            &callback_url,
            &callback_token,
            crate::status_callback::make_event(
                "started",
                &job_clone.id,
                None,
                None,
                Some(job_clone.item_count),
            ),
        )
        .await;

        let result = run_job(app, state_clone, job_clone.clone(), items).await;
        let event_type = if result.failed > 0 && result.completed == 0 {
            "job_failed"
        } else {
            "job_completed"
        };
        let _ = crate::status_callback::post_desktop_status(
            &callback_url,
            &callback_token,
            crate::status_callback::make_event(
                event_type,
                &job_clone.id,
                Some(result.completed),
                Some(result.failed),
                Some(job_clone.item_count),
            ),
        )
        .await;
    });

    Ok(job)
}

struct JobRunResult {
    completed: u32,
    failed: u32,
}

async fn run_job(
    app: AppHandle,
    state: Arc<AppState>,
    job: Job,
    items: Vec<DownloadItem>,
) -> JobRunResult {
    let _ = state.db.lock().update_job_status(&job.id, JobStatus::Running);
    let sidecar = sidecar_dir(&app);
    let mut completed_paths = Vec::new();
    let mut completed = 0u32;
    let mut failed = 0u32;
    let concurrency = load_settings(&state.app_data)
        .map(|s| s.concurrency.clamp(1, 2) as usize)
        .unwrap_or(1);

    let mut idx = 0;
    while idx < items.len() {
        if state.cancel_flags.lock().contains(&job.id) {
            let _ = state
                .db
                .lock()
                .update_job_status(&job.id, JobStatus::Cancelled);
            return JobRunResult { completed, failed };
        }
        let end = (idx + concurrency).min(items.len());
        let chunk: Vec<_> = items[idx..end].to_vec();
        let mut handles = Vec::new();
        for item in chunk {
            let app2 = app.clone();
            let sidecar2 = sidecar.clone();
            let dest = PathBuf::from(&job.destination);
            let quality = job.quality.clone();
            let conflict = job.conflict.clone();
            let job_id = job.id.clone();
            let exact_filename = if job.kind == "manifest" {
                item.title.clone()
            } else {
                None
            };
            let item_id = item.id.clone();
            handles.push((
                item_id.clone(),
                tokio::spawn(async move {
                    crate::downloader::download_one(
                        &app2,
                        &sidecar2,
                        crate::downloader::DownloadRequest {
                            url: item.url,
                            destination: dest,
                            quality,
                            conflict,
                            job_id,
                            item_id,
                            exact_filename,
                        },
                    )
                    .await
                }),
            ));
        }
        for (item_id, handle) in handles {
            match handle.await {
                Ok(Ok(path)) => {
                    completed += 1;
                    if let Err(error) = state.db.lock().finish_item(
                        &job.id,
                        &item_id,
                        JobStatus::Completed,
                        Some(&path),
                        None,
                    ) {
                        tracing::error!("failed to persist completed item {item_id}: {error}");
                    }
                    completed_paths.push(path);
                }
                Ok(Err(e)) => {
                    failed += 1;
                    tracing::error!("item failed: {e}");
                    let message = e.to_string();
                    if let Err(error) = state.db.lock().finish_item(
                        &job.id,
                        &item_id,
                        JobStatus::Failed,
                        None,
                        Some(&message),
                    ) {
                        tracing::error!("failed to persist failed item {item_id}: {error}");
                    }
                }
                Err(e) => {
                    failed += 1;
                    tracing::error!("task join failed: {e}");
                    let message = format!("download task failed: {e}");
                    if let Err(error) = state.db.lock().finish_item(
                        &job.id,
                        &item_id,
                        JobStatus::Failed,
                        None,
                        Some(&message),
                    ) {
                        tracing::error!("failed to persist failed item {item_id}: {error}");
                    }
                }
            }
        }
        idx = end;
    }

    if job.create_zip && !completed_paths.is_empty() {
        crate::progress::emit_progress(
            &app,
            crate::progress::ProgressEvent {
                job_id: job.id.clone(),
                item_id: None,
                stage: crate::error::DownloadStage::Archiving,
                percent: Some(98.0),
                bytes_downloaded: None,
                bytes_total: None,
                speed_bps: None,
                eta_seconds: None,
                message: Some("Creating ZIP".into()),
            },
        );
        let zip_name = format!("goc-{}.zip", &job.id[..8.min(job.id.len())]);
        if let Err(e) = crate::archive::create_zip(
            PathBuf::from(&job.destination).as_path(),
            &zip_name,
            &completed_paths,
        ) {
            tracing::warn!("archive failed: {e}");
        }
    }

    let status = if failed > 0 && completed == 0 {
        JobStatus::Failed
    } else {
        JobStatus::Completed
    };
    let _ = state.db.lock().update_job_status(&job.id, status);

    if let Ok(settings) = load_settings(&state.app_data) {
        if settings.open_folder_on_complete {
            let _ = open_path_impl(job.destination.clone());
        }
    }

    JobRunResult { completed, failed }
}

#[tauri::command]
pub fn cancel_job(state: State<'_, Arc<AppState>>, job_id: String) -> AppResult<()> {
    state.cancel_flags.lock().insert(job_id.clone());
    state
        .db
        .lock()
        .update_job_status(&job_id, JobStatus::Cancelled)?;
    Ok(())
}

#[tauri::command]
pub fn list_jobs(state: State<'_, Arc<AppState>>) -> AppResult<Vec<Job>> {
    state.db.lock().list_jobs()
}

#[tauri::command]
pub fn get_job(state: State<'_, Arc<AppState>>, job_id: String) -> AppResult<Job> {
    state.db.lock().get_job(&job_id)
}

#[tauri::command]
pub fn open_path(path: String) -> AppResult<()> {
    open_path_impl(path)
}

fn open_path_impl(path: String) -> AppResult<()> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(AppError::NotFound(path));
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::Io(e.to_string()))?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings(state: State<'_, Arc<AppState>>) -> AppResult<AppSettings> {
    load_settings(&state.app_data)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, Arc<AppState>>,
    settings: AppSettings,
) -> AppResult<AppSettings> {
    crate::settings::save_settings(&state.app_data, &settings)
}

#[tauri::command]
pub fn get_diagnostics(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> AppResult<DiagnosticsInfo> {
    let sidecar = sidecar_dir(&app);
    let logs = logs_dir(&state.app_data);
    let keys = public_keys_path(&app);
    let checksums = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../scripts/sidecar-checksums.json");
    let db_path = state.db.lock().path().to_path_buf();
    collect_diagnostics(&sidecar, &logs, &db_path, &keys, Some(&checksums))
}

#[tauri::command]
pub fn verify_manifest_file(app: AppHandle, path: String) -> AppResult<Manifest> {
    let keys = public_keys_path(&app);
    crate::manifest::verify_manifest_file(std::path::Path::new(&path), &keys)
}

use crate::db::{new_job_id, Db, DownloadItem, Job};
use crate::diagnostics::{collect_diagnostics, DiagnosticsInfo};
use crate::error::{AppError, AppResult, ConflictPolicy, JobStatus, QualityPreference};
use crate::manifest::{Manifest, ManifestArchive};
use crate::settings::{load_settings, AppSettings};
use crate::urls::validate_youtube_url;
use chrono::Utc;
use parking_lot::Mutex;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Mutex as AsyncMutex;

pub struct AppState {
    pub db: Mutex<Db>,
    pub app_data: PathBuf,
    pub cancel_flags: Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
    pub active_children: Arc<AsyncMutex<Vec<u32>>>,
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

const MAX_MANIFEST_BYTES: u64 = 2 * 1024 * 1024;

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

/// Resolve sidecars next to the executable (Tauri externalBin) then resource/binaries.
pub fn sidecar_dir(app: &AppHandle) -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.to_path_buf();
            let probe = candidate.join(if cfg!(windows) {
                "yt-dlp.exe"
            } else {
                "yt-dlp"
            });
            let probe_target = candidate.join("yt-dlp-x86_64-pc-windows-msvc.exe");
            if probe.exists() || probe_target.exists() {
                return candidate;
            }
            let binaries = candidate.join("binaries");
            if binaries.exists() {
                return binaries;
            }
        }
    }
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join("binaries");
        if p.exists() {
            return p;
        }
        if dir.exists() {
            return dir;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries")
}

fn logs_dir(app_data: &std::path::Path) -> PathBuf {
    let p = app_data.join("logs");
    let _ = std::fs::create_dir_all(&p);
    p
}

fn cancel_flag_for(state: &AppState, job_id: &str) -> Arc<AtomicBool> {
    let mut map = state.cancel_flags.lock();
    map.entry(job_id.to_string())
        .or_insert_with(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

fn enqueue_callback_flush(
    state: &Arc<AppState>,
    status_url: &str,
    status_token: &str,
    event: &crate::status_callback::DesktopStatusEvent,
) {
    if let Err(e) =
        crate::status_callback::enqueue_status(&state.db, status_url, status_token, event)
    {
        tracing::warn!("failed to enqueue status callback: {e}");
        return;
    }
    let db = state_db_arc(state);
    crate::status_callback::spawn_flush(db);
}

/// Share the Db mutex with the outbox flusher without moving ownership.
fn state_db_arc(state: &Arc<AppState>) -> Arc<Mutex<Db>> {
    let path = state.db.lock().path().to_path_buf();
    match Db::open(&path) {
        Ok(db) => Arc::new(Mutex::new(db)),
        Err(e) => {
            tracing::error!("failed to reopen db for outbox flush: {e}");
            let tmp = std::env::temp_dir().join("goc-outbox-fallback.db");
            Arc::new(Mutex::new(
                Db::open(tmp).expect("fallback db"),
            ))
        }
    }
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
    if request.urls.len() > 100 {
        return Err(AppError::Validation(
            "manual downloads are limited to 100 URLs".into(),
        ));
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
        callback_url: None,
        callback_token: None,
        archives_json: None,
        submission_map_json: None,
    };

    state.db.lock().insert_job(&job, &items)?;
    let _ = cancel_flag_for(&state, &job.id);

    let state_clone = Arc::clone(&state);
    let job_clone = job.clone();
    let items_clone = items;
    tauri::async_runtime::spawn(async move {
        run_job(app, state_clone, job_clone, items_clone, None).await;
    });

    Ok(job)
}

#[tauri::command]
pub fn import_manifest(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    request: ImportManifestRequest,
) -> AppResult<Job> {
    let path = std::path::Path::new(&request.manifest_path);
    let meta = std::fs::metadata(path).map_err(|e| AppError::Manifest(e.to_string()))?;
    if meta.len() > MAX_MANIFEST_BYTES {
        return Err(AppError::Manifest(format!(
            "manifest exceeds {} byte limit",
            MAX_MANIFEST_BYTES
        )));
    }

    let keys = public_keys_path(&app);
    let manifest = crate::manifest::verify_manifest_file(path, &keys)?;

    // Reject release builds trusting only the placeholder/dev key when keyId is unknown
    // is already handled by verify; additionally reject empty archives.
    if manifest.archives.is_empty() {
        return Err(AppError::Manifest("manifest has no archives".into()));
    }

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

    let submission_map: HashMap<String, String> = manifest
        .items
        .iter()
        .filter_map(|m| {
            m.submission_id
                .as_ref()
                .map(|s| (m.item_id.clone(), s.clone()))
        })
        .collect();
    let archives_json = serde_json::to_string(&manifest.archives)?;
    let submission_map_json = serde_json::to_string(&submission_map)?;

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
        callback_url: Some(manifest.callback.status_url.clone()),
        callback_token: Some(manifest.callback.status_token.clone()),
        archives_json: Some(archives_json),
        submission_map_json: Some(submission_map_json),
    };

    state.db.lock().insert_job(&job, &items)?;
    let _ = cancel_flag_for(&state, &job.id);

    let callback_url = manifest.callback.status_url.clone();
    let callback_token = manifest.callback.status_token.clone();
    let state_clone = Arc::clone(&state);
    let job_clone = job.clone();
    tauri::async_runtime::spawn(async move {
        // Enqueue accepted/started without blocking downloads.
        let accepted = crate::status_callback::make_event(
            "accepted",
            &job_clone.id,
            None,
            None,
            Some(job_clone.item_count),
        );
        enqueue_callback_flush(&state_clone, &callback_url, &callback_token, &accepted);
        let started = crate::status_callback::make_event(
            "started",
            &job_clone.id,
            None,
            None,
            Some(job_clone.item_count),
        );
        enqueue_callback_flush(&state_clone, &callback_url, &callback_token, &started);

        let result = run_job(
            app,
            state_clone.clone(),
            job_clone.clone(),
            items,
            Some((callback_url.clone(), callback_token.clone())),
        )
        .await;
        let event_type = if result.failed > 0 && result.completed == 0 {
            "job_failed"
        } else {
            "job_completed"
        };
        let terminal = crate::status_callback::make_event(
            event_type,
            &job_clone.id,
            Some(result.completed),
            Some(result.failed),
            Some(job_clone.item_count),
        );
        enqueue_callback_flush(&state_clone, &callback_url, &callback_token, &terminal);
    });

    Ok(job)
}

#[tauri::command]
pub fn resume_job(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    job_id: String,
) -> AppResult<Job> {
    let job = state.db.lock().get_job(&job_id)?;
    if !matches!(
        job.status,
        JobStatus::Resumable | JobStatus::Cancelled | JobStatus::Pending
    ) {
        return Err(AppError::Validation(format!(
            "job {} cannot be resumed from status {:?}",
            job_id,
            job.status.as_str()
        )));
    }
    let pending = state.db.lock().pending_items_for_job(&job_id)?;
    if pending.is_empty() {
        return Err(AppError::Validation("no pending items to resume".into()));
    }
    // Clear prior cancel flag.
    {
        let flag = cancel_flag_for(&state, &job_id);
        flag.store(false, Ordering::SeqCst);
    }
    state
        .db
        .lock()
        .update_job_status(&job_id, JobStatus::Pending)?;

    let callback = match (job.callback_url.clone(), job.callback_token.clone()) {
        (Some(u), Some(t)) => Some((u, t)),
        _ => None,
    };
    let state_clone = Arc::clone(&state);
    let job_clone = job.clone();
    let pending_clone = pending;
    tauri::async_runtime::spawn(async move {
        let result = run_job(
            app,
            state_clone.clone(),
            job_clone.clone(),
            pending_clone,
            callback.clone(),
        )
        .await;
        if let Some((url, token)) = callback {
            let event_type = if result.failed > 0 && result.completed == 0 {
                "job_failed"
            } else {
                "job_completed"
            };
            let terminal = crate::status_callback::make_event(
                event_type,
                &job_clone.id,
                Some(result.completed),
                Some(result.failed),
                Some(job_clone.item_count),
            );
            enqueue_callback_flush(&state_clone, &url, &token, &terminal);
        }
    });
    state.db.lock().get_job(&job_id)
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
    callback: Option<(String, String)>,
) -> JobRunResult {
    let _ = state.db.lock().update_job_status(&job.id, JobStatus::Running);
    let sidecar = sidecar_dir(&app);
    let cancel = cancel_flag_for(&state, &job.id);
    cancel.store(false, Ordering::SeqCst);

    let submission_map: HashMap<String, String> = job
        .submission_map_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let archives: Vec<ManifestArchive> = job
        .archives_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let mut completed_by_id: HashMap<String, PathBuf> = HashMap::new();
    let mut completed = 0u32;
    let mut failed = 0u32;
    let concurrency = load_settings(&state.app_data)
        .map(|s| s.concurrency.clamp(1, 2) as usize)
        .unwrap_or(1);

    let mut idx = 0;
    while idx < items.len() {
        if cancel.load(Ordering::SeqCst) {
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
            let cancel2 = Arc::clone(&cancel);
            let children = Arc::clone(&state.active_children);
            handles.push((
                item_id.clone(),
                item.url.clone(),
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
                            cancel: cancel2,
                        },
                        children,
                    )
                    .await
                }),
            ));
        }
        for (item_id, _url, handle) in handles {
            match handle.await {
                Ok(Ok(path)) => {
                    completed += 1;
                    completed_by_id.insert(item_id.clone(), path.clone());
                    if let Err(error) = state.db.lock().finish_item(
                        &job.id,
                        &item_id,
                        JobStatus::Completed,
                        Some(&path),
                        None,
                    ) {
                        tracing::error!("failed to persist completed item {item_id}: {error}");
                    }
                    if let Some((url, token)) = &callback {
                        let event = crate::status_callback::make_item_event(
                            "item_completed",
                            &job.id,
                            &item_id,
                            submission_map.get(&item_id).map(|s| s.as_str()),
                            Some(completed),
                            Some(failed),
                            Some(job.item_count),
                            None,
                        );
                        enqueue_callback_flush(&state, url, token, &event);
                    }
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
                    if let Some((url, token)) = &callback {
                        let event = crate::status_callback::make_item_event(
                            "item_failed",
                            &job.id,
                            &item_id,
                            submission_map.get(&item_id).map(|s| s.as_str()),
                            Some(completed),
                            Some(failed),
                            Some(job.item_count),
                            Some(&message),
                        );
                        enqueue_callback_flush(&state, url, token, &event);
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

    let mut archive_failed = false;
    if job.create_zip || job.kind == "manifest" {
        if !archives.is_empty() {
            for (index, archive) in archives.iter().enumerate() {
                let paths: Vec<PathBuf> = archive
                    .item_ids
                    .iter()
                    .filter_map(|id| completed_by_id.get(id).cloned())
                    .collect();
                if paths.is_empty() {
                    continue;
                }
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
                        message: Some(format!("Creating {}", archive.zip_filename)),
                    },
                );
                match crate::archive::create_zip(
                    PathBuf::from(&job.destination).as_path(),
                    &archive.zip_filename,
                    &paths,
                ) {
                    Ok(result) if result.failed.is_empty() => {
                        if let Some((url, token)) = &callback {
                            let event = crate::status_callback::make_archive_event(
                                &job.id,
                                &archive.archive_id,
                                (index + 1) as u32,
                                Some(completed),
                                Some(failed),
                                Some(job.item_count),
                            );
                            enqueue_callback_flush(&state, url, token, &event);
                        }
                    }
                    Ok(result) => {
                        archive_failed = true;
                        tracing::warn!(
                            "archive {} partial failure: {} files",
                            archive.zip_filename,
                            result.failed.len()
                        );
                    }
                    Err(e) => {
                        archive_failed = true;
                        tracing::warn!("archive {} failed: {e}", archive.zip_filename);
                    }
                }
            }
        } else if job.create_zip && !completed_by_id.is_empty() {
            let zip_name = format!("goc-{}.zip", &job.id[..8.min(job.id.len())]);
            let paths: Vec<PathBuf> = completed_by_id.values().cloned().collect();
            if let Err(e) = crate::archive::create_zip(
                PathBuf::from(&job.destination).as_path(),
                &zip_name,
                &paths,
            ) {
                archive_failed = true;
                tracing::warn!("archive failed: {e}");
            }
        }
    }

    let status = if cancel.load(Ordering::SeqCst) {
        JobStatus::Cancelled
    } else if (failed > 0 && completed == 0) || archive_failed && completed == 0 {
        JobStatus::Failed
    } else if archive_failed {
        // Partial archive failure with some downloads: still completed, error noted.
        JobStatus::Completed
    } else {
        JobStatus::Completed
    };
    let _ = state.db.lock().update_job_status(&job.id, status);

    if let Ok(settings) = load_settings(&state.app_data) {
        if settings.open_folder_on_complete {
            let _ = open_path_impl(job.destination.clone());
        }
    }

    // Periodic history retention (30 days).
    let _ = state.db.lock().purge_old_history(30);

    JobRunResult { completed, failed }
}

#[tauri::command]
pub fn cancel_job(state: State<'_, Arc<AppState>>, job_id: String) -> AppResult<()> {
    let flag = cancel_flag_for(&state, &job_id);
    flag.store(true, Ordering::SeqCst);
    // Best-effort: kill tracked child PIDs (Windows).
    let children = state.active_children.clone();
    tauri::async_runtime::spawn(async move {
        let pids = children.lock().await.clone();
        for pid in pids {
            #[cfg(windows)]
            {
                let mut kill = std::process::Command::new("taskkill");
                kill.args(["/PID", &pid.to_string(), "/T", "/F"]);
                crate::win_cmd::hide_console_std(&mut kill);
                let _ = kill.output();
            }
            #[cfg(unix)]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-TERM", &pid.to_string()])
                    .output();
            }
        }
    });
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
pub fn clear_history(state: State<'_, Arc<AppState>>) -> AppResult<u32> {
    Ok(state.db.lock().clear_all_history()? as u32)
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
    let checksums = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts/sidecar-checksums.json");
    let bundled = sidecar.join("sidecar-checksums.json");
    let checksum_path = if bundled.exists() {
        bundled
    } else {
        checksums
    };
    let db_path = state.db.lock().path().to_path_buf();
    collect_diagnostics(&sidecar, &logs, &db_path, &keys, Some(&checksum_path))
}

#[tauri::command]
pub fn verify_manifest_file(app: AppHandle, path: String) -> AppResult<Manifest> {
    let meta = std::fs::metadata(&path).map_err(|e| AppError::Manifest(e.to_string()))?;
    if meta.len() > MAX_MANIFEST_BYTES {
        return Err(AppError::Manifest(format!(
            "manifest exceeds {} byte limit",
            MAX_MANIFEST_BYTES
        )));
    }
    let keys = public_keys_path(&app);
    crate::manifest::verify_manifest_file(std::path::Path::new(&path), &keys)
}

#[tauri::command]
pub fn flush_status_outbox(state: State<'_, Arc<AppState>>) -> AppResult<()> {
    let db = state_db_arc(&state);
    tauri::async_runtime::spawn(async move {
        crate::status_callback::flush_outbox(db).await;
    });
    Ok(())
}

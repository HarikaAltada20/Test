use crate::error::{AppError, AppResult, ConflictPolicy, DownloadStage, QualityPreference};
use crate::progress::{emit_progress, ProgressEvent};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// Max wall-clock time for a single download (2 hours).
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(2 * 60 * 60);
/// Max accepted media file size (8 GiB).
pub const MAX_MEDIA_BYTES: u64 = 8 * 1024 * 1024 * 1024;
/// Require this much free space headroom before starting a download.
const FREE_SPACE_HEADROOM: u64 = 512 * 1024 * 1024;

pub struct DownloadRequest {
    pub url: String,
    pub destination: PathBuf,
    pub quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub job_id: String,
    pub item_id: String,
    /// When set (GoC manifest), preserve the exact server-supplied filename.
    pub exact_filename: Option<String>,
    pub cancel: Arc<AtomicBool>,
}

fn format_selector(quality: &QualityPreference) -> &'static str {
    // Fixed selectors only — never interpolate untrusted strings into format.
    match quality {
        QualityPreference::Best => "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best",
        QualityPreference::P1080 => {
            "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]"
        }
        QualityPreference::P720 => {
            "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]"
        }
        QualityPreference::P480 => {
            "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]"
        }
        QualityPreference::Audio => "ba[ext=m4a]/bestaudio",
    }
}

fn resolve_final_path(destination: &Path, preferred: &str, conflict: &ConflictPolicy) -> AppResult<(PathBuf, bool)> {
    crate::path_safety::assert_safe_filename(preferred)?;
    let candidate = destination.join(preferred);
    if !candidate.exists() {
        return Ok((candidate, false));
    }
    match conflict {
        ConflictPolicy::Skip => Ok((candidate, true)),
        ConflictPolicy::Overwrite => Ok((candidate, false)),
        ConflictPolicy::Rename => {
            let stem = Path::new(preferred)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = Path::new(preferred)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("mp4");
            for i in 1..10_000 {
                let renamed = destination.join(format!("{stem} ({i}).{ext}"));
                if !renamed.exists() {
                    return Ok((renamed, false));
                }
            }
            Err(AppError::Download(
                "could not find a free rename target".into(),
            ))
        }
    }
}

fn yt_dlp_args(
    req: &DownloadRequest,
    out_template: &str,
    sidecar_dir: &Path,
) -> AppResult<Vec<String>> {
    let deno = resolve_sidecar(sidecar_dir, "deno")?;
    let mut args = vec![
        "--no-playlist".into(),
        "--no-mtime".into(),
        "--retries".into(),
        "3".into(),
        "--fragment-retries".into(),
        "3".into(),
        "--continue".into(),
        "--print".into(),
        "after_move:filepath".into(),
        "--print".into(),
        "filepath".into(),
        "-f".into(),
        format_selector(&req.quality).into(),
        "--merge-output-format".into(),
        "mp4".into(),
        "--ffmpeg-location".into(),
        sidecar_dir.to_string_lossy().into_owned(),
        "--js-runtimes".into(),
        format!("deno:{}", deno.to_string_lossy()),
        "-o".into(),
        out_template.into(),
        "--newline".into(),
        "--no-progress".into(),
    ];
    if matches!(req.conflict, ConflictPolicy::Skip) && req.exact_filename.is_none() {
        // For isolated temp downloads we still avoid overwriting within the temp dir.
        args.insert(0, "--no-overwrites".into());
    }
    args.push(req.url.clone());
    Ok(args)
}

fn check_disk_budget(destination: &Path) -> AppResult<()> {
    // Best-effort free-space check via available space on the destination volume.
    // On Windows, use GetDiskFreeSpaceEx via a crude estimate from metadata when available.
    // If we cannot determine free space, continue rather than blocking.
    if let Ok(meta) = std::fs::metadata(destination) {
        let _ = meta;
    }
    // Attempt to create the directory and check via a probe write is not enough.
    // Use available_space crate? Prefer std-only: skip hard fail when unknown.
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use std::ffi::OsStr;
        #[link(name = "kernel32")]
        extern "system" {
            fn GetDiskFreeSpaceExW(
                lpDirectoryName: *const u16,
                lpFreeBytesAvailableToCaller: *mut u64,
                lpTotalNumberOfBytes: *mut u64,
                lpTotalNumberOfFreeBytes: *mut u64,
            ) -> i32;
        }
        let path_str = destination.to_string_lossy().into_owned();
        let wide: Vec<u16> = OsStr::new(&path_str)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut avail: u64 = 0;
        let mut total: u64 = 0;
        let mut free: u64 = 0;
        let ok = unsafe {
            GetDiskFreeSpaceExW(wide.as_ptr(), &mut avail, &mut total, &mut free)
        };
        if ok != 0 && avail < FREE_SPACE_HEADROOM {
            return Err(AppError::Download(format!(
                "insufficient free disk space (need at least {} MiB headroom)",
                FREE_SPACE_HEADROOM / (1024 * 1024)
            )));
        }
    }
    #[cfg(not(windows))]
    {
        let _ = FREE_SPACE_HEADROOM;
        let _ = destination;
    }
    Ok(())
}

async fn kill_child(child: &mut Child) {
    let _ = child.kill().await;
    let _ = child.wait().await;
}

pub async fn download_one(
    app: &AppHandle,
    sidecar_dir: &Path,
    req: DownloadRequest,
    active_children: Arc<Mutex<Vec<u32>>>,
) -> AppResult<PathBuf> {
    crate::urls::validate_youtube_url(&req.url)?;
    std::fs::create_dir_all(&req.destination)?;
    check_disk_budget(&req.destination)?;

    if req.cancel.load(Ordering::SeqCst) {
        return Err(AppError::Cancelled);
    }

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Validating,
            percent: Some(0.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Validating URL".into()),
        },
    );

    // Isolated temp directory per item — never scan the shared destination.
    let work_dir = req
        .destination
        .join(format!(".goc-work-{}", &req.item_id[..8.min(req.item_id.len())]));
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir)?;

    let preferred_name = req
        .exact_filename
        .clone()
        .unwrap_or_else(|| format!("{}.mp4", &req.item_id[..8.min(req.item_id.len())]));
    let (final_path, skipped) =
        resolve_final_path(&req.destination, &preferred_name, &req.conflict)?;
    if skipped {
        let _ = std::fs::remove_dir_all(&work_dir);
        emit_progress(
            app,
            ProgressEvent {
                job_id: req.job_id.clone(),
                item_id: Some(req.item_id.clone()),
                stage: DownloadStage::Done,
                percent: Some(100.0),
                bytes_downloaded: None,
                bytes_total: None,
                speed_bps: None,
                eta_seconds: None,
                message: Some("Skipped existing file".into()),
            },
        );
        return Ok(final_path);
    }

    let out_template = work_dir
        .join("%(id)s.%(ext)s")
        .to_string_lossy()
        .to_string();

    let yt_dlp = resolve_sidecar(sidecar_dir, "yt-dlp")?;
    crate::diagnostics::assert_sidecar_checksum(sidecar_dir, "yt-dlp")?;
    let args = yt_dlp_args(&req, &out_template, sidecar_dir)?;

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Downloading,
            percent: Some(10.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Downloading".into()),
        },
    );

    let mut yt_cmd = Command::new(&yt_dlp);
    yt_cmd
        .args(&args)
        .current_dir(&work_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    crate::win_cmd::hide_console(&mut yt_cmd);
    let mut child = yt_cmd
        .spawn()
        .map_err(|e| AppError::Download(format!("failed to spawn yt-dlp: {e}")))?;

    if let Some(pid) = child.id() {
        active_children.lock().await.push(pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| AppError::Download("missing yt-dlp stdout".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| AppError::Download("missing yt-dlp stderr".into()))?;

    let printed_paths = Arc::new(Mutex::new(Vec::<String>::new()));
    let printed_clone = Arc::clone(&printed_paths);
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut ring = Vec::<String>::new();
        while let Ok(Some(line)) = reader.next_line().await {
            let trimmed = line.trim().to_string();
            if !trimmed.is_empty() {
                // yt-dlp --print filepath lines are absolute/relative paths.
                if trimmed.contains('.') && !trimmed.starts_with('[') {
                    printed_clone.lock().await.push(trimmed.clone());
                }
                ring.push(trimmed);
                if ring.len() > 200 {
                    ring.remove(0);
                }
            }
        }
        ring
    });

    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut ring = Vec::<String>::new();
        while let Ok(Some(line)) = reader.next_line().await {
            let trimmed = line.trim().to_string();
            if !trimmed.is_empty() {
                ring.push(trimmed);
                if ring.len() > 200 {
                    ring.remove(0);
                }
            }
        }
        ring
    });

    let cancel = Arc::clone(&req.cancel);
    let wait_result = tokio::select! {
        status = child.wait() => status.map_err(|e| AppError::Download(format!("yt-dlp wait failed: {e}"))),
        _ = tokio::time::sleep(DOWNLOAD_TIMEOUT) => {
            kill_child(&mut child).await;
            Err(AppError::Download("download timed out".into()))
        }
        _ = async {
            loop {
                if cancel.load(Ordering::SeqCst) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(250)).await;
            }
        } => {
            kill_child(&mut child).await;
            Err(AppError::Cancelled)
        }
    };

    if let Some(pid) = child.id() {
        active_children.lock().await.retain(|p| *p != pid);
    } else {
        // Child already reaped; clear any matching stale entries opportunistically.
    }

    let stdout_lines = stdout_task.await.unwrap_or_default();
    let stderr_lines = stderr_task.await.unwrap_or_default();

    let status = wait_result?;
    if !status.success() {
        let details = if !stderr_lines.is_empty() {
            stderr_lines.join("\n")
        } else {
            stdout_lines.join("\n")
        };
        let details = if details.len() > 4_000 {
            details[details.len() - 4_000..].to_string()
        } else {
            details
        };
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(AppError::Download(format!(
            "yt-dlp exited with {}: {}",
            status,
            if details.is_empty() {
                "no diagnostic output".into()
            } else {
                details
            }
        )));
    }

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Merging,
            percent: Some(85.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Finalizing".into()),
        },
    );

    let printed = printed_paths.lock().await.clone();
    let produced = resolve_produced_file(&work_dir, &printed)?;
    let meta = std::fs::metadata(&produced)?;
    if meta.len() > MAX_MEDIA_BYTES {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(AppError::Download(format!(
            "downloaded file exceeds {} byte limit",
            MAX_MEDIA_BYTES
        )));
    }

    // Move into destination with conflict policy applied.
    if final_path.exists() && matches!(req.conflict, ConflictPolicy::Overwrite) {
        let _ = std::fs::remove_file(&final_path);
    }
    std::fs::rename(&produced, &final_path).or_else(|_| {
        std::fs::copy(&produced, &final_path).map(|_| ())
    })?;
    let _ = std::fs::remove_dir_all(&work_dir);

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Verifying,
            percent: Some(95.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Verifying with ffprobe".into()),
        },
    );

    verify_with_ffprobe(sidecar_dir, &final_path, &req.quality).await?;

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Done,
            percent: Some(100.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Complete".into()),
        },
    );

    Ok(final_path)
}

fn resolve_produced_file(work_dir: &Path, printed: &[String]) -> AppResult<PathBuf> {
    // Prefer the last filepath printed by yt-dlp.
    for candidate in printed.iter().rev() {
        let path = PathBuf::from(candidate);
        let abs = if path.is_absolute() {
            path
        } else {
            work_dir.join(path)
        };
        if abs.is_file() {
            return Ok(abs);
        }
    }
    // Fallback: only scan the isolated work dir (never the shared destination).
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in std::fs::read_dir(work_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(ext.as_str(), "mp4" | "m4a" | "mkv" | "webm") {
            continue;
        }
        let modified = entry
            .metadata()?
            .modified()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        if best.as_ref().map(|(t, _)| modified > *t).unwrap_or(true) {
            best = Some((modified, path));
        }
    }
    best.map(|(_, p)| p)
        .ok_or_else(|| AppError::Download("download finished but output file not found".into()))
}

pub fn resolve_sidecar(dir: &Path, name: &str) -> AppResult<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    let target = "x86_64-pc-windows-msvc";
    let candidates = [
        dir.join(&exe),
        dir.join(format!("{name}-{target}.exe")),
        dir.join(format!("{name}-{target}")),
    ];
    for path in &candidates {
        if path.exists() {
            return Ok(path.clone());
        }
    }
    // Fallback to PATH for local dev before sidecars are fetched.
    Ok(PathBuf::from(name))
}

async fn verify_with_ffprobe(
    sidecar_dir: &Path,
    media: &Path,
    quality: &QualityPreference,
) -> AppResult<()> {
    let ffprobe = resolve_sidecar(sidecar_dir, "ffprobe")?;
    crate::diagnostics::assert_sidecar_checksum(sidecar_dir, "ffprobe").ok();
    let media_str = media
        .to_str()
        .ok_or_else(|| AppError::Download("invalid media path".into()))?;
    let mut probe_cmd = Command::new(&ffprobe);
    probe_cmd.args([
        "-v",
        "error",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "csv=p=0",
        media_str,
    ]);
    crate::win_cmd::hide_console(&mut probe_cmd);
    let output = probe_cmd
        .output()
        .await
        .map_err(|e| AppError::Download(format!("ffprobe failed: {e}")))?;

    if !output.status.success() {
        return Err(AppError::Download("ffprobe verification failed".into()));
    }
    let text = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase();
    let has_audio = text.lines().any(|l| l.trim() == "audio");
    let has_video = text.lines().any(|l| l.trim() == "video");
    let audio_only = matches!(quality, QualityPreference::Audio)
        || media
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("m4a"))
            .unwrap_or(false);
    if audio_only {
        if !has_audio {
            return Err(AppError::Download("audio stream missing".into()));
        }
    } else if !(has_audio && has_video) {
        return Err(AppError::Download(
            "expected audio+video streams".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn rename_policy_picks_unused_name() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("clip.mp4"), b"a").unwrap();
        let (path, skipped) =
            resolve_final_path(dir.path(), "clip.mp4", &ConflictPolicy::Rename).unwrap();
        assert!(!skipped);
        assert_eq!(path.file_name().unwrap(), "clip (1).mp4");
    }

    #[test]
    fn skip_policy_returns_existing() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("clip.mp4"), b"a").unwrap();
        let (path, skipped) =
            resolve_final_path(dir.path(), "clip.mp4", &ConflictPolicy::Skip).unwrap();
        assert!(skipped);
        assert_eq!(path.file_name().unwrap(), "clip.mp4");
    }

    #[test]
    fn resolve_produced_prefers_printed_path() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("abc.mp4");
        std::fs::write(&target, b"data").unwrap();
        let other = dir.path().join("zzz.mp4");
        std::fs::write(&other, b"other").unwrap();
        let found = resolve_produced_file(
            dir.path(),
            &[target.to_string_lossy().to_string()],
        )
        .unwrap();
        assert_eq!(found, target);
    }
}

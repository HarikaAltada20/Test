use crate::error::{AppError, AppResult, ConflictPolicy, DownloadStage, QualityPreference};
use crate::progress::{emit_progress, ProgressEvent};
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::process::Command;

/// Windows note: when spawning yt-dlp/ffmpeg children, assign them to a Windows Job Object
/// (or use CREATE_BREAKAWAY_FROM_JOB carefully) so cancel/exit tears down the whole process
/// tree. Tauri shell sidecar + killing the parent is not always enough on Windows.
/// Tracked for a follow-up: `AssignProcessToJobObject` after `CreateProcess`.

pub struct DownloadRequest {
    pub url: String,
    pub destination: PathBuf,
    pub quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub job_id: String,
    pub item_id: String,
    /// When set (GoC manifest), preserve the exact server-supplied filename.
    pub exact_filename: Option<String>,
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

fn yt_dlp_args(
    req: &DownloadRequest,
    out_template: &str,
    sidecar_dir: &Path,
) -> AppResult<Vec<String>> {
    // Fixed argument arrays — URL is a single argv element, never shell-interpolated.
    let deno = resolve_sidecar(sidecar_dir, "deno")?;
    let mut args = vec![
        "--no-playlist".into(),
        "--no-mtime".into(),
        "--retries".into(),
        "3".into(),
        "--fragment-retries".into(),
        "3".into(),
        "--continue".into(),
        "-f".into(),
        format_selector(&req.quality).into(),
        "--merge-output-format".into(),
        "mp4".into(),
        "--ffmpeg-location".into(),
        sidecar_dir.to_string_lossy().into_owned(),
        "--js-runtimes".into(),
        format!("deno:{}", deno.to_string_lossy()),
        "--remote-components".into(),
        "ejs:github".into(),
        "-o".into(),
        out_template.into(),
        "--newline".into(),
    ];
    if matches!(req.conflict, ConflictPolicy::Skip) {
        args.insert(0, "--no-overwrites".into());
    }
    args.push(req.url.clone());
    Ok(args)
}

pub async fn download_one(
    app: &AppHandle,
    sidecar_dir: &Path,
    req: DownloadRequest,
) -> AppResult<PathBuf> {
    crate::urls::validate_youtube_url(&req.url)?;
    std::fs::create_dir_all(&req.destination)?;

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

    let out_template = if let Some(name) = &req.exact_filename {
        crate::path_safety::assert_safe_filename(name)?;
        req.destination
            .join(name)
            .to_string_lossy()
            .to_string()
    } else {
        req.destination
            .join("%(title).200B [%(id)s].%(ext)s")
            .to_string_lossy()
            .to_string()
    };

    let yt_dlp = resolve_sidecar(sidecar_dir, "yt-dlp")?;
    let args = yt_dlp_args(&req, &out_template, sidecar_dir)?;

    emit_progress(
        app,
        ProgressEvent {
            job_id: req.job_id.clone(),
            item_id: Some(req.item_id.clone()),
            stage: DownloadStage::Extracting,
            percent: Some(5.0),
            bytes_downloaded: None,
            bytes_total: None,
            speed_bps: None,
            eta_seconds: None,
            message: Some("Extracting media info".into()),
        },
    );

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

    let output = Command::new(&yt_dlp)
        .args(&args)
        .current_dir(&req.destination)
        .output()
        .await
        .map_err(|e| AppError::Download(format!("failed to spawn yt-dlp: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let details = if stderr.trim().is_empty() {
            stdout.trim()
        } else {
            stderr.trim()
        };
        let details = if details.len() > 4_000 {
            &details[details.len() - 4_000..]
        } else {
            details
        };
        return Err(AppError::Download(format!(
            "yt-dlp exited with {}: {}",
            output.status,
            if details.is_empty() {
                "no diagnostic output"
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
            message: Some("Merging streams".into()),
        },
    );

    let output = newest_media_file(&req.destination)?.ok_or_else(|| {
        AppError::Download("download finished but output file not found".into())
    })?;

    let final_path = atomic_finalize(&output)?;

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

    verify_with_ffprobe(sidecar_dir, &final_path).await?;

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

fn resolve_sidecar(dir: &Path, name: &str) -> AppResult<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };
    let path = dir.join(&exe);
    if path.exists() {
        return Ok(path);
    }
    // Fallback to PATH for local dev before sidecars are fetched.
    Ok(PathBuf::from(name))
}

fn newest_media_file(dir: &Path) -> AppResult<Option<PathBuf>> {
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in std::fs::read_dir(dir)? {
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
        if !matches!(ext.as_str(), "mp4" | "m4a" | "mkv" | "webm" | "part") {
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
    Ok(best.map(|(_, p)| p))
}

fn atomic_finalize(path: &Path) -> AppResult<PathBuf> {
    if path.extension().and_then(|e| e.to_str()) == Some("part") {
        let final_path = path.with_extension("");
        std::fs::rename(path, &final_path)?;
        return Ok(final_path);
    }
    Ok(path.to_path_buf())
}

async fn verify_with_ffprobe(sidecar_dir: &Path, media: &Path) -> AppResult<()> {
    let ffprobe = resolve_sidecar(sidecar_dir, "ffprobe")?;
    let media_str = media
        .to_str()
        .ok_or_else(|| AppError::Download("invalid media path".into()))?;
    // Fixed argv only.
    let output = Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            media_str,
        ])
        .output()
        .await
        .map_err(|e| AppError::Download(format!("ffprobe failed: {e}")))?;

    if !output.status.success() {
        return Err(AppError::Download("ffprobe verification failed".into()));
    }
    let text = String::from_utf8_lossy(&output.stdout).to_ascii_lowercase();
    let has_audio = text.lines().any(|l| l.trim() == "audio");
    let has_video = text.lines().any(|l| l.trim() == "video");
    let is_audio_only = media
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("m4a"))
        .unwrap_or(false);
    if is_audio_only {
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

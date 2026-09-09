use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarInfo {
    pub name: String,
    pub present: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksum_ok: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsInfo {
    pub sidecars: Vec<SidecarInfo>,
    pub logs_path: String,
    pub db_path: String,
    pub public_keys_path: String,
    pub checksum_status: String,
    pub app_version: String,
}

const SIDECARS: &[&str] = &["yt-dlp", "ffmpeg", "ffprobe", "deno"];

pub fn collect_diagnostics(
    sidecar_dir: &Path,
    logs_path: &Path,
    db_path: &Path,
    public_keys_path: &Path,
    checksums_path: Option<&Path>,
) -> AppResult<DiagnosticsInfo> {
    let mut sidecars = Vec::new();
    let mut any_missing = false;
    let mut any_mismatch = false;

    for name in SIDECARS {
        let exe = if cfg!(windows) {
            format!("{name}.exe")
        } else {
            (*name).to_string()
        };
        let path = sidecar_dir.join(&exe);
        let present = path.exists();
        if !present {
            any_missing = true;
        }
        let version = if present {
            probe_version(&path, name)
        } else {
            None
        };
        let checksum_ok = checksums_path.and_then(|cp| check_checksum(cp, &path, name));
        if checksum_ok == Some(false) {
            any_mismatch = true;
        }
        sidecars.push(SidecarInfo {
            name: (*name).to_string(),
            present,
            version,
            path: present.then(|| path.to_string_lossy().to_string()),
            checksum_ok,
        });
    }

    let checksum_status = if any_mismatch {
        "mismatch"
    } else if any_missing {
        "missing"
    } else if checksums_path.map(|p| p.exists()).unwrap_or(false) {
        "ok"
    } else {
        "unknown"
    };

    Ok(DiagnosticsInfo {
        sidecars,
        logs_path: logs_path.to_string_lossy().to_string(),
        db_path: db_path.to_string_lossy().to_string(),
        public_keys_path: public_keys_path.to_string_lossy().to_string(),
        checksum_status: checksum_status.into(),
        app_version: env!("CARGO_PKG_VERSION").into(),
    })
}

fn probe_version(path: &Path, name: &str) -> Option<String> {
    let args: &[&str] = match name {
        "yt-dlp" => &["--version"],
        "ffmpeg" | "ffprobe" => &["-version"],
        "deno" => &["--version"],
        _ => return None,
    };
    let mut cmd = Command::new(path);
    cmd.args(args);
    crate::win_cmd::hide_console_std(&mut cmd);
    let output = cmd.output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let line = text.lines().next().unwrap_or("").trim();
    if line.is_empty() {
        let err = String::from_utf8_lossy(&output.stderr);
        Some(err.lines().next().unwrap_or("unknown").trim().to_string())
    } else {
        Some(line.to_string())
    }
}

fn check_checksum(checksums_path: &Path, binary: &Path, name: &str) -> Option<bool> {
    let raw = std::fs::read_to_string(checksums_path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&raw).ok()?;
    // Prefer final executable hashes under `binaries.<name>.sha256`.
    let expected = value
        .get("binaries")?
        .get(name)?
        .get("sha256")?
        .as_str()?;
    if expected.starts_with("REPLACE") || expected.is_empty() {
        return None;
    }
    let bytes = std::fs::read(binary).ok()?;
    use sha2::{Digest, Sha256};
    let hash = hex::encode(Sha256::digest(&bytes));
    Some(hash.eq_ignore_ascii_case(expected))
}

/// Hard-fail when a bundled checksum manifest marks this binary as mismatched.
pub fn assert_sidecar_checksum(sidecar_dir: &Path, name: &str) -> AppResult<()> {
    let checksums = sidecar_dir.join("sidecar-checksums.json");
    let alt = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts/sidecar-checksums.json");
    let path = if checksums.exists() {
        checksums
    } else {
        alt
    };
    if !path.exists() {
        // Dev without executable checksums: soft-pass.
        return Ok(());
    }
    let exe = crate::downloader::resolve_sidecar(sidecar_dir, name)?;
    match check_checksum(&path, &exe, name) {
        Some(false) => Err(AppError::Download(format!(
            "sidecar checksum mismatch for {name}"
        ))),
        _ => Ok(()),
    }
}

pub fn default_sidecar_dir(resource_dir: &Path) -> PathBuf {
    resource_dir.join("binaries")
}

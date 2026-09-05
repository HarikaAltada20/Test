use crate::error::{AppError, AppResult};
use std::path::{Component, Path};

/// Reject absolute paths, traversal, ADS, control chars, trailing dots/spaces,
/// and Windows reserved device names in relative path segments.
pub fn assert_safe_relative_path(input: &str) -> AppResult<()> {
    if input.is_empty() {
        return Err(AppError::PathSafety("empty path".into()));
    }
    if input.contains('\0') {
        return Err(AppError::PathSafety("nul byte".into()));
    }
    for ch in input.chars() {
        if ch.is_control() {
            return Err(AppError::PathSafety("control character".into()));
        }
    }
    // NTFS alternate data streams
    if input.contains(':') {
        return Err(AppError::PathSafety("ADS / drive colon not allowed".into()));
    }
    let path = Path::new(input);
    if path.is_absolute() {
        return Err(AppError::PathSafety("absolute path not allowed".into()));
    }
    for component in path.components() {
        match component {
            Component::Normal(os) => {
                let seg = os.to_string_lossy();
                validate_segment(&seg)?;
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(AppError::PathSafety("path traversal (..)".into()));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(AppError::PathSafety("absolute/prefixed path".into()));
            }
        }
    }
    Ok(())
}

fn validate_segment(seg: &str) -> AppResult<()> {
    if seg.is_empty() {
        return Err(AppError::PathSafety("empty segment".into()));
    }
    if seg.ends_with(' ') || seg.ends_with('.') {
        return Err(AppError::PathSafety(
            "trailing dot/space not allowed".into(),
        ));
    }
    let stem = seg.split('.').next().unwrap_or(seg);
    let upper = stem.to_ascii_uppercase();
    const RESERVED: &[&str] = &[
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
        "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];
    if RESERVED.contains(&upper.as_str()) {
        return Err(AppError::PathSafety(format!(
            "reserved Windows name: {seg}"
        )));
    }
    Ok(())
}

/// Bare filename only (no directories) — used for manifest item/ZIP names.
pub fn assert_safe_filename(input: &str) -> AppResult<()> {
    if input.contains('/') || input.contains('\\') {
        return Err(AppError::PathSafety(
            "filename must not contain path separators".into(),
        ));
    }
    if input.contains("..") {
        return Err(AppError::PathSafety("filename must not contain ..".into()));
    }
    assert_safe_relative_path(input)
}

/// Join a base directory with a relative path after safety checks.
pub fn safe_join(base: &Path, relative: &str) -> AppResult<std::path::PathBuf> {
    assert_safe_relative_path(relative)?;
    let joined = base.join(relative);
    let base_canon = base
        .canonicalize()
        .unwrap_or_else(|_| base.to_path_buf());
    let candidate = if joined.exists() {
        joined.canonicalize().unwrap_or(joined)
    } else {
        joined
    };
    if let Ok(cand) = candidate.canonicalize() {
        if !cand.starts_with(&base_canon) {
            return Err(AppError::PathSafety("escapes destination root".into()));
        }
        return Ok(cand);
    }
    if !candidate.starts_with(base) && !candidate.starts_with(&base_canon) {
        let norm = candidate.to_string_lossy().replace('/', "\\");
        let base_s = base_canon.to_string_lossy().replace('/', "\\");
        if !norm
            .to_ascii_lowercase()
            .starts_with(&base_s.to_ascii_lowercase())
        {
            return Err(AppError::PathSafety("escapes destination root".into()));
        }
    }
    Ok(candidate)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_simple_relative() {
        assert!(assert_safe_relative_path("videos/clip.mp4").is_ok());
        assert!(assert_safe_filename("clip.mp4").is_ok());
    }

    #[test]
    fn rejects_parent_traversal() {
        assert!(assert_safe_relative_path("../secret").is_err());
        assert!(assert_safe_relative_path("a/../../b").is_err());
        assert!(assert_safe_filename("../x.mp4").is_err());
    }

    #[test]
    fn rejects_absolute() {
        assert!(assert_safe_relative_path("/etc/passwd").is_err());
        assert!(assert_safe_relative_path("C:\\Windows\\system32").is_err());
    }

    #[test]
    fn rejects_ads() {
        assert!(assert_safe_relative_path("file.txt:stream").is_err());
    }

    #[test]
    fn rejects_control_and_nul() {
        assert!(assert_safe_relative_path("a\nb").is_err());
        assert!(assert_safe_relative_path("a\0b").is_err());
    }

    #[test]
    fn rejects_trailing_dot_space() {
        assert!(assert_safe_relative_path("name.").is_err());
        assert!(assert_safe_relative_path("name ").is_err());
    }

    #[test]
    fn rejects_reserved_names() {
        assert!(assert_safe_relative_path("CON").is_err());
        assert!(assert_safe_relative_path("nul.txt").is_err());
        assert!(assert_safe_relative_path("folder/COM1.mp4").is_err());
    }
}

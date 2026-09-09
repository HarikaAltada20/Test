use crate::error::{AppError, AppResult};
use crate::path_safety::assert_safe_relative_path;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[derive(Debug, Default)]
pub struct ArchiveResult {
    pub zip_path: Option<PathBuf>,
    pub archived: Vec<PathBuf>,
    pub failed: Vec<(PathBuf, String)>,
    pub failure_report_path: Option<PathBuf>,
}

/// Create a ZIP of successful files only. Paths inside the archive are relative
/// and safety-checked. Files are streamed (never fully buffered in memory).
pub fn create_zip(
    destination: &Path,
    zip_name: &str,
    files: &[PathBuf],
) -> AppResult<ArchiveResult> {
    assert_safe_relative_path(zip_name)?;
    let zip_path = destination.join(zip_name);
    let file = File::create(&zip_path).map_err(|e| AppError::Archive(e.to_string()))?;
    let mut zip = ZipWriter::new(BufWriter::new(file));
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut result = ArchiveResult {
        zip_path: Some(zip_path.clone()),
        ..Default::default()
    };

    for path in files {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| AppError::Archive("invalid file name".into()))?;
        if let Err(e) = assert_safe_relative_path(name) {
            result.failed.push((path.clone(), e.to_string()));
            continue;
        }
        match File::open(path) {
            Ok(mut input) => {
                if let Err(e) = zip.start_file(name, options) {
                    result.failed.push((path.clone(), e.to_string()));
                    continue;
                }
                match std::io::copy(&mut input, &mut zip) {
                    Ok(_) => result.archived.push(path.clone()),
                    Err(e) => result.failed.push((path.clone(), e.to_string())),
                }
            }
            Err(e) => result.failed.push((path.clone(), e.to_string())),
        }
    }

    zip.finish()
        .map_err(|e| AppError::Archive(e.to_string()))?;

    if !result.failed.is_empty() {
        let report_path = destination.join("archive-failures.txt");
        let mut report = String::from("Archive partial failure report\n");
        for (path, err) in &result.failed {
            report.push_str(&format!("{}: {}\n", path.display(), err));
        }
        let mut report_file =
            File::create(&report_path).map_err(|e| AppError::Archive(e.to_string()))?;
        report_file
            .write_all(report.as_bytes())
            .map_err(|e| AppError::Archive(e.to_string()))?;
        result.failure_report_path = Some(report_path);
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use tempfile::tempdir;

    #[test]
    fn streams_files_into_zip() {
        let dir = tempdir().unwrap();
        let a = dir.path().join("a.mp4");
        let b = dir.path().join("b.mp4");
        // Large-enough payloads to ensure streaming path is exercised.
        std::fs::write(&a, vec![1u8; 64 * 1024]).unwrap();
        std::fs::write(&b, vec![2u8; 64 * 1024]).unwrap();
        let result = create_zip(dir.path(), "out.zip", &[a, b]).unwrap();
        assert!(result.zip_path.unwrap().is_file());
        assert_eq!(result.archived.len(), 2);
        assert!(result.failed.is_empty());
        let mut buf = Vec::new();
        File::open(dir.path().join("out.zip"))
            .unwrap()
            .read_to_end(&mut buf)
            .unwrap();
        assert!(!buf.is_empty());
    }
}

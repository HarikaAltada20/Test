use crate::error::{AppError, AppResult};
use crate::path_safety::assert_safe_relative_path;
use std::fs::File;
use std::io::{Write, BufWriter};
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
/// and safety-checked. On partial failure, successes are retained and a failure
/// report is written beside the archive.
pub fn create_zip(
    destination: &Path,
    zip_name: &str,
    files: &[PathBuf],
) -> AppResult<ArchiveResult> {
    assert_safe_relative_path(zip_name)?;
    let zip_path = destination.join(zip_name);
    let file = File::create(&zip_path).map_err(|e| AppError::Archive(e.to_string()))?;
    let mut zip = ZipWriter::new(BufWriter::new(file));
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

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
        match std::fs::read(path) {
            Ok(bytes) => {
                if let Err(e) = zip.start_file(name, options) {
                    result.failed.push((path.clone(), e.to_string()));
                    continue;
                }
                if let Err(e) = zip.write_all(&bytes) {
                    result.failed.push((path.clone(), e.to_string()));
                    continue;
                }
                result.archived.push(path.clone());
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
        std::fs::write(&report_path, report)?;
        result.failure_report_path = Some(report_path);
    }

    Ok(result)
}

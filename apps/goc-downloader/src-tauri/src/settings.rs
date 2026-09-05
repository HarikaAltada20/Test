use crate::error::{AppError, AppResult, ConflictPolicy, QualityPreference};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub destination: String,
    pub concurrency: u8,
    pub default_quality: QualityPreference,
    pub conflict: ConflictPolicy,
    pub create_zip_by_default: bool,
    pub open_folder_on_complete: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let destination = dirs::download_dir()
            .or_else(dirs::home_dir)
            .map(|p| p.join("GoC Downloads"))
            .unwrap_or_else(|| PathBuf::from("GoC Downloads"))
            .to_string_lossy()
            .to_string();
        Self {
            destination,
            concurrency: 1,
            default_quality: QualityPreference::Best,
            conflict: ConflictPolicy::Rename,
            create_zip_by_default: false,
            open_folder_on_complete: true,
        }
    }
}

pub fn settings_path(app_data: &Path) -> PathBuf {
    app_data.join("settings.json")
}

pub fn load_settings(app_data: &Path) -> AppResult<AppSettings> {
    let path = settings_path(app_data);
    if !path.exists() {
        let defaults = AppSettings::default();
        save_settings(app_data, &defaults)?;
        return Ok(defaults);
    }
    let raw = fs::read_to_string(&path).map_err(|e| AppError::Settings(e.to_string()))?;
    let mut settings: AppSettings =
        serde_json::from_str(&raw).map_err(|e| AppError::Settings(e.to_string()))?;
    if settings.concurrency < 1 {
        settings.concurrency = 1;
    }
    if settings.concurrency > 2 {
        settings.concurrency = 2;
    }
    Ok(settings)
}

pub fn save_settings(app_data: &Path, settings: &AppSettings) -> AppResult<AppSettings> {
    fs::create_dir_all(app_data)?;
    let mut normalized = settings.clone();
    if normalized.concurrency < 1 {
        normalized.concurrency = 1;
    }
    if normalized.concurrency > 2 {
        normalized.concurrency = 2;
    }
    let path = settings_path(app_data);
    let raw = serde_json::to_string_pretty(&normalized)?;
    fs::write(path, raw)?;
    Ok(normalized)
}

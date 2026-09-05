mod archive;
mod commands;
mod db;
mod diagnostics;
mod downloader;
mod error;
mod manifest;
mod path_safety;
mod progress;
mod settings;
mod status_callback;
mod urls;

use commands::AppState;
use db::Db;
use parking_lot::Mutex;
use std::collections::HashSet;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tracing_subscriber::EnvFilter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            tracing::info!("single-instance argv: {:?}", argv);
            // Forward deep-link / file-association args to the existing window.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                if argv.len() > 1 {
                    let _ = window.emit("deep-link", argv[1..].to_vec());
                }
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("goc-downloader"));
            std::fs::create_dir_all(&app_data)?;
            let logs = app_data.join("logs");
            std::fs::create_dir_all(&logs)?;

            let db = Db::open(app_data.join("jobs.db"))?;
            app.manage(Arc::new(AppState {
                db: Mutex::new(db),
                app_data,
                cancel_flags: Mutex::new(HashSet::new()),
            }));

            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                if let Err(e) = app.deep_link().register_all() {
                    tracing::warn!("deep-link register: {e}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_manual_download,
            commands::import_manifest,
            commands::cancel_job,
            commands::list_jobs,
            commands::get_job,
            commands::open_path,
            commands::get_settings,
            commands::save_settings,
            commands::get_diagnostics,
            commands::verify_manifest_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

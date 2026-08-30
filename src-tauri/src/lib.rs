pub mod config;
pub mod date_extractor;
pub mod diagnostics;
pub mod extractor;
pub mod matcher;
pub mod parser;
pub mod processor;
pub mod stitcher;

use config::AppConfig;
use diagnostics::{get_os_log_dir, log_event};
use extractor::{
    cleanup_staging_dir, detect_zip_archives, discover_storage_info, extract_all_zips,
    purge_all_staging_caches, StorageInfo, ZipFileInfo,
};
use matcher::{MediaJsonPair, TakeoutMatcher};
use parser::GoogleTakeoutMetadata;
use processor::{ScanSummary, TakeoutProcessor};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use stitcher::exif_writer::is_exiftool_available;
use stitcher::ProcessOptions;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub processor: TakeoutProcessor,
    pub last_pairs: Mutex<Vec<MediaJsonPair>>,
    pub staging_dir: Mutex<Option<PathBuf>>,
    pub config: Mutex<AppConfig>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            processor: TakeoutProcessor::default(),
            last_pairs: Mutex::new(Vec::new()),
            staging_dir: Mutex::new(None),
            config: Mutex::new(AppConfig::load()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaPairDto {
    pub media_path: String,
    pub json_path: Option<String>,
    pub file_name: String,
    pub extension: String,
    pub is_video: bool,
    pub fallback_date_str: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub summary: ScanSummary,
    pub pairs_preview: Vec<MediaPairDto>,
    pub total_pairs_count: usize,
    pub staging_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub exiftool_available: bool,
    pub os_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticInfoDto {
    pub log_dir: String,
    pub recent_logs: Vec<String>,
    pub os_name: String,
    pub system_details: diagnostics::SystemDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewDto {
    pub title: Option<String>,
    pub description: Option<String>,
    pub date_taken: Option<String>,
    pub timestamp: Option<i64>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub altitude: Option<f64>,
    pub people: Vec<String>,
    pub date_source: String,
}

pub mod commands {
    use super::*;

    #[tauri::command]
    pub fn log_ui_event(
        category: String,
        action: String,
        details: Option<String>,
    ) -> Result<(), String> {
        let d = details.unwrap_or_default();
        log_event("INFO", &category, &action, &d);
        Ok(())
    }

    #[tauri::command]
    pub fn get_diagnostic_info() -> Result<DiagnosticInfoDto, String> {
        let log_dir = get_os_log_dir().to_string_lossy().to_string();
        let recent_logs = diagnostics::get_logger().read_recent_lines(150);
        let system_details = diagnostics::get_system_details();
        Ok(DiagnosticInfoDto {
            log_dir,
            recent_logs,
            os_name: system_details.os_name.clone(),
            system_details,
        })
    }

    #[tauri::command]
    pub fn open_log_directory() -> Result<(), String> {
        let dir = get_os_log_dir();
        let _ = std::fs::create_dir_all(&dir);
        let path_str = dir.to_string_lossy().to_string();
        open_path_in_finder(path_str)
    }

    #[tauri::command]
    pub fn clear_diagnostic_logs() -> Result<(), String> {
        diagnostics::get_logger().clear_logs()?;
        log_event("INFO", "DIAGNOSTICS", "CLEARED_LOGS", "All diagnostic logs cleared by user");
        Ok(())
    }

    #[tauri::command]
    pub fn select_folder(title: Option<String>) -> Result<Option<String>, String> {
        let mut dialog = rfd::FileDialog::new();
        if let Some(t) = dialog_title(&title) {
            dialog = dialog.set_title(t);
        }
        let res = dialog.pick_folder();
        Ok(res.map(|p| p.to_string_lossy().to_string()))
    }

    fn dialog_title(t: &Option<String>) -> Option<&str> {
        t.as_deref()
    }

    #[tauri::command]
    pub fn select_zip_files() -> Result<Vec<String>, String> {
        let dialog = rfd::FileDialog::new()
            .set_title("Select Google Takeout ZIP Archives")
            .add_filter("ZIP Archives", &["zip"]);

        let res = dialog.pick_files();
        Ok(res
            .unwrap_or_default()
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect())
    }

    #[tauri::command]
    pub fn detect_zips_in_folder(folder_path: String) -> Result<Vec<ZipFileInfo>, String> {
        let path = PathBuf::from(folder_path);
        if !path.exists() {
            return Err("Folder does not exist".to_string());
        }
        Ok(detect_zip_archives(path))
    }

    /// Checks the current disk storage used by temporary staging caches
    #[tauri::command]
    pub fn get_storage_status(
        output_dir: Option<String>,
        state: State<'_, Arc<AppState>>,
    ) -> StorageInfo {
        let active_staging = state.staging_dir.lock().ok().and_then(|guard| guard.clone());
        discover_storage_info(output_dir.as_deref(), active_staging.as_deref())
    }

    /// Purges all temporary staging caches and frees disk space immediately
    #[tauri::command]
    pub fn purge_storage_caches(
        output_dir: Option<String>,
        state: State<'_, Arc<AppState>>,
    ) -> Result<u64, String> {
        let active_staging = state.staging_dir.lock().ok().and_then(|mut guard| guard.take());
        let freed_bytes = purge_all_staging_caches(output_dir.as_deref(), active_staging.as_deref());
        Ok(freed_bytes)
    }

    /// Loads active application configuration
    #[tauri::command]
    pub fn get_app_config(state: State<'_, Arc<AppState>>) -> AppConfig {
        state.config.lock().map(|c| c.clone()).unwrap_or_else(|_| AppConfig::load())
    }

    /// Saves updated application configuration and updates memory state
    #[tauri::command]
    pub fn save_app_config(
        config: AppConfig,
        state: State<'_, Arc<AppState>>,
    ) -> Result<(), String> {
        config.save()?;
        if let Ok(mut c_lock) = state.config.lock() {
            *c_lock = config;
        }
        Ok(())
    }

    /// Resets application configuration to factory defaults
    #[tauri::command]
    pub fn reset_app_config(state: State<'_, Arc<AppState>>) -> Result<AppConfig, String> {
        let defaults = AppConfig::default_config();
        defaults.save()?;
        if let Ok(mut c_lock) = state.config.lock() {
            *c_lock = defaults.clone();
        }
        Ok(defaults)
    }

    /// Interactive pattern sandbox tester for real-time validation in Settings
    #[tauri::command]
    pub fn test_pattern_matching(
        sample_filename: String,
        patterns: Vec<String>,
    ) -> Vec<String> {
        let mut custom_config = AppConfig::default_config();
        custom_config.custom_json_patterns = patterns;
        let matcher = TakeoutMatcher::with_config(custom_config);
        matcher.candidate_json_names(&sample_filename)
    }

    /// Launches multi-part ZIP extraction in a dedicated background OS thread
    #[tauri::command]
    pub fn start_zip_extraction(
        app: AppHandle,
        zip_paths: Vec<String>,
        output_dir: Option<String>,
        state: State<'_, Arc<AppState>>,
    ) -> Result<String, String> {
        if zip_paths.is_empty() {
            return Err("No zip files selected for extraction".to_string());
        }

        let staging_path = if let Some(ref out) = output_dir {
            PathBuf::from(out).join(".takeout_staging_cache")
        } else {
            std::env::temp_dir().join(format!("takeout_staging_{}", chrono::Utc::now().timestamp()))
        };

        if let Ok(mut s_lock) = state.staging_dir.lock() {
            *s_lock = Some(staging_path.clone());
        }

        state.processor.reset_cancel();

        let app_clone = app.clone();
        let paths: Vec<PathBuf> = zip_paths.into_iter().map(PathBuf::from).collect();
        let staging_clone = staging_path.clone();
        let cancel_flag = state.processor.is_cancelled_flag();

        std::thread::spawn(move || {
            match extract_all_zips(&app_clone, &paths, &staging_clone, &cancel_flag) {
                Ok(_extracted_count) => {
                    log::info!("ZIP extraction completed successfully into {:?}", staging_clone);
                }
                Err(err) => {
                    log::error!("ZIP extraction error: {}", err);
                    let _ = app_clone.emit("extract-error", err);
                }
            }
        });

        Ok(staging_path.to_string_lossy().to_string())
    }

    /// Scans directory asynchronously in a background thread and emits scan-complete
    #[tauri::command]
    pub fn collate_and_scan(
        app: AppHandle,
        source_path: String,
        state: State<'_, Arc<AppState>>,
    ) -> Result<(), String> {
        let path = PathBuf::from(&source_path);
        if !path.exists() || !path.is_dir() {
            return Err("Folder does not exist or is inaccessible".to_string());
        }

        let state_arc = state.inner().clone();
        let app_clone = app.clone();
        let source_clone = source_path.clone();
        let current_config = state_arc.config.lock().map(|c| c.clone()).unwrap_or_else(|_| AppConfig::load());

        std::thread::spawn(move || {
            let (summary, pairs) = state_arc.processor.scan_takeout_dir(&path, Some(&current_config));

            if let Ok(mut lock) = state_arc.last_pairs.lock() {
                *lock = pairs.clone();
            }

            let preview_dtos: Vec<MediaPairDto> = pairs
                .iter()
                .take(100)
                .map(|p| MediaPairDto {
                    media_path: p.media_path.to_string_lossy().to_string(),
                    json_path: p.json_path.as_ref().map(|j| j.to_string_lossy().to_string()),
                    file_name: p.file_name.clone(),
                    extension: p.extension.clone(),
                    is_video: p.is_video,
                    fallback_date_str: p.fallback_date_str.clone(),
                })
                .collect();

            let response = ScanResponse {
                summary,
                pairs_preview: preview_dtos,
                total_pairs_count: pairs.len(),
                staging_dir: Some(source_clone),
            };

            let _ = app_clone.emit("scan-complete", response);
        });

        Ok(())
    }

    #[tauri::command]
    pub fn cleanup_staging(state: State<'_, Arc<AppState>>) -> Result<(), String> {
        if let Ok(mut s_lock) = state.staging_dir.lock() {
            if let Some(path) = s_lock.take() {
                cleanup_staging_dir(&path)?;
            }
        }
        Ok(())
    }

    #[tauri::command]
    pub fn check_system_status() -> SystemStatus {
        SystemStatus {
            exiftool_available: is_exiftool_available(),
            os_name: std::env::consts::OS.to_string(),
        }
    }

    /// Starts metadata batch processing in background thread
    #[tauri::command]
    pub fn start_batch_process(
        app: AppHandle,
        options: ProcessOptions,
        state: State<'_, Arc<AppState>>,
    ) -> Result<(), String> {
        let pairs = {
            let lock = state.last_pairs.lock().map_err(|e| e.to_string())?;
            lock.clone()
        };

        if pairs.is_empty() {
            return Err("No scanned files found to process. Please scan a folder first.".to_string());
        }

        let mut process_options = options;
        if process_options.source_root.is_none() {
            if let Ok(s_lock) = state.staging_dir.lock() {
                if let Some(ref p) = *s_lock {
                    process_options.source_root = Some(p.to_string_lossy().to_string());
                }
            }
        }

        let state_arc = state.inner().clone();
        let app_clone = app.clone();

        std::thread::spawn(move || {
            let processor = &state_arc.processor;
            let _summary = processor.process_batch(app_clone, pairs, process_options);

            // If a staging folder was used, clean it up after successful completion
            if let Ok(mut s_lock) = state_arc.staging_dir.lock() {
                if let Some(path) = s_lock.take() {
                    let _ = cleanup_staging_dir(&path);
                }
            }
        });

        Ok(())
    }

    #[tauri::command]
    pub fn cancel_batch_process(state: State<'_, Arc<AppState>>) -> Result<(), String> {
        state.processor.cancel();
        Ok(())
    }

    #[tauri::command]
    pub fn preview_file_metadata(
        file_name: String,
        json_path: Option<String>,
    ) -> Result<PreviewDto, String> {
        if let Some(j_path) = json_path {
            let path = PathBuf::from(&j_path);
            if path.exists() {
                if let Ok(meta) = GoogleTakeoutMetadata::from_file(path) {
                    let geo = meta.valid_geo_data().cloned();
                    let title = meta.title.clone();
                    let description = meta.clean_description();
                    let date_taken = meta.exif_date_time_original();
                    let timestamp = meta.taken_timestamp();
                    let people = meta.people_names();

                    return Ok(PreviewDto {
                        title,
                        description,
                        date_taken,
                        timestamp,
                        latitude: geo.as_ref().map(|g| g.latitude),
                        longitude: geo.as_ref().map(|g| g.longitude),
                        altitude: geo.as_ref().map(|g| g.altitude),
                        people,
                        date_source: "Google Takeout JSON Metadata".to_string(),
                    });
                }
            }
        }

        // Fallback: extract date from filename
        let date_extractor = date_extractor::FilenameDateExtractor::new();
        let fallback_dt = date_extractor.extract_datetime(&file_name);

        Ok(PreviewDto {
            title: Some(file_name.clone()),
            description: None,
            date_taken: fallback_dt.map(|dt| dt.format("%Y:%m:%d %H:%M:%S").to_string()),
            timestamp: fallback_dt.map(|dt| dt.timestamp()),
            latitude: None,
            longitude: None,
            altitude: None,
            people: Vec::new(),
            date_source: if fallback_dt.is_some() {
                "Extracted from Media Filename".to_string()
            } else {
                "None (Undated)".to_string()
            },
        })
    }

    #[tauri::command]
    pub fn open_path_in_finder(path: String) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[cfg(target_os = "macos")]
pub fn set_macos_dock_icon(png_bytes: &[u8]) {
    use objc::runtime::{Class, Object};
    use objc::{msg_send, sel, sel_impl};
    use std::os::raw::c_void;

    unsafe {
        if let Some(nsdata_class) = Class::get("NSData") {
            let data: *mut Object = msg_send![nsdata_class, dataWithBytes:png_bytes.as_ptr() as *const c_void length:png_bytes.len()];
            if !data.is_null() {
                if let Some(nsimage_class) = Class::get("NSImage") {
                    let img_alloc: *mut Object = msg_send![nsimage_class, alloc];
                    let img: *mut Object = msg_send![img_alloc, initWithData:data];
                    if !img.is_null() {
                        if let Some(nsapp_class) = Class::get("NSApplication") {
                            let app: *mut Object = msg_send![nsapp_class, sharedApplication];
                            let _: () = msg_send![app, setApplicationIconImage:img];
                        }
                        let _: () = msg_send![img, release];
                    }
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
pub fn set_macos_process_name(name: &str) {
    use objc::runtime::{Class, Object};
    use objc::{msg_send, sel, sel_impl};
    use std::ffi::CString;

    unsafe {
        if let Some(process_info_class) = Class::get("NSProcessInfo") {
            let process_info: *mut Object = msg_send![process_info_class, processInfo];
            if !process_info.is_null() {
                if let Some(nsstring_class) = Class::get("NSString") {
                    if let Ok(c_name) = CString::new(name) {
                        let ns_name: *mut Object = msg_send![nsstring_class, stringWithUTF8String: c_name.as_ptr()];
                        if !ns_name.is_null() {
                            let _: () = msg_send![process_info, setProcessName: ns_name];
                        }
                    }
                }
            }
        }
    }
}

pub fn run() {
    #[cfg(target_os = "macos")]
    {
        set_macos_process_name("Google Photos Metadata Fixer");
    }

    let app_state = Arc::new(AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(|_app| {
            // Initialize diagnostic logger for this run
            if let Ok(log_path) = diagnostics::get_logger().init_run() {
                log_event("INFO", "SYSTEM", "BOOT", &format!("Diagnostic logging active at {:?}", log_path));
            }
            let sys = diagnostics::get_system_details();
            log_event(
                "INFO",
                "SYSTEM",
                "OS_SPECS",
                &format!(
                    "{}, {}, Kernel: {}, Hardware: {}, Cores: {}, Memory: {}",
                    sys.os_version,
                    sys.os_build,
                    sys.kernel_version,
                    sys.hardware_model,
                    sys.cpu_cores,
                    sys.total_memory
                ),
            );
            log_event(
                "INFO",
                "SYSTEM",
                "ENGINE_STATUS",
                &format!(
                    "ExifTool available: {}, Architecture: {}",
                    is_exiftool_available(),
                    sys.architecture
                ),
            );

            #[cfg(target_os = "macos")]
            {
                set_macos_process_name("Google Photos Metadata Fixer");
                let icon_bytes = include_bytes!("../icons/icon.png");
                set_macos_dock_icon(icon_bytes);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::log_ui_event,
            commands::get_diagnostic_info,
            commands::open_log_directory,
            commands::clear_diagnostic_logs,
            commands::select_folder,
            commands::select_zip_files,
            commands::detect_zips_in_folder,
            commands::get_storage_status,
            commands::purge_storage_caches,
            commands::get_app_config,
            commands::save_app_config,
            commands::reset_app_config,
            commands::test_pattern_matching,
            commands::start_zip_extraction,
            commands::collate_and_scan,
            commands::cleanup_staging,
            commands::check_system_status,
            commands::start_batch_process,
            commands::cancel_batch_process,
            commands::preview_file_metadata,
            commands::open_path_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running takeout-stitcher application");
}

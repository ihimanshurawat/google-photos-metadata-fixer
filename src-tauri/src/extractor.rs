use crate::diagnostics::log_event;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZipFileInfo {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub formatted_size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionProgressPayload {
    pub current_zip_index: usize,
    pub total_zips: usize,
    pub current_zip_name: String,
    pub files_extracted: usize,
    pub total_files_in_zip: usize,
    pub bytes_extracted: u64,
    pub total_bytes: u64,
    pub formatted_bytes_extracted: String,
    pub formatted_total_bytes: String,
    pub overall_percentage: f64,
    pub speed_mb_sec: f64,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionCompletePayload {
    pub staging_dir: String,
    pub total_files_extracted: usize,
    pub elapsed_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub staging_paths: Vec<String>,
    pub total_bytes: u64,
    pub formatted_total_size: String,
    pub has_cache: bool,
}

pub fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let b = bytes as f64;
    if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.1} MB", b / MB)
    } else if b >= KB {
        format!("{:.1} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

pub fn calculate_dir_size<P: AsRef<Path>>(path: P) -> u64 {
    let mut total = 0;
    for entry in WalkDir::new(path.as_ref()).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

/// Discovers any existing temporary staging caches across the system or output folder
pub fn discover_storage_info(
    output_dir: Option<&str>,
    active_staging: Option<&Path>,
) -> StorageInfo {
    let mut paths_found = Vec::new();
    let mut total_bytes = 0;

    if let Some(active) = active_staging {
        if active.exists() {
            let size = calculate_dir_size(active);
            paths_found.push(active.to_string_lossy().to_string());
            total_bytes += size;
        }
    }

    if let Some(out) = output_dir {
        let dest_staging = PathBuf::from(out).join(".takeout_staging_cache");
        if dest_staging.exists() && !paths_found.contains(&dest_staging.to_string_lossy().to_string()) {
            let size = calculate_dir_size(&dest_staging);
            paths_found.push(dest_staging.to_string_lossy().to_string());
            total_bytes += size;
        }
    }

    // Check system temp for takeout_staging*
    let sys_temp = std::env::temp_dir();
    if let Ok(entries) = fs::read_dir(&sys_temp) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with("takeout_staging") {
                        let path_str = p.to_string_lossy().to_string();
                        if !paths_found.contains(&path_str) {
                            let size = calculate_dir_size(&p);
                            paths_found.push(path_str);
                            total_bytes += size;
                        }
                    }
                }
            }
        }
    }

    StorageInfo {
        staging_paths: paths_found,
        total_bytes,
        formatted_total_size: format_bytes(total_bytes),
        has_cache: total_bytes > 0,
    }
}

/// Purges all temporary staging caches found on disk
pub fn purge_all_staging_caches(
    output_dir: Option<&str>,
    active_staging: Option<&Path>,
) -> u64 {
    let info = discover_storage_info(output_dir, active_staging);
    for path_str in &info.staging_paths {
        let p = PathBuf::from(path_str);
        if p.exists() {
            let _ = fs::remove_dir_all(&p);
        }
    }
    info.total_bytes
}

/// Detects all .zip files within a folder or checks a single zip path
pub fn detect_zip_archives<P: AsRef<Path>>(path: P) -> Vec<ZipFileInfo> {
    let mut results = Vec::new();
    let p = path.as_ref();

    if p.is_file() {
        if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
            if ext.eq_ignore_ascii_case("zip") {
                let size = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
                results.push(ZipFileInfo {
                    file_name: p.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
                    path: p.to_string_lossy().to_string(),
                    size_bytes: size,
                    formatted_size: format_bytes(size),
                });
            }
        }
        return results;
    }

    if let Ok(entries) = fs::read_dir(p) {
        for entry in entries.flatten() {
            let ep = entry.path();
            if ep.is_file() {
                if let Some(ext) = ep.extension().and_then(|e| e.to_str()) {
                    if ext.eq_ignore_ascii_case("zip") {
                        let size = fs::metadata(&ep).map(|m| m.len()).unwrap_or(0);
                        results.push(ZipFileInfo {
                            file_name: ep.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string(),
                            path: ep.to_string_lossy().to_string(),
                            size_bytes: size,
                            formatted_size: format_bytes(size),
                        });
                    }
                }
            }
        }
    }

    // Sort naturally (e.g. takeout-001.zip before takeout-002.zip)
    results.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    results
}

/// Extracts a sequence of ZIP archives into a common staging directory with throttled telemetry
pub fn extract_all_zips(
    app: &AppHandle,
    zip_paths: &[PathBuf],
    staging_dir: &Path,
    cancel_flag: &Arc<AtomicBool>,
) -> Result<usize, String> {
    if !staging_dir.exists() {
        fs::create_dir_all(staging_dir)
            .map_err(|e| format!("Failed to create staging directory: {}", e))?;
    }

    // Calculate total archive bytes across all zip files
    let total_archive_bytes: u64 = zip_paths
        .iter()
        .map(|p| fs::metadata(p).map(|m| m.len()).unwrap_or(0))
        .sum();

    let total_zips = zip_paths.len();
    log_event(
        "INFO",
        "EXTRACT",
        "START_EXTRACTION",
        &format!(
            "Decompressing {} archives ({}) into {:?}",
            total_zips, format_bytes(total_archive_bytes), staging_dir
        ),
    );

    let mut total_extracted_files = 0;
    let start_time = Instant::now();
    let mut last_emit_time = Instant::now();
    let mut total_bytes_extracted: u64 = 0;
    let throttle_duration = Duration::from_millis(200);

    for (zip_idx, zip_path) in zip_paths.iter().enumerate() {
        if cancel_flag.load(Ordering::SeqCst) {
            log_event("WARN", "EXTRACT", "CANCELLED", "User cancelled archive decompression");
            return Err("Extraction cancelled by user".to_string());
        }

        let zip_name = zip_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let file = File::open(zip_path).map_err(|e| {
            let msg = format!("Failed to open zip {}: {}", zip_path.display(), e);
            log_event("ERROR", "EXTRACT", "OPEN_FAILED", &msg);
            msg
        })?;
        let reader = BufReader::with_capacity(512 * 1024, file);

        let mut archive = ZipArchive::new(reader).map_err(|e| {
            let msg = format!("Invalid zip archive {}: {}", zip_name, e);
            log_event("ERROR", "EXTRACT", "CORRUPT_ARCHIVE", &msg);
            msg
        })?;

        let total_in_zip = archive.len();

        for i in 0..total_in_zip {
            if cancel_flag.load(Ordering::SeqCst) {
                return Err("Extraction cancelled by user".to_string());
            }

            let mut zip_file = match archive.by_index(i) {
                Ok(f) => f,
                Err(e) => {
                    log::warn!("Could not read entry {} in {}: {}", i, zip_name, e);
                    continue;
                }
            };

            let raw_path = zip_file.mangled_name();
            let entry_name = zip_file.name().to_string();

            if entry_name.contains("__MACOSX") || entry_name.ends_with(".DS_Store") {
                continue;
            }

            let out_path = staging_dir.join(&raw_path);

            if zip_file.is_dir() {
                let _ = fs::create_dir_all(&out_path);
            } else {
                if let Some(parent) = out_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }

                let mut outfile = match File::create(&out_path) {
                    Ok(f) => f,
                    Err(e) => {
                        log::warn!("Failed to create file {}: {}", out_path.display(), e);
                        continue;
                    }
                };

                let mut buffer = [0u8; 128 * 1024];
                loop {
                    match zip_file.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(n) => {
                            if outfile.write_all(&buffer[..n]).is_err() {
                                break;
                            }
                            total_bytes_extracted += n as u64;
                        }
                        Err(_) => break,
                    }
                }

                total_extracted_files += 1;
            }

            let now = Instant::now();
            if now.duration_since(last_emit_time) >= throttle_duration || i == total_in_zip - 1 {
                last_emit_time = now;
                let elapsed_sec = start_time.elapsed().as_secs_f64();
                let speed_mb = if elapsed_sec > 0.1 {
                    (total_bytes_extracted as f64 / 1024.0 / 1024.0) / elapsed_sec
                } else {
                    0.0
                };

                let zip_fraction = (i as f64) / (total_in_zip.max(1) as f64);
                let overall_pct = (((zip_idx as f64) + zip_fraction) / (total_zips as f64)) * 100.0;

                let _ = app.emit(
                    "extract-progress",
                    ExtractionProgressPayload {
                        current_zip_index: zip_idx + 1,
                        total_zips,
                        current_zip_name: zip_name.clone(),
                        files_extracted: i + 1,
                        total_files_in_zip: total_in_zip,
                        bytes_extracted: total_bytes_extracted,
                        total_bytes: total_archive_bytes,
                        formatted_bytes_extracted: format_bytes(total_bytes_extracted),
                        formatted_total_bytes: format_bytes(total_archive_bytes),
                        overall_percentage: (overall_pct * 10.0).round() / 10.0,
                        speed_mb_sec: (speed_mb * 10.0).round() / 10.0,
                        current_file: entry_name,
                    },
                );
            }
        }
    }

    let elapsed = start_time.elapsed().as_secs_f64();
    let _ = app.emit(
        "extract-complete",
        ExtractionCompletePayload {
            staging_dir: staging_dir.to_string_lossy().to_string(),
            total_files_extracted: total_extracted_files,
            elapsed_seconds: (elapsed * 10.0).round() / 10.0,
        },
    );

    Ok(total_extracted_files)
}

/// Safely removes a staging directory and its extracted contents
pub fn cleanup_staging_dir<P: AsRef<Path>>(dir: P) -> Result<(), String> {
    let p = dir.as_ref();
    if p.exists() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to remove staging directory: {}", e))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(500), "500 B");
        assert_eq!(format_bytes(1024 * 1024 * 50), "50.0 MB");
        assert_eq!(format_bytes(1024 * 1024 * 1024 * 2), "2.00 GB");
    }
}

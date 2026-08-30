pub mod exif_writer;
pub mod filetime_util;
pub mod video_writer;

use crate::date_extractor::FilenameDateExtractor;
use crate::matcher::TakeoutMatcher;
use crate::parser::{GoogleTakeoutMetadata, TimestampInfo};
use exif_writer::{is_exiftool_available, write_native_image_exif, write_with_exiftool};
use filetime_util::set_filesystem_datetime;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use video_writer::stitch_video_file;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessOptions {
    pub stitch_date: bool,
    pub stitch_gps: bool,
    pub stitch_description: bool,
    pub stitch_tags: bool,
    pub sync_file_timestamps: bool,
    pub delete_json_after: bool,
    pub dry_run: bool,
    pub output_dir: Option<String>,
    pub organize_by_date: bool,
    #[serde(default = "default_folder_structure")]
    pub folder_structure: Option<String>, // "preserve" | "date" | "flat"
    pub source_root: Option<String>,
}

fn default_folder_structure() -> Option<String> {
    Some("preserve".to_string())
}

impl Default for ProcessOptions {
    fn default() -> Self {
        Self {
            stitch_date: true,
            stitch_gps: true,
            stitch_description: true,
            stitch_tags: true,
            sync_file_timestamps: true,
            delete_json_after: false,
            dry_run: false,
            output_dir: None,
            organize_by_date: false,
            folder_structure: Some("preserve".to_string()),
            source_root: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StitchReport {
    pub file_name: String,
    pub source_path: String,
    pub target_path: String,
    pub success: bool,
    pub has_json: bool,
    pub date_stitched: bool,
    pub gps_stitched: bool,
    pub desc_stitched: bool,
    pub date_source: String, // "json" | "filename" | "none"
    pub message: String,
}

/// Core function to stitch metadata into a single media file with fallback filename date parsing
pub fn stitch_media_item(
    media_path: &Path,
    json_path: Option<&Path>,
    options: &ProcessOptions,
) -> StitchReport {
    let file_name = media_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let mut report = StitchReport {
        file_name: file_name.clone(),
        source_path: media_path.to_string_lossy().to_string(),
        target_path: media_path.to_string_lossy().to_string(),
        success: false,
        has_json: json_path.is_some(),
        date_stitched: false,
        gps_stitched: false,
        desc_stitched: false,
        date_source: "none".to_string(),
        message: String::new(),
    };

    // 1. Try reading metadata from JSON sidecar
    let mut metadata_opt = if let Some(json_file) = json_path {
        match GoogleTakeoutMetadata::from_file(json_file) {
            Ok(m) => Some(m),
            Err(e) => {
                log::warn!("Could not read JSON {}: {}", json_file.display(), e);
                None
            }
        }
    } else {
        None
    };

    // 2. If no JSON or no timestamp in JSON, fallback to parsing Date & Time from Filename
    let has_json_timestamp = metadata_opt
        .as_ref()
        .and_then(|m| m.taken_timestamp())
        .is_some();

    if !has_json_timestamp {
        let date_extractor = FilenameDateExtractor::new();
        if let Some(dt) = date_extractor.extract_datetime(&file_name) {
            let ts = dt.timestamp();
            let formatted = dt.format("%Y:%m:%d %H:%M:%S").to_string();
            
            if let Some(ref mut m) = metadata_opt {
                m.photo_taken_time = Some(TimestampInfo {
                    timestamp: ts,
                    formatted: Some(formatted),
                });
                report.date_source = "filename_fallback".to_string();
            } else {
                metadata_opt = Some(GoogleTakeoutMetadata {
                    title: Some(file_name.clone()),
                    description: None,
                    image_views: None,
                    creation_time: Some(TimestampInfo {
                        timestamp: ts,
                        formatted: Some(formatted.clone()),
                    }),
                    modification_time: Some(TimestampInfo {
                        timestamp: ts,
                        formatted: Some(formatted.clone()),
                    }),
                    photo_taken_time: Some(TimestampInfo {
                        timestamp: ts,
                        formatted: Some(formatted),
                    }),
                    geo_data: None,
                    geo_data_exif: None,
                    people: None,
                    favorited: None,
                });
                report.date_source = "filename".to_string();
            }
        }
    } else {
        report.date_source = "json".to_string();
    }

    // Determine target path (in-place vs organized output folder)
    let target_media_path: PathBuf = if let Some(ref out_dir) = options.output_dir {
        let base_out = PathBuf::from(out_dir);
        let mode = options
            .folder_structure
            .as_deref()
            .unwrap_or(if options.organize_by_date { "date" } else { "preserve" });

        let dest_dir = match mode {
            "date" => {
                if let Some(dt) = metadata_opt.as_ref().and_then(|m| m.taken_datetime()) {
                    base_out.join(dt.format("%Y").to_string()).join(dt.format("%m").to_string())
                } else {
                    base_out.join("Undated")
                }
            }
            "flat" => base_out,
            _ => {
                // "preserve": Keep original Takeout album & year folder hierarchy
                if let Some(ref src_root) = options.source_root {
                    let src_root_path = Path::new(src_root);
                    if let Ok(rel_path) = media_path.strip_prefix(src_root_path) {
                        if let Some(rel_parent) = rel_path.parent() {
                            base_out.join(rel_parent)
                        } else {
                            base_out
                        }
                    } else if let Some(parent) = media_path.parent() {
                        if let Some(folder_name) = parent.file_name() {
                            base_out.join(folder_name)
                        } else {
                            base_out
                        }
                    } else {
                        base_out
                    }
                } else if let Some(parent) = media_path.parent() {
                    if let Some(folder_name) = parent.file_name() {
                        base_out.join(folder_name)
                    } else {
                        base_out
                    }
                } else {
                    base_out
                }
            }
        };

        if !options.dry_run {
            if let Err(e) = fs::create_dir_all(&dest_dir) {
                report.message = format!("Failed to create destination directory: {}", e);
                report.success = false;
                return report;
            }

            let target = dest_dir.join(&file_name);
            if target != media_path {
                if let Err(e) = fs::copy(media_path, &target) {
                    report.message = format!("Failed to copy media file to destination: {}", e);
                    report.success = false;
                    return report;
                }
            }
            target
        } else {
            dest_dir.join(&file_name)
        }
    } else {
        media_path.to_path_buf()
    };

    report.target_path = target_media_path.to_string_lossy().to_string();

    if options.dry_run {
        report.success = true;
        if let Some(ref meta) = metadata_opt {
            report.date_stitched = options.stitch_date && meta.taken_timestamp().is_some();
            report.gps_stitched = options.stitch_gps && meta.valid_geo_data().is_some();
            report.desc_stitched = options.stitch_description && meta.clean_description().is_some();
        }
        report.message = format!("[Dry-Run] Date Source: {}", report.date_source);
        return report;
    }

    // If metadata exists (from JSON or filename fallback), write to EXIF / QuickTime / Filesystem
    if let Some(ref metadata) = metadata_opt {
        let is_video = TakeoutMatcher::is_video_file(&target_media_path);

        if is_video {
            match stitch_video_file(
                &target_media_path,
                metadata,
                options.stitch_date,
                options.stitch_gps,
                options.stitch_description,
                options.stitch_tags,
            ) {
                Ok(_) => {
                    report.date_stitched = options.stitch_date && metadata.taken_timestamp().is_some();
                    report.gps_stitched = options.stitch_gps && metadata.valid_geo_data().is_some();
                    report.desc_stitched = options.stitch_description && metadata.clean_description().is_some();
                }
                Err(e) => {
                    log::warn!("Video stitching error for {}: {}", file_name, e);
                }
            }
        } else {
            let mut written = false;
            if is_exiftool_available() {
                if let Ok(m) = write_with_exiftool(
                    &target_media_path,
                    metadata,
                    options.stitch_date,
                    options.stitch_gps,
                    options.stitch_description,
                    options.stitch_tags,
                ) {
                    written = m;
                }
            }

            if !written {
                let _ = write_native_image_exif(
                    &target_media_path,
                    metadata,
                    options.stitch_date,
                    options.stitch_gps,
                    options.stitch_description,
                    options.stitch_tags,
                );
            }

            report.date_stitched = options.stitch_date && metadata.taken_timestamp().is_some();
            report.gps_stitched = options.stitch_gps && metadata.valid_geo_data().is_some();
            report.desc_stitched = options.stitch_description && metadata.clean_description().is_some();
        }

        // Sync filesystem timestamps
        if options.sync_file_timestamps {
            if let Some(dt) = metadata.taken_datetime() {
                let _ = set_filesystem_datetime(&target_media_path, dt);
            }
        }

        report.success = true;
        report.message = match report.date_source.as_str() {
            "json" => "Stitched metadata from Google Takeout JSON".to_string(),
            "filename" | "filename_fallback" => {
                let date_str = metadata.exif_date_time_original().unwrap_or_default();
                format!("Stitched timestamp recovered from filename: {}", date_str)
            }
            _ => "Copied clean media file".to_string(),
        };
    } else {
        report.success = true;
        report.message = "No metadata or filename date found; copied cleanly as-is".to_string();
    }

    // Delete JSON sidecar file if in-place and requested
    if options.delete_json_after && options.output_dir.is_none() {
        if let Some(json_file) = json_path {
            let _ = fs::remove_file(json_file);
        }
    }

    report
}

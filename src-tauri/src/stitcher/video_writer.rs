use crate::parser::GoogleTakeoutMetadata;
use crate::stitcher::exif_writer::{is_exiftool_available, write_with_exiftool};
use crate::stitcher::filetime_util::set_filesystem_datetime;
use std::path::Path;

/// Stitches metadata into video files (MP4, MOV, etc.)
pub fn stitch_video_file<P: AsRef<Path>>(
    file_path: P,
    metadata: &GoogleTakeoutMetadata,
    stitch_date: bool,
    stitch_gps: bool,
    stitch_description: bool,
    stitch_tags: bool,
) -> Result<bool, String> {
    let mut updated = false;

    // 1. If ExifTool is available, write QuickTime/MP4 container metadata
    if is_exiftool_available() {
        match write_with_exiftool(
            &file_path,
            metadata,
            stitch_date,
            stitch_gps,
            stitch_description,
            stitch_tags,
        ) {
            Ok(modified) => {
                if modified {
                    updated = true;
                }
            }
            Err(e) => {
                log::warn!("ExifTool video tagging warning for {:?}: {}", file_path.as_ref(), e);
            }
        }
    }

    // 2. Always sync filesystem timestamps for video sorting in OS explorers
    if stitch_date {
        if let Some(dt) = metadata.taken_datetime() {
            if let Err(e) = set_filesystem_datetime(&file_path, dt) {
                log::warn!("Could not set video filesystem timestamp: {}", e);
            } else {
                updated = true;
            }
        }
    }

    Ok(updated)
}

use crate::parser::GoogleTakeoutMetadata;
use little_exif::exif_tag::ExifTag;
use little_exif::metadata::Metadata;
use little_exif::rational::uR64;
use std::path::Path;
use std::process::Command;

/// Checks if ExifTool binary is installed and executable in system PATH
pub fn is_exiftool_available() -> bool {
    Command::new("exiftool")
        .arg("-ver")
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

/// Helper function to write metadata using ExifTool if available
pub fn write_with_exiftool<P: AsRef<Path>>(
    file_path: P,
    metadata: &GoogleTakeoutMetadata,
    stitch_date: bool,
    stitch_gps: bool,
    stitch_description: bool,
    stitch_tags: bool,
) -> Result<bool, String> {
    let mut cmd = Command::new("exiftool");
    cmd.arg("-overwrite_original");

    let mut has_args = false;

    // Date & Time tags
    if stitch_date {
        if let Some(date_str) = metadata.exif_date_time_original() {
            cmd.arg(format!("-AllDates={}", date_str));
            cmd.arg(format!("-DateTimeOriginal={}", date_str));
            cmd.arg(format!("-CreateDate={}", date_str));
            cmd.arg(format!("-ModifyDate={}", date_str));
            cmd.arg(format!("-QuickTime:CreationDate={}", date_str));
            cmd.arg(format!("-QuickTime:CreateDate={}", date_str));
            has_args = true;
        }
    }

    // GPS tags
    if stitch_gps {
        if let Some(geo) = metadata.valid_geo_data() {
            cmd.arg(format!("-GPSLatitude={}", geo.latitude));
            cmd.arg(format!("-GPSLatitudeRef={}", if geo.latitude >= 0.0 { "N" } else { "S" }));
            cmd.arg(format!("-GPSLongitude={}", geo.longitude));
            cmd.arg(format!("-GPSLongitudeRef={}", if geo.longitude >= 0.0 { "E" } else { "W" }));
            cmd.arg(format!("-GPSAltitude={}", geo.altitude));
            cmd.arg(format!("-GPSAltitudeRef={}", if geo.altitude >= 0.0 { "0" } else { "1" }));
            has_args = true;
        }
    }

    // Description / Caption
    if stitch_description {
        if let Some(desc) = metadata.clean_description() {
            cmd.arg(format!("-ImageDescription={}", desc));
            cmd.arg(format!("-Caption-Abstract={}", desc));
            cmd.arg(format!("-Description={}", desc));
            has_args = true;
        }
        if let Some(ref title) = metadata.title {
            if !title.is_empty() {
                cmd.arg(format!("-Title={}", title));
                cmd.arg(format!("-ObjectName={}", title));
                has_args = true;
            }
        }
    }

    // People / Keywords
    if stitch_tags {
        let people = metadata.people_names();
        if !people.is_empty() {
            for person in people {
                cmd.arg(format!("-Keywords+={}", person));
                cmd.arg(format!("-Subject+={}", person));
            }
            has_args = true;
        }
    }

    if !has_args {
        return Ok(false);
    }

    cmd.arg(file_path.as_ref().as_os_str());

    let output = cmd.output().map_err(|e| format!("Failed to run exiftool: {}", e))?;
    if output.status.success() {
        Ok(true)
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(if err.is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err
        })
    }
}

/// Native Rust EXIF writer for JPEG, PNG, TIFF, and WebP files using little_exif
pub fn write_native_image_exif<P: AsRef<Path>>(
    file_path: P,
    metadata: &GoogleTakeoutMetadata,
    stitch_date: bool,
    stitch_gps: bool,
    stitch_description: bool,
    _stitch_tags: bool,
) -> Result<bool, String> {
    let path = file_path.as_ref();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Check if format is supported natively by little_exif
    if !matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
        return Err(format!("Native EXIF writer does not support extension .{}", ext));
    }

    let mut exif_data = Metadata::new_from_path(path)
        .map_err(|e| format!("Could not read image file metadata: {:?}", e))?;

    let mut modified = false;

    // Stitch Date/Time
    if stitch_date {
        if let Some(date_str) = metadata.exif_date_time_original() {
            exif_data.set_tag(ExifTag::DateTimeOriginal(date_str.clone()));
            exif_data.set_tag(ExifTag::CreateDate(date_str.clone()));
            exif_data.set_tag(ExifTag::ModifyDate(date_str));
            modified = true;
        }
    }

    // Stitch GPS
    if stitch_gps {
        if let Some(geo) = metadata.valid_geo_data() {
            let lat_deg = geo.latitude.abs();
            let lon_deg = geo.longitude.abs();

            exif_data.set_tag(ExifTag::GPSLatitude(vec![
                uR64 { nominator: lat_deg.trunc() as u32, denominator: 1 },
                uR64 { nominator: ((lat_deg.fract() * 60.0).trunc()) as u32, denominator: 1 },
                uR64 { nominator: (((lat_deg.fract() * 60.0).fract() * 6000.0) as u32), denominator: 100 },
            ]));
            exif_data.set_tag(ExifTag::GPSLatitudeRef(if geo.latitude >= 0.0 {
                "N".to_string()
            } else {
                "S".to_string()
            }));

            exif_data.set_tag(ExifTag::GPSLongitude(vec![
                uR64 { nominator: lon_deg.trunc() as u32, denominator: 1 },
                uR64 { nominator: ((lon_deg.fract() * 60.0).trunc()) as u32, denominator: 1 },
                uR64 { nominator: (((lon_deg.fract() * 60.0).fract() * 6000.0) as u32), denominator: 100 },
            ]));
            exif_data.set_tag(ExifTag::GPSLongitudeRef(if geo.longitude >= 0.0 {
                "E".to_string()
            } else {
                "W".to_string()
            }));

            exif_data.set_tag(ExifTag::GPSAltitude(vec![
                uR64 { nominator: (geo.altitude.abs() * 100.0) as u32, denominator: 100 }
            ]));
            exif_data.set_tag(ExifTag::GPSAltitudeRef(vec![if geo.altitude >= 0.0 {
                0
            } else {
                1
            }]));

            modified = true;
        }
    }

    // Stitch Description
    if stitch_description {
        if let Some(desc) = metadata.clean_description() {
            exif_data.set_tag(ExifTag::ImageDescription(desc));
            modified = true;
        }
    }

    if modified {
        exif_data
            .write_to_file(path)
            .map_err(|e| format!("Failed to write EXIF metadata to file: {:?}", e))?;
    }

    Ok(modified)
}

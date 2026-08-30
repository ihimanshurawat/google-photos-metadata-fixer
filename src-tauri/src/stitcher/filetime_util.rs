use chrono::{DateTime, Utc};
use filetime::{set_file_times, FileTime};
use std::path::Path;

/// Sets the filesystem modification (mtime) and access (atime) times on a file
pub fn set_filesystem_timestamps<P: AsRef<Path>>(
    path: P,
    timestamp_secs: i64,
) -> Result<(), std::io::Error> {
    let file_time = FileTime::from_unix_time(timestamp_secs, 0);
    set_file_times(path, file_time, file_time)
}

/// Converts a chrono DateTime<Utc> to unix timestamp and updates the file
pub fn set_filesystem_datetime<P: AsRef<Path>>(
    path: P,
    datetime: DateTime<Utc>,
) -> Result<(), std::io::Error> {
    set_filesystem_timestamps(path, datetime.timestamp())
}

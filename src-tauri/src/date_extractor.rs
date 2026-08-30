use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use regex::Regex;

pub struct FilenameDateExtractor {
    // 1. Standard full timestamps: IMG_20210520_143022, VID_20210520_143022, PXL_20210520_143022...
    full_compact_regex: Regex,
    // 2. Separated timestamps: 2021-05-20_14-30-22, 2021-05-20 14.30.22, 2021.05.20_14.30.22
    separated_regex: Regex,
    // 3. Apple/Mac screenshot format: "Screen Shot 2021-05-20 at 2.30.45 PM"
    mac_screenshot_regex: Regex,
    // 4. WhatsApp format: IMG-20210520-WA0001 or VID-20210520-WA0001
    whatsapp_regex: Regex,
    // 5. Unix epoch millisecond timestamp: 1621521022000 (13 digits starting with 1[0-9])
    unix_millis_regex: Regex,
    // 6. Date only format: 2021-05-20 or 20210520
    date_only_regex: Regex,
}

impl Default for FilenameDateExtractor {
    fn default() -> Self {
        Self::new()
    }
}

impl FilenameDateExtractor {
    pub fn new() -> Self {
        Self {
            // e.g. IMG_20210520_143022 or 20210520_143022 or PXL_20210520_143022123
            full_compact_regex: Regex::new(
                r"(?:^|[^0-9])(20[0-3]\d|19[7-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-_T\s]([01]\d|2[0-3])([0-5]\d)([0-5]\d)",
            )
            .unwrap(),

            // e.g. 2021-05-20_14-30-22 or 2021.05.20 14.30.22 or 2021-05-20-14-30-22
            separated_regex: Regex::new(
                r"(?:^|[^0-9])(20[0-3]\d|19[7-9]\d)[-._](0[1-9]|1[0-2])[-._](0[1-9]|[12]\d|3[01])[-._T\s]+([01]\d|2[0-3])[-._:]([0-5]\d)[-._:]([0-5]\d)",
            )
            .unwrap(),

            // e.g. Screen Shot 2021-05-20 at 2.30.45 PM or 12.30.45 AM
            mac_screenshot_regex: Regex::new(
                r"(?i)(20[0-3]\d|19[7-9]\d)[-._](0[1-9]|1[0-2])[-._](0[1-9]|[12]\d|3[01])\s+at\s+([01]?\d)[-._:]([0-5]\d)[-._:]([0-5]\d)\s*(AM|PM)",
            )
            .unwrap(),

            // e.g. IMG-20210520-WA0001
            whatsapp_regex: Regex::new(
                r"(?i)(?:IMG|VID)[-_](20[0-3]\d|19[7-9]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[-_]WA",
            )
            .unwrap(),

            // e.g. 1621521022000 (13 digits between 1990 and 2035: 631152000000 to 2051222400000)
            unix_millis_regex: Regex::new(
                r"(?:^|[^0-9])(1[0-9]{12})(?:[^0-9]|$)",
            )
            .unwrap(),

            // e.g. 2021-05-20 or 20210520
            date_only_regex: Regex::new(
                r"(?:^|[^0-9])(20[0-3]\d|19[7-9]\d)[-._]?(0[1-9]|1[0-2])[-._]?(0[1-9]|[12]\d|3[01])(?:[^0-9]|$)",
            )
            .unwrap(),
        }
    }

    /// Attempts to extract a valid UTC DateTime from a filename
    pub fn extract_datetime(&self, filename: &str) -> Option<DateTime<Utc>> {
        // 1. Try Mac screenshot format (with AM/PM)
        if let Some(caps) = self.mac_screenshot_regex.captures(filename) {
            let year: i32 = caps[1].parse().ok()?;
            let month: u32 = caps[2].parse().ok()?;
            let day: u32 = caps[3].parse().ok()?;
            let mut hour: u32 = caps[4].parse().ok()?;
            let min: u32 = caps[5].parse().ok()?;
            let sec: u32 = caps[6].parse().ok()?;
            let am_pm = caps[7].to_uppercase();

            if am_pm == "PM" && hour < 12 {
                hour += 12;
            } else if am_pm == "AM" && hour == 12 {
                hour = 0;
            }

            if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
                if let Some(time) = NaiveTime::from_hms_opt(hour, min, sec) {
                    return Utc.from_local_datetime(&NaiveDateTime::new(date, time)).single();
                }
            }
        }

        // 2. Try compact full timestamp (IMG_20210520_143022)
        if let Some(caps) = self.full_compact_regex.captures(filename) {
            let year: i32 = caps[1].parse().ok()?;
            let month: u32 = caps[2].parse().ok()?;
            let day: u32 = caps[3].parse().ok()?;
            let hour: u32 = caps[4].parse().ok()?;
            let min: u32 = caps[5].parse().ok()?;
            let sec: u32 = caps[6].parse().ok()?;

            if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
                if let Some(time) = NaiveTime::from_hms_opt(hour, min, sec) {
                    return Utc.from_local_datetime(&NaiveDateTime::new(date, time)).single();
                }
            }
        }

        // 3. Try separated timestamp (2021-05-20_14-30-22 or 2021.05.20 14.30.22)
        if let Some(caps) = self.separated_regex.captures(filename) {
            let year: i32 = caps[1].parse().ok()?;
            let month: u32 = caps[2].parse().ok()?;
            let day: u32 = caps[3].parse().ok()?;
            let hour: u32 = caps[4].parse().ok()?;
            let min: u32 = caps[5].parse().ok()?;
            let sec: u32 = caps[6].parse().ok()?;

            if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
                if let Some(time) = NaiveTime::from_hms_opt(hour, min, sec) {
                    return Utc.from_local_datetime(&NaiveDateTime::new(date, time)).single();
                }
            }
        }

        // 4. Try WhatsApp format (IMG-20210520-WA0001) -> default to 12:00:00 noon
        if let Some(caps) = self.whatsapp_regex.captures(filename) {
            let year: i32 = caps[1].parse().ok()?;
            let month: u32 = caps[2].parse().ok()?;
            let day: u32 = caps[3].parse().ok()?;

            if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
                if let Some(time) = NaiveTime::from_hms_opt(12, 0, 0) {
                    return Utc.from_local_datetime(&NaiveDateTime::new(date, time)).single();
                }
            }
        }

        // 5. Try 13-digit Unix Millis timestamp
        if let Some(caps) = self.unix_millis_regex.captures(filename) {
            if let Ok(millis) = caps[1].parse::<i64>() {
                let secs = millis / 1000;
                if secs > 631152000 && secs < 2051222400 {
                    return Utc.timestamp_opt(secs, 0).single();
                }
            }
        }

        // 6. Try Date only format (2021-05-20 or 20210520) -> default to 12:00:00 noon
        if let Some(caps) = self.date_only_regex.captures(filename) {
            let year: i32 = caps[1].parse().ok()?;
            let month: u32 = caps[2].parse().ok()?;
            let day: u32 = caps[3].parse().ok()?;

            if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
                if let Some(time) = NaiveTime::from_hms_opt(12, 0, 0) {
                    return Utc.from_local_datetime(&NaiveDateTime::new(date, time)).single();
                }
            }
        }

        None
    }

    /// Formats extracted DateTime into EXIF standard `YYYY:MM:DD HH:MM:SS`
    pub fn format_exif_datetime(dt: &DateTime<Utc>) -> String {
        dt.format("%Y:%m:%d %H:%M:%S").to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_datetime_compact_android_pixel() {
        let extractor = FilenameDateExtractor::new();
        
        let dt1 = extractor.extract_datetime("IMG_20210815_143000.jpg").unwrap();
        assert_eq!(dt1.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-08-15 14:30:00");

        let dt2 = extractor.extract_datetime("PXL_20220930_081520123.jpg").unwrap();
        assert_eq!(dt2.format("%Y-%m-%d %H:%M:%S").to_string(), "2022-09-30 08:15:20");

        let dt3 = extractor.extract_datetime("VID_20200101_235959.mp4").unwrap();
        assert_eq!(dt3.format("%Y-%m-%d %H:%M:%S").to_string(), "2020-01-01 23:59:59");
    }

    #[test]
    fn test_extract_datetime_separated() {
        let extractor = FilenameDateExtractor::new();
        
        let dt = extractor.extract_datetime("2021-05-20 14.30.22.jpg").unwrap();
        assert_eq!(dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-05-20 14:30:22");

        let dt2 = extractor.extract_datetime("Screenshot_2023-01-15-12-30-45.png").unwrap();
        assert_eq!(dt2.format("%Y-%m-%d %H:%M:%S").to_string(), "2023-01-15 12:30:45");
    }

    #[test]
    fn test_extract_datetime_mac_screenshot() {
        let extractor = FilenameDateExtractor::new();
        
        let dt = extractor.extract_datetime("Screen Shot 2021-05-20 at 2.30.45 PM.png").unwrap();
        assert_eq!(dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-05-20 14:30:45");

        let dt2 = extractor.extract_datetime("Screen Shot 2021-05-20 at 12.15.00 AM.png").unwrap();
        assert_eq!(dt2.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-05-20 00:15:00");
    }

    #[test]
    fn test_extract_datetime_whatsapp() {
        let extractor = FilenameDateExtractor::new();
        
        let dt = extractor.extract_datetime("IMG-20210520-WA0001.jpg").unwrap();
        assert_eq!(dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-05-20 12:00:00");
    }

    #[test]
    fn test_extract_datetime_unix_millis() {
        let extractor = FilenameDateExtractor::new();
        
        // 1621521022000 is 2021-05-20 14:30:22 UTC
        let dt = extractor.extract_datetime("1621521022000.jpg").unwrap();
        assert_eq!(dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2021-05-20 14:30:22");
    }
}

use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTakeoutMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "imageViews")]
    pub image_views: Option<String>,
    #[serde(rename = "creationTime")]
    pub creation_time: Option<TimestampInfo>,
    #[serde(rename = "modificationTime")]
    pub modification_time: Option<TimestampInfo>,
    #[serde(rename = "photoTakenTime")]
    pub photo_taken_time: Option<TimestampInfo>,
    #[serde(rename = "geoData")]
    pub geo_data: Option<GeoData>,
    #[serde(rename = "geoDataExif")]
    pub geo_data_exif: Option<GeoData>,
    pub people: Option<Vec<Person>>,
    pub favorited: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampInfo {
    #[serde(deserialize_with = "deserialize_timestamp")]
    pub timestamp: i64,
    pub formatted: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoData {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    #[serde(rename = "latitudeSpan")]
    pub latitude_span: Option<f64>,
    #[serde(rename = "longitudeSpan")]
    pub longitude_span: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Person {
    pub name: String,
}

/// Custom deserializer to handle both string ("1597483800") and number (1597483800) formats
fn deserialize_timestamp<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrInt {
        String(String),
        Int(i64),
    }

    match StringOrInt::deserialize(deserializer)? {
        StringOrInt::String(s) => s.parse::<i64>().map_err(serde::de::Error::custom),
        StringOrInt::Int(i) => Ok(i),
    }
}

impl GoogleTakeoutMetadata {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let metadata: GoogleTakeoutMetadata = serde_json::from_reader(reader)?;
        Ok(metadata)
    }

    /// Best available unix timestamp for when the photo/video was taken
    pub fn taken_timestamp(&self) -> Option<i64> {
        if let Some(ref taken) = self.photo_taken_time {
            if taken.timestamp > 0 {
                return Some(taken.timestamp);
            }
        }
        if let Some(ref creation) = self.creation_time {
            if creation.timestamp > 0 {
                return Some(creation.timestamp);
            }
        }
        if let Some(ref modified) = self.modification_time {
            if modified.timestamp > 0 {
                return Some(modified.timestamp);
            }
        }
        None
    }

    /// Returns the DateTime in UTC
    pub fn taken_datetime(&self) -> Option<DateTime<Utc>> {
        self.taken_timestamp().and_then(|ts| Utc.timestamp_opt(ts, 0).single())
    }

    /// Formats as EXIF standard `YYYY:MM:DD HH:MM:SS`
    pub fn exif_date_time_original(&self) -> Option<String> {
        self.taken_datetime().map(|dt| dt.format("%Y:%m:%d %H:%M:%S").to_string())
    }

    /// Best available GPS coordinates: (latitude, longitude, altitude)
    /// Returns None if coordinates are 0.0, 0.0 (Google default when no location)
    pub fn valid_geo_data(&self) -> Option<&GeoData> {
        if let Some(ref geo) = self.geo_data {
            if geo.latitude != 0.0 || geo.longitude != 0.0 {
                return Some(geo);
            }
        }
        if let Some(ref geo_exif) = self.geo_data_exif {
            if geo_exif.latitude != 0.0 || geo_exif.longitude != 0.0 {
                return Some(geo_exif);
            }
        }
        None
    }

    pub fn clean_description(&self) -> Option<String> {
        self.description.as_ref().map(|d| d.trim().to_string()).filter(|d| !d.is_empty())
    }

    pub fn people_names(&self) -> Vec<String> {
        match self.people {
            Some(ref list) => list.iter().map(|p| p.name.clone()).filter(|n| !n.trim().is_empty()).collect(),
            None => Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_json() {
        let json = r#"{
            "title": "IMG_20200815.jpg",
            "description": "Beach sunset",
            "imageViews": "0",
            "creationTime": {
                "timestamp": "1597483800",
                "formatted": "Aug 15, 2020, 9:30:00 AM UTC"
            },
            "photoTakenTime": {
                "timestamp": 1597483800,
                "formatted": "Aug 15, 2020, 9:30:00 AM UTC"
            },
            "geoData": {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "altitude": 10.0
            },
            "people": [
                { "name": "Alice" },
                { "name": "Bob" }
            ],
            "favorited": true
        }"#;

        let meta: GoogleTakeoutMetadata = serde_json::from_str(json).unwrap();
        assert_eq!(meta.title.as_deref().unwrap(), "IMG_20200815.jpg");
        assert_eq!(meta.taken_timestamp(), Some(1597483800));
        assert_eq!(meta.exif_date_time_original(), Some("2020:08:15 09:30:00".to_string()));
        let geo = meta.valid_geo_data().unwrap();
        assert_eq!(geo.latitude, 37.7749);
        assert_eq!(meta.people_names(), vec!["Alice".to_string(), "Bob".to_string()]);
    }
}

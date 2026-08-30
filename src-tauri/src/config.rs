use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, Write};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub custom_json_patterns: Vec<String>,
    pub custom_media_extensions: Vec<String>,
    pub ignored_json_names: Vec<String>,
    pub date_fallback_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self::default_config()
    }
}

impl AppConfig {
    pub fn default_config() -> Self {
        Self {
            custom_json_patterns: vec![
                // 1. Modern Google Takeout .supplemental-metadata scheme
                "{filename}.supplemental-metadata.json".to_string(),
                "{stem}.supplemental-metadata.json".to_string(),
                "{stem}-supplemental-metadata.json".to_string(),
                "{stem}.supp.json".to_string(),
                // 2. Duplicate numbered formats
                "{base_stem}.{ext}.supplemental-metadata({num}).json".to_string(),
                "{base_stem}.{ext}({num}).supplemental-metadata.json".to_string(),
                "{base_stem}({num}).{ext}.supplemental-metadata.json".to_string(),
                "{base_stem}.supplemental-metadata({num}).json".to_string(),
                "{base_stem}({num}).supplemental-metadata.json".to_string(),
                // 3. Classic Takeout .json formats
                "{filename}.json".to_string(),
                "{stem}.json".to_string(),
                "{base_stem}.{ext}({num}).json".to_string(),
                "{base_stem}({num}).{ext}.json".to_string(),
                "{base_stem}({num}).json".to_string(),
                "{base_stem}.json".to_string(),
                // 4. Live Photo video pairs
                "{stem}.heic.supplemental-metadata.json".to_string(),
                "{stem}.HEIC.supplemental-metadata.json".to_string(),
                "{stem}.jpg.supplemental-metadata.json".to_string(),
                "{stem}.JPG.supplemental-metadata.json".to_string(),
                "{stem}.heic.json".to_string(),
                "{stem}.jpg.json".to_string(),
            ],
            custom_media_extensions: vec![
                // Photos
                "jpg".to_string(),
                "jpeg".to_string(),
                "png".to_string(),
                "heic".to_string(),
                "heif".to_string(),
                "webp".to_string(),
                "gif".to_string(),
                "bmp".to_string(),
                "tiff".to_string(),
                "tif".to_string(),
                "avif".to_string(),
                // Camera RAW
                "dng".to_string(),
                "cr2".to_string(),
                "cr3".to_string(),
                "nef".to_string(),
                "arw".to_string(),
                "orf".to_string(),
                "rw2".to_string(),
                "pef".to_string(),
                "raf".to_string(),
                // Videos
                "mp4".to_string(),
                "mov".to_string(),
                "m4v".to_string(),
                "avi".to_string(),
                "mkv".to_string(),
                "webm".to_string(),
                "3gp".to_string(),
                "wmv".to_string(),
                "mpg".to_string(),
                "mpeg".to_string(),
            ],
            ignored_json_names: vec![
                "metadata.json".to_string(),
                "print-subscriptions.json".to_string(),
                "user-generated-memory-title.json".to_string(),
                "shared_album_comments.json".to_string(),
                "remember-list.json".to_string(),
                "archive_browser.json".to_string(),
            ],
            date_fallback_enabled: true,
        }
    }

    /// Path to user configuration file on disk
    pub fn config_path() -> PathBuf {
        #[cfg(target_os = "windows")]
        let base_dir = std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."));

        #[cfg(not(target_os = "windows"))]
        let base_dir = std::env::var("HOME")
            .map(|h| PathBuf::from(h).join(".config"))
            .unwrap_or_else(|_| PathBuf::from("."));

        base_dir.join("takeout-stitcher").join("config.json")
    }

    /// Loads configuration from file, falling back to defaults if not found or corrupted
    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(file) = File::open(&path) {
                let reader = BufReader::new(file);
                if let Ok(config) = serde_json::from_reader(reader) {
                    return config;
                }
            }
        }
        Self::default_config()
    }

    /// Saves configuration to file
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let json_str = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        let mut file = File::create(&path)
            .map_err(|e| format!("Failed to write config file {}: {}", path.display(), e))?;

        file.write_all(json_str.as_bytes())
            .map_err(|e| format!("Failed to write config content: {}", e))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default_config();
        assert!(config.custom_json_patterns.iter().any(|p| p.contains("supplemental-metadata")));
        assert!(config.custom_media_extensions.contains(&"jpg".to_string()));
        assert!(config.custom_media_extensions.contains(&"heic".to_string()));
        assert!(config.ignored_json_names.contains(&"metadata.json".to_string()));
    }
}

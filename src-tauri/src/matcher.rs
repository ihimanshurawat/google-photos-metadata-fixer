use crate::config::AppConfig;
use crate::date_extractor::FilenameDateExtractor;
use chrono::{DateTime, Utc};
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct MediaJsonPair {
    pub media_path: PathBuf,
    pub json_path: Option<PathBuf>,
    pub file_name: String,
    pub extension: String,
    pub is_video: bool,
    pub fallback_datetime: Option<DateTime<Utc>>,
    pub fallback_date_str: Option<String>,
}

pub struct TakeoutMatcher {
    config: AppConfig,
    duplicate_regex: Regex,
    edited_regex: Regex,
    date_extractor: FilenameDateExtractor,
}

impl Default for TakeoutMatcher {
    fn default() -> Self {
        Self::new()
    }
}

impl TakeoutMatcher {
    pub fn new() -> Self {
        Self::with_config(AppConfig::load())
    }

    pub fn with_config(config: AppConfig) -> Self {
        Self {
            config,
            duplicate_regex: Regex::new(r"^(.*?)\((\d+)\)$").unwrap(),
            edited_regex: Regex::new(r"^(.*?)(?:[-_]edited|[-_]effects)$").unwrap(),
            date_extractor: FilenameDateExtractor::new(),
        }
    }

    pub fn update_config(&mut self, config: AppConfig) {
        self.config = config;
    }

    /// Checks if the file path has a supported media extension
    pub fn is_media_file<P: AsRef<Path>>(&self, path: P) -> bool {
        if let Some(ext) = path.as_ref().extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            return self.config.custom_media_extensions.iter().any(|e| e.eq_ignore_ascii_case(&ext_lower));
        }
        false
    }

    /// Checks if a file is a video
    pub fn is_video_file<P: AsRef<Path>>(path: P) -> bool {
        if let Some(ext) = path.as_ref().extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            return matches!(
                ext_lower.as_str(),
                "mp4" | "mov" | "m4v" | "avi" | "mkv" | "webm" | "3gp" | "wmv" | "mpg" | "mpeg"
            );
        }
        false
    }

    /// Checks if the JSON file is a standard sidecar and not ignored metadata
    pub fn is_valid_sidecar_json<P: AsRef<Path>>(&self, path: P) -> bool {
        let file_name = path
            .as_ref()
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !file_name.ends_with(".json") {
            return false;
        }

        !self.config.ignored_json_names.iter().any(|ig| ig.eq_ignore_ascii_case(&file_name))
    }

    /// Interpolates template variables in a pattern string
    pub fn interpolate_pattern(
        template: &str,
        file_name: &str,
        stem: &str,
        ext: &str,
        num: Option<&str>,
        base_stem: Option<&str>,
    ) -> Option<String> {
        let requires_num = template.contains("{num}") || template.contains("{base_stem}");
        if requires_num && (num.is_none() || base_stem.is_none()) {
            return None;
        }

        let mut res = template.to_string();
        res = res.replace("{filename}", file_name);
        res = res.replace("{stem}", stem);
        res = res.replace("{ext}", ext);
        if let Some(n) = num {
            res = res.replace("{num}", n);
        }
        if let Some(b) = base_stem {
            res = res.replace("{base_stem}", b);
        }

        Some(res)
    }

    /// Generates candidate JSON filenames for a given media file in priority order
    pub fn candidate_json_names(&self, media_file_name: &str) -> Vec<String> {
        let mut candidates = Vec::new();
        let mut seen = HashSet::new();

        let mut add_candidate = |cand: String| {
            if !cand.is_empty() && seen.insert(cand.clone()) {
                candidates.push(cand);
            }
        };

        let path = Path::new(media_file_name);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(media_file_name);
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        let (num, base_stem) = if let Some(caps) = self.duplicate_regex.captures(stem) {
            let b = caps.get(1).map(|m| m.as_str());
            let n = caps.get(2).map(|m| m.as_str());
            (n, b)
        } else {
            (None, None)
        };

        // 1. Evaluate configured user templates in order
        for template in &self.config.custom_json_patterns {
            if let Some(cand) = Self::interpolate_pattern(template, media_file_name, stem, ext, num, base_stem) {
                add_candidate(cand);
            }
        }

        // 2. Edited suffix heuristics: `IMG_1234-edited.jpg` -> `IMG_1234.supplemental-metadata.json`
        if let Some(caps) = self.edited_regex.captures(stem) {
            let original_stem = &caps[1];
            if !ext.is_empty() {
                add_candidate(format!("{}.{}.supplemental-metadata.json", original_stem, ext));
                add_candidate(format!("{}.{}.json", original_stem, ext));
            }
            add_candidate(format!("{}.supplemental-metadata.json", original_stem));
            add_candidate(format!("{}.json", original_stem));
        }

        candidates
    }

    /// Global 2-pass indexing and matching across all extracted Takeout directories
    pub fn scan_and_match_all<P: AsRef<Path>>(
        &self,
        root_path: P,
    ) -> (Vec<MediaJsonPair>, usize, usize) {
        let mut all_media_paths: Vec<PathBuf> = Vec::new();
        let mut local_json_map: HashMap<PathBuf, HashMap<String, PathBuf>> = HashMap::new();
        let mut global_json_map: HashMap<String, PathBuf> = HashMap::new();
        let mut all_json_paths: HashSet<PathBuf> = HashSet::new();

        // PASS 1: Index all files and folders
        for entry in WalkDir::new(root_path.as_ref()).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if self.is_valid_sidecar_json(path) {
                    if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                        let lower_name = file_name.to_lowercase();
                        let parent = path.parent().unwrap_or_else(|| Path::new("")).to_path_buf();
                        
                        local_json_map
                            .entry(parent)
                            .or_default()
                            .insert(lower_name.clone(), path.to_path_buf());

                        global_json_map.insert(lower_name, path.to_path_buf());
                        all_json_paths.insert(path.to_path_buf());
                    }
                } else if self.is_media_file(path) {
                    all_media_paths.push(path.to_path_buf());
                }
            }
        }

        // PASS 2: Match media files
        let mut pairs = Vec::new();
        let mut used_jsons = HashSet::new();
        let mut dates_recovered_from_filename = 0;

        for media_path in all_media_paths {
            let file_name = media_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let ext = media_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            let is_video = Self::is_video_file(&media_path);

            let candidates = self.candidate_json_names(&file_name);
            let mut matched_json: Option<PathBuf> = None;
            let parent_dir = media_path.parent().unwrap_or_else(|| Path::new(""));

            // 1. Check local directory candidates first
            if let Some(dir_jsons) = local_json_map.get(parent_dir) {
                for cand in &candidates {
                    let cand_lower = cand.to_lowercase();
                    if let Some(json_path) = dir_jsons.get(&cand_lower) {
                        matched_json = Some(json_path.clone());
                        used_jsons.insert(json_path.clone());
                        break;
                    }
                }

                // Local prefix match for truncated Google Takeout filenames (35-45 chars)
                if matched_json.is_none() && file_name.len() >= 35 {
                    let stem = Path::new(&file_name)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or(&file_name);
                    let prefix_len = stem.len().min(40);
                    let prefix = &stem[..prefix_len].to_lowercase();

                    for (json_name, json_path) in dir_jsons {
                        if json_name.starts_with(prefix) && !used_jsons.contains(json_path) {
                            matched_json = Some(json_path.clone());
                            used_jsons.insert(json_path.clone());
                            break;
                        }
                    }
                }
            }

            // 2. Check GLOBAL library index (cross-archive matches)
            if matched_json.is_none() {
                for cand in &candidates {
                    let cand_lower = cand.to_lowercase();
                    if let Some(json_path) = global_json_map.get(&cand_lower) {
                        matched_json = Some(json_path.clone());
                        used_jsons.insert(json_path.clone());
                        break;
                    }
                }
            }

            // 3. Fallback: Parse Date & Time from Filename if enabled and no JSON
            let fallback_dt = if self.config.date_fallback_enabled {
                self.date_extractor.extract_datetime(&file_name)
            } else {
                None
            };
            let fallback_str = fallback_dt.map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());

            if fallback_dt.is_some() && matched_json.is_none() {
                dates_recovered_from_filename += 1;
            }

            pairs.push(MediaJsonPair {
                media_path,
                json_path: matched_json,
                file_name,
                extension: ext,
                is_video,
                fallback_datetime: fallback_dt,
                fallback_date_str: fallback_str,
            });
        }

        let orphaned_jsons_count = all_json_paths.len().saturating_sub(used_jsons.len());
        (pairs, orphaned_jsons_count, dates_recovered_from_filename)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_pattern_interpolation() {
        let pattern1 = "{filename}.custom-meta.json";
        let res1 = TakeoutMatcher::interpolate_pattern(pattern1, "photo.jpg", "photo", "jpg", None, None).unwrap();
        assert_eq!(res1, "photo.jpg.custom-meta.json");

        let pattern2 = "{base_stem}.{ext}.meta({num}).json";
        let res2 = TakeoutMatcher::interpolate_pattern(pattern2, "photo(2).jpg", "photo(2)", "jpg", Some("2"), Some("photo")).unwrap();
        assert_eq!(res2, "photo.jpg.meta(2).json");

        // Non-duplicate file should skip duplicate template
        let res3 = TakeoutMatcher::interpolate_pattern(pattern2, "photo.jpg", "photo", "jpg", None, None);
        assert!(res3.is_none());
    }

    #[test]
    fn test_candidate_generation_with_config() {
        let mut config = AppConfig::default_config();
        config.custom_json_patterns.insert(0, "{stem}.custom-google-v2.json".to_string());

        let matcher = TakeoutMatcher::with_config(config);
        let candidates = matcher.candidate_json_names("IMG_2024.jpg");
        assert_eq!(candidates[0], "IMG_2024.custom-google-v2.json");
    }
}

use crate::config::AppConfig;
use crate::diagnostics::log_event;
use crate::matcher::{MediaJsonPair, TakeoutMatcher};
use crate::stitcher::{stitch_media_item, ProcessOptions};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanSummary {
    pub total_media: usize,
    pub matched_pairs: usize,
    pub unmatched_media: usize,
    pub orphaned_jsons: usize,
    pub image_count: usize,
    pub video_count: usize,
    pub directories_scanned: usize,
    pub dates_from_filename: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub processed: usize,
    pub total: usize,
    pub percentage: f64,
    pub speed_items_sec: f64,
    pub eta_seconds: u64,
    pub current_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String, // "info", "warn", "error", "success"
    pub file_name: String,
    pub message: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessSummary {
    pub total_files: usize,
    pub processed: usize,
    pub successful: usize,
    pub failed: usize,
    pub skipped: usize,
    pub elapsed_seconds: f64,
}

pub struct TakeoutProcessor {
    is_cancelled: Arc<AtomicBool>,
}

impl Default for TakeoutProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl TakeoutProcessor {
    pub fn new() -> Self {
        Self {
            is_cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.is_cancelled.store(true, Ordering::SeqCst);
    }

    pub fn reset_cancel(&self) {
        self.is_cancelled.store(false, Ordering::SeqCst);
    }

    pub fn is_cancelled_flag(&self) -> Arc<AtomicBool> {
        self.is_cancelled.clone()
    }

    /// Global multi-pass scan: indexes all JSONs across entire library & pairs media with user config
    pub fn scan_takeout_dir<P: AsRef<Path>>(
        &self,
        root_path: P,
        config: Option<&AppConfig>,
    ) -> (ScanSummary, Vec<MediaJsonPair>) {
        let matcher = match config {
            Some(c) => TakeoutMatcher::with_config(c.clone()),
            None => TakeoutMatcher::new(),
        };
        let (pairs, orphaned_jsons, dates_from_filename) = matcher.scan_and_match_all(root_path.as_ref());

        let mut total_media = 0;
        let mut matched_pairs = 0;
        let mut image_count = 0;
        let mut video_count = 0;

        for pair in &pairs {
            total_media += 1;
            if pair.json_path.is_some() {
                matched_pairs += 1;
            }
            if pair.is_video {
                video_count += 1;
            } else {
                image_count += 1;
            }
        }

        let summary = ScanSummary {
            total_media,
            matched_pairs,
            unmatched_media: total_media.saturating_sub(matched_pairs),
            orphaned_jsons,
            image_count,
            video_count,
            directories_scanned: 1,
            dates_from_filename,
        };

        log_event(
            "INFO",
            "SCAN",
            "SCAN_COMPLETED",
            &format!(
                "Scanned {} total media ({} matched JSONs, {} filename dates, {} unmatched, {} orphaned JSONs)",
                total_media, matched_pairs, dates_from_filename, summary.unmatched_media, orphaned_jsons
            ),
        );

        (summary, pairs)
    }

    /// Batch processes pairs concurrently using Rayon and emits throttled live Tauri events
    pub fn process_batch(
        &self,
        app: AppHandle,
        pairs: Vec<MediaJsonPair>,
        options: ProcessOptions,
    ) -> ProcessSummary {
        self.reset_cancel();

        let total = pairs.len();
        log_event(
            "INFO",
            "BATCH",
            "START_PROCESSING",
            &format!(
                "Batch initiated for {} items. Folder mode: {:?}, Dry run: {}, Output dir: {:?}",
                total, options.folder_structure, options.dry_run, options.output_dir
            ),
        );

        let processed_count = Arc::new(AtomicUsize::new(0));
        let success_count = Arc::new(AtomicUsize::new(0));
        let error_count = Arc::new(AtomicUsize::new(0));
        let skipped_count = Arc::new(AtomicUsize::new(0));

        let start_time = Instant::now();
        let last_emit_ms = Arc::new(AtomicU64::new(0));
        let cancel_flag = self.is_cancelled.clone();

        // Process in parallel using Rayon thread pool
        pairs.par_iter().for_each(|pair| {
            if cancel_flag.load(Ordering::SeqCst) {
                return;
            }

            let report = stitch_media_item(
                &pair.media_path,
                pair.json_path.as_deref(),
                &options,
            );

            let current_processed = processed_count.fetch_add(1, Ordering::SeqCst) + 1;
            if !report.has_json && report.date_source == "none" {
                skipped_count.fetch_add(1, Ordering::SeqCst);
            } else if report.success {
                success_count.fetch_add(1, Ordering::SeqCst);
            } else {
                error_count.fetch_add(1, Ordering::SeqCst);
                log_event(
                    "ERROR",
                    "STITCH_FAIL",
                    &report.file_name,
                    &format!("Error: {}", report.message),
                );
            }

            let elapsed = start_time.elapsed();
            let elapsed_sec = elapsed.as_secs_f64();
            let elapsed_millis = elapsed.as_millis() as u64;

            let prev_emit = last_emit_ms.load(Ordering::Relaxed);
            let should_emit = elapsed_millis.saturating_sub(prev_emit) >= 150
                || current_processed == total
                || current_processed == 1;

            if should_emit && last_emit_ms.compare_exchange(prev_emit, elapsed_millis, Ordering::SeqCst, Ordering::Relaxed).is_ok() {
                let speed = if elapsed_sec > 0.1 {
                    (current_processed as f64) / elapsed_sec
                } else {
                    0.0
                };

                let remaining = if total > current_processed {
                    total - current_processed
                } else {
                    0
                };
                let eta = if speed > 0.0 {
                    (remaining as f64 / speed) as u64
                } else {
                    0
                };

                let _ = app.emit(
                    "process-progress",
                    ProgressPayload {
                        processed: current_processed,
                        total,
                        percentage: if total > 0 {
                            (current_processed as f64 / total as f64) * 100.0
                        } else {
                            100.0
                        },
                        speed_items_sec: (speed * 10.0).round() / 10.0,
                        eta_seconds: eta,
                        current_file: report.file_name.clone(),
                    },
                );
            }

            // Emit log event for warnings/errors or sampled successes
            if !report.has_json || !report.success || current_processed % 50 == 0 || current_processed == total {
                let level = if !report.success {
                    "error"
                } else if report.has_json || report.date_source != "none" {
                    "success"
                } else {
                    "warn"
                };

                let _ = app.emit(
                    "process-log",
                    LogEntry {
                        timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                        level: level.to_string(),
                        file_name: report.file_name,
                        message: report.message,
                        success: report.success,
                    },
                );
            }
        });

        let elapsed_seconds = start_time.elapsed().as_secs_f64();
        let summary = ProcessSummary {
            total_files: total,
            processed: processed_count.load(Ordering::SeqCst),
            successful: success_count.load(Ordering::SeqCst),
            failed: error_count.load(Ordering::SeqCst),
            skipped: skipped_count.load(Ordering::SeqCst),
            elapsed_seconds: (elapsed_seconds * 10.0).round() / 10.0,
        };

        log_event(
            "INFO",
            "BATCH",
            "BATCH_COMPLETED",
            &format!(
                "Processed: {}/{}, Successful: {}, Failed: {}, Skipped: {}, Time: {:.1}s",
                summary.processed, summary.total_files, summary.successful, summary.failed, summary.skipped, summary.elapsed_seconds
            ),
        );

        let _ = app.emit("process-complete", summary.clone());
        summary
    }
}

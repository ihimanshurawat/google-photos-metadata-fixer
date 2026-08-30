export interface ScanSummary {
  total_media: number;
  matched_pairs: number;
  unmatched_media: number;
  orphaned_jsons: number;
  image_count: number;
  video_count: number;
  directories_scanned: number;
  dates_from_filename: number;
}

export interface MediaPairDto {
  media_path: string;
  json_path: string | null;
  file_name: string;
  extension: string;
  is_video: boolean;
  fallback_date_str: string | null;
}

export interface ScanResponse {
  summary: ScanSummary;
  pairs_preview: MediaPairDto[];
  total_pairs_count: number;
  staging_dir?: string | null;
}

export type FolderStructureMode = 'preserve' | 'date' | 'flat';

export interface ProcessOptions {
  stitch_date: boolean;
  stitch_gps: boolean;
  stitch_description: boolean;
  stitch_tags: boolean;
  sync_file_timestamps: boolean;
  delete_json_after: boolean;
  dry_run: boolean;
  output_dir: string | null;
  organize_by_date: boolean;
  folder_structure?: FolderStructureMode;
  source_root?: string | null;
}

export interface ProgressPayload {
  processed: number;
  total: number;
  percentage: number;
  speed_items_sec: number;
  eta_seconds: number;
  current_file: string;
}

export interface ZipFileInfo {
  file_name: string;
  path: string;
  size_bytes: number;
  formatted_size: string;
}

export interface ExtractionProgressPayload {
  current_zip_index: number;
  total_zips: number;
  current_zip_name: string;
  files_extracted: number;
  total_files_in_zip: number;
  bytes_extracted: number;
  total_bytes: number;
  formatted_bytes_extracted: string;
  formatted_total_bytes: string;
  overall_percentage: number;
  speed_mb_sec: number;
  current_file: string;
}

export interface ExtractionCompletePayload {
  staging_dir: string;
  total_files_extracted: number;
  elapsed_seconds: number;
}

export interface StorageInfo {
  staging_paths: string[];
  total_bytes: number;
  formatted_total_size: string;
  has_cache: boolean;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  file_name: string;
  message: string;
  success: boolean;
}

export interface ProcessSummary {
  total_files: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  elapsed_seconds: number;
}

export interface SystemStatus {
  exiftool_available: boolean;
  os_name: string;
}

export interface PreviewDto {
  title: string | null;
  description: string | null;
  date_taken: string | null;
  timestamp: number | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  people: string[];
  date_source: string;
}

export interface AppConfig {
  custom_json_patterns: string[];
  custom_media_extensions: string[];
  ignored_json_names: string[];
  date_fallback_enabled: boolean;
}

export interface SystemDetails {
  app_name: string;
  app_version: string;
  os_name: string;
  os_version: string;
  os_build: string;
  kernel_version: string;
  architecture: string;
  hardware_model: string;
  cpu_cores: number;
  total_memory: string;
  log_storage_path: string;
}

export interface DiagnosticInfoDto {
  log_dir: string;
  recent_logs: string[];
  os_name: string;
  system_details: SystemDetails;
}


use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

const LOG_APP_NAME: &str = "Google Photos Metadata Fixer";
const LOG_LINUX_NAME: &str = "takeout-stitcher";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemDetails {
    pub app_name: String,
    pub app_version: String,
    pub os_name: String,
    pub os_version: String,
    pub os_build: String,
    pub kernel_version: String,
    pub architecture: String,
    pub hardware_model: String,
    pub cpu_cores: usize,
    pub total_memory: String,
    pub log_storage_path: String,
}

/// Returns detailed, accurate OS and hardware information for diagnostics
pub fn get_system_details() -> SystemDetails {
    let cpu_cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let arch = std::env::consts::ARCH.to_string();

    #[cfg(target_os = "macos")]
    {
        let mut os_version = String::new();
        let mut build_version = String::new();
        let mut kernel_version = String::new();
        let mut hardware_model = String::new();
        let mut total_memory = String::new();

        if let Ok(out) = std::process::Command::new("sw_vers").output() {
            let s = String::from_utf8_lossy(&out.stdout);
            for line in s.lines() {
                if let Some((k, v)) = line.split_once(':') {
                    let key = k.trim();
                    let val = v.trim();
                    if key == "ProductVersion" {
                        os_version = val.to_string();
                    } else if key == "BuildVersion" {
                        build_version = val.to_string();
                    }
                }
            }
        }

        if let Ok(out) = std::process::Command::new("sysctl").args(["-n", "kern.osrelease"]).output() {
            let k = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !k.is_empty() {
                kernel_version = format!("Darwin {}", k);
            }
        }

        if let Ok(out) = std::process::Command::new("sysctl").args(["-n", "hw.model"]).output() {
            hardware_model = String::from_utf8_lossy(&out.stdout).trim().to_string();
        }

        if let Ok(out) = std::process::Command::new("sysctl").args(["-n", "hw.memsize"]).output() {
            if let Ok(bytes) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
                total_memory = format!("{:.2} GB RAM", (bytes as f64) / (1024.0 * 1024.0 * 1024.0));
            }
        }

        let os_pretty = if !os_version.is_empty() {
            let major = os_version.split('.').next().unwrap_or("");
            let marketing = match major {
                "26" => " (Tahoe / Future)",
                "15" => " (Sequoia)",
                "14" => " (Sonoma)",
                "13" => " (Ventura)",
                "12" => " (Monterey)",
                "11" => " (Big Sur)",
                _ => "",
            };
            format!("macOS {}{}", os_version, marketing)
        } else {
            "macOS".to_string()
        };

        return SystemDetails {
            app_name: LOG_APP_NAME.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            os_name: "macOS".to_string(),
            os_version: os_pretty,
            os_build: if build_version.is_empty() { "Unknown Build".to_string() } else { format!("Build {}", build_version) },
            kernel_version: if kernel_version.is_empty() { "Darwin".to_string() } else { kernel_version },
            architecture: if arch == "aarch64" { "Apple Silicon (aarch64)".to_string() } else { arch },
            hardware_model: if hardware_model.is_empty() { "Apple Mac".to_string() } else { hardware_model },
            cpu_cores,
            total_memory: if total_memory.is_empty() { "Unknown".to_string() } else { total_memory },
            log_storage_path: get_os_log_dir().to_string_lossy().to_string(),
        };
    }

    #[cfg(target_os = "linux")]
    {
        let mut distro_name = "Linux".to_string();
        let mut kernel_version = String::new();
        let mut total_memory = String::new();

        if let Ok(content) = fs::read_to_string("/etc/os-release") {
            for line in content.lines() {
                if line.starts_with("PRETTY_NAME=") {
                    distro_name = line.trim_start_matches("PRETTY_NAME=").trim_matches('"').to_string();
                    break;
                }
            }
        }

        if let Ok(out) = std::process::Command::new("uname").arg("-r").output() {
            kernel_version = String::from_utf8_lossy(&out.stdout).trim().to_string();
        }

        if let Ok(content) = fs::read_to_string("/proc/meminfo") {
            for line in content.lines() {
                if line.starts_with("MemTotal:") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        if let Ok(kb) = parts[1].parse::<u64>() {
                            total_memory = format!("{:.2} GB RAM", (kb as f64) / (1024.0 * 1024.0));
                        }
                    }
                    break;
                }
            }
        }

        return SystemDetails {
            app_name: LOG_APP_NAME.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            os_name: "Linux".to_string(),
            os_version: distro_name,
            os_build: kernel_version.clone(),
            kernel_version,
            architecture: arch,
            hardware_model: "Linux PC / Server".to_string(),
            cpu_cores,
            total_memory: if total_memory.is_empty() { "Unknown".to_string() } else { total_memory },
            log_storage_path: get_os_log_dir().to_string_lossy().to_string(),
        };
    }

    #[cfg(target_os = "windows")]
    {
        let mut win_ver = "Windows".to_string();
        if let Ok(out) = std::process::Command::new("cmd").args(["/c", "ver"]).output() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                win_ver = s;
            }
        }

        return SystemDetails {
            app_name: LOG_APP_NAME.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            os_name: "Windows".to_string(),
            os_version: win_ver.clone(),
            os_build: win_ver,
            kernel_version: "Windows NT".to_string(),
            architecture: arch,
            hardware_model: "Windows PC".to_string(),
            cpu_cores,
            total_memory: "System Managed".to_string(),
            log_storage_path: get_os_log_dir().to_string_lossy().to_string(),
        };
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        SystemDetails {
            app_name: LOG_APP_NAME.to_string(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            os_name: std::env::consts::OS.to_string(),
            os_version: format!("{} {}", std::env::consts::OS, std::env::consts::FAMILY),
            os_build: "Generic".to_string(),
            kernel_version: "Generic".to_string(),
            architecture: arch,
            hardware_model: "Generic Device".to_string(),
            cpu_cores,
            total_memory: "Unknown".to_string(),
            log_storage_path: get_os_log_dir().to_string_lossy().to_string(),
        }
    }
}

/// Returns the standard OS-recommended log directory:
/// - macOS: ~/Library/Logs/Google Photos Metadata Fixer
/// - Windows: %LOCALAPPDATA%\Google Photos Metadata Fixer\logs
/// - Linux: ~/.local/state/takeout-stitcher/logs (XDG State directory)
pub fn get_os_log_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            return home.join("Library").join("Logs").join(LOG_APP_NAME);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(local_app_data) = dirs::data_local_dir() {
            return local_app_data.join(LOG_APP_NAME).join("logs");
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(state_dir) = dirs::state_dir() {
            return state_dir.join(LOG_LINUX_NAME).join("logs");
        }
        if let Some(home) = dirs::home_dir() {
            return home.join(".local").join("state").join(LOG_LINUX_NAME).join("logs");
        }
    }

    // Fallback
    std::env::temp_dir().join(LOG_LINUX_NAME).join("logs")
}

pub struct DiagnosticLogger {
    log_file_path: Mutex<Option<PathBuf>>,
}

impl DiagnosticLogger {
    pub fn new() -> Self {
        Self {
            log_file_path: Mutex::new(None),
        }
    }

    /// Initializes a fresh log file for this run, cleaning up old previous run logs.
    pub fn init_run(&self) -> Result<PathBuf, String> {
        let dir = get_os_log_dir();
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create log directory: {}", e))?;

        // Clean previous run logs in the log directory
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let _ = fs::remove_file(path);
                }
            }
        }

        let now = Local::now();
        let file_name = format!("run_{}.log", now.format("%Y%m%d_%H%M%S"));
        let log_path = dir.join(file_name);

        // Create the new log file
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;

        let sys = get_system_details();

        let header = format!(
            "================================================================================\n\
             {} - Diagnostic Log\n\
             ================================================================================\n\
             Session Started : {}\n\
             App Version     : v{}\n\
             Operating System: {}\n\
             OS Build / Patch: {}\n\
             Kernel Version  : {}\n\
             Hardware Model  : {}\n\
             Architecture    : {}\n\
             Logical Cores   : {} Cores\n\
             System Memory   : {}\n\
             Log Storage Path: {}\n\
             ================================================================================\n\n",
            sys.app_name,
            now.format("%Y-%m-%d %H:%M:%S%.3f %Z"),
            sys.app_version,
            sys.os_version,
            sys.os_build,
            sys.kernel_version,
            sys.hardware_model,
            sys.architecture,
            sys.cpu_cores,
            sys.total_memory,
            log_path.display()
        );

        file.write_all(header.as_bytes())
            .map_err(|e| format!("Failed to write log header: {}", e))?;

        let mut lock = self.log_file_path.lock().map_err(|e| e.to_string())?;
        *lock = Some(log_path.clone());

        Ok(log_path)
    }

    /// Appends a structured log entry to the active run log file.
    pub fn write_entry(&self, level: &str, category: &str, action: &str, details: &str) {
        let now = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let formatted = format!(
            "[{}] [{:<5}] [{:<12}] {} - {}\n",
            now,
            level.to_uppercase(),
            category,
            action,
            details
        );

        // Also print to console during development
        print!("{}", formatted);

        if let Ok(lock) = self.log_file_path.lock() {
            if let Some(ref path) = *lock {
                if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
                    let _ = file.write_all(formatted.as_bytes());
                }
            }
        }
    }

    /// Reads the most recent log lines from the current run log.
    pub fn read_recent_lines(&self, limit: usize) -> Vec<String> {
        let mut lines = Vec::new();
        if let Ok(lock) = self.log_file_path.lock() {
            if let Some(ref path) = *lock {
                if let Ok(file) = File::open(path) {
                    let reader = BufReader::new(file);
                    let all_lines: Vec<String> = reader.lines().flatten().collect();
                    let start = all_lines.len().saturating_sub(limit);
                    lines = all_lines[start..].to_vec();
                }
            }
        }
        lines
    }

    /// Clears all files in the OS log directory.
    pub fn clear_logs(&self) -> Result<(), String> {
        let dir = get_os_log_dir();
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
        // Re-initialize a blank log
        let _ = self.init_run();
        Ok(())
    }
}

pub fn get_logger() -> &'static DiagnosticLogger {
    static LOGGER: OnceLock<DiagnosticLogger> = OnceLock::new();
    LOGGER.get_or_init(DiagnosticLogger::new)
}

/// Helper function for backend diagnostic logging
pub fn log_event(level: &str, category: &str, action: &str, details: &str) {
    get_logger().write_entry(level, category, action, details);
}

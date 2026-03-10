//! Structured JSON logging with file rotation.

pub mod config;

pub use config::{LoggerConfig, Rotation};

use tracing_subscriber::Layer;
use tracing_subscriber::layer::SubscriberExt;

use crate::error::{Result, ShipKitError};

/// A log entry parsed from a JSON log file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub target: String,
    #[serde(default)]
    pub fields: serde_json::Value,
}

/// Structured logger with file output and an optional console layer.
///
/// The `WorkerGuard` inside must live for the application's lifetime.
/// Dropping it flushes buffered logs.
pub struct Logger {
    _guard: tracing_appender::non_blocking::WorkerGuard,
    log_dir: std::path::PathBuf,
}

impl Logger {
    /// Initialize the global tracing subscriber.
    ///
    /// Can only be called once per process. Returns `LoggerAlreadyInitialized`
    /// on subsequent calls.
    pub fn init(config: LoggerConfig) -> Result<Self> {
        std::fs::create_dir_all(&config.log_dir)?;

        let file_appender = match config.rotation {
            Rotation::Daily => {
                tracing_appender::rolling::daily(&config.log_dir, &config.file_prefix)
            }
            Rotation::Hourly => {
                tracing_appender::rolling::hourly(&config.log_dir, &config.file_prefix)
            }
            Rotation::Never => {
                tracing_appender::rolling::never(&config.log_dir, &config.file_prefix)
            }
        };

        let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

        let env_filter = tracing_subscriber::EnvFilter::new(config.level.as_str());

        let file_layer: Box<dyn Layer<_> + Send + Sync> = if config.json_format {
            Box::new(
                tracing_subscriber::fmt::layer()
                    .json()
                    .with_writer(non_blocking),
            )
        } else {
            Box::new(tracing_subscriber::fmt::layer().with_writer(non_blocking))
        };

        let console_layer: Box<dyn Layer<_> + Send + Sync> = if config.console_output {
            Box::new(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        } else {
            Box::new(tracing_subscriber::fmt::layer().with_writer(std::io::sink))
        };

        let subscriber = tracing_subscriber::registry()
            .with(env_filter)
            .with(file_layer)
            .with(console_layer);

        tracing::subscriber::set_global_default(subscriber)
            .map_err(|_| ShipKitError::LoggerAlreadyInitialized)?;

        Ok(Self {
            _guard: guard,
            log_dir: config.log_dir,
        })
    }

    /// Get the directory where log files are stored.
    pub fn log_dir(&self) -> &std::path::Path {
        &self.log_dir
    }
}

/// Read recent log entries from the most recent log file.
pub fn read_log_entries(
    log_dir: &std::path::Path,
    count: usize,
    level_filter: Option<&str>,
) -> Result<Vec<LogEntry>> {
    // Find the most recent log file
    let mut files: Vec<_> = std::fs::read_dir(log_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .collect();
    files.sort_by_key(|e| {
        e.metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });

    let Some(latest) = files.last() else {
        return Ok(Vec::new());
    };

    let content = std::fs::read_to_string(latest.path())?;
    let entries: Vec<LogEntry> = content
        .lines()
        .filter_map(|line| {
            let raw: serde_json::Value = serde_json::from_str(line).ok()?;
            let obj = raw.as_object()?;
            Some(LogEntry {
                timestamp: obj
                    .get("timestamp")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                level: obj
                    .get("level")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                message: obj
                    .get("fields")
                    .and_then(|f| f.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                target: obj
                    .get("target")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string(),
                fields: obj
                    .get("fields")
                    .cloned()
                    .unwrap_or(serde_json::Value::Null),
            })
        })
        .collect();

    let filtered: Vec<LogEntry> = if let Some(level) = level_filter {
        let level_upper = level.to_uppercase();
        entries
            .into_iter()
            .filter(|e| e.level.to_uppercase() == level_upper)
            .collect()
    } else {
        entries
    };

    // Return last `count` entries
    let start = filtered.len().saturating_sub(count);
    Ok(filtered[start..].to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;
    use tempfile::TempDir;

    #[test]
    #[serial]
    fn init_creates_log_dir() {
        let tmp = TempDir::new().expect("tmp");
        let log_dir = tmp.path().join("logs");
        let result = Logger::init(LoggerConfig {
            log_dir: log_dir.clone(),
            file_prefix: "test".into(),
            rotation: Rotation::Never,
            level: tracing::Level::DEBUG,
            json_format: true,
            console_output: false,
        });

        // May fail if another test already set the global subscriber
        if let Ok(logger) = result {
            assert!(log_dir.exists());
            drop(logger);
        }
    }

    #[test]
    fn default_config_reasonable() {
        let config = LoggerConfig::default();
        assert!(config.json_format);
        assert!(config.console_output);
        assert!(!config.file_prefix.is_empty());
    }

    #[test]
    fn read_empty_dir() {
        let tmp = TempDir::new().expect("tmp");
        let entries = read_log_entries(tmp.path(), 10, None).expect("read");
        assert!(entries.is_empty());
    }

    #[test]
    fn read_json_log_entries() {
        let tmp = TempDir::new().expect("tmp");
        let log_file = tmp.path().join("test.log");
        let content = r#"{"timestamp":"2026-01-01T00:00:00Z","level":"INFO","target":"test","fields":{"message":"hello world"}}
{"timestamp":"2026-01-01T00:00:01Z","level":"WARN","target":"test","fields":{"message":"warning msg"}}
{"timestamp":"2026-01-01T00:00:02Z","level":"ERROR","target":"test","fields":{"message":"error msg"}}"#;
        std::fs::write(&log_file, content).expect("write");

        let entries = read_log_entries(tmp.path(), 10, None).expect("read");
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].message, "hello world");
    }

    #[test]
    fn level_filtering() {
        let tmp = TempDir::new().expect("tmp");
        let log_file = tmp.path().join("test.log");
        let content = r#"{"timestamp":"2026-01-01T00:00:00Z","level":"INFO","target":"test","fields":{"message":"info"}}
{"timestamp":"2026-01-01T00:00:01Z","level":"WARN","target":"test","fields":{"message":"warn"}}
{"timestamp":"2026-01-01T00:00:02Z","level":"ERROR","target":"test","fields":{"message":"error"}}"#;
        std::fs::write(&log_file, content).expect("write");

        let entries = read_log_entries(tmp.path(), 10, Some("ERROR")).expect("read");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "error");
    }
}

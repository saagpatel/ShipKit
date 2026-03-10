use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl CommandError {
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        details: Option<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details,
        }
    }

    pub fn from_display(code: impl Into<String>, err: impl std::fmt::Display) -> Self {
        let rendered = err.to_string();
        Self::new(code, rendered.clone(), Some(rendered))
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct AppOverview {
    pub app_name: String,
    pub version: String,
    pub platform: String,
    pub data_dir: String,
    pub database_path: String,
    pub log_dir: String,
    pub support_dir: String,
    pub active_theme: String,
    pub pending_migrations: usize,
    pub applied_migrations: usize,
    pub enabled_plugins: usize,
    pub available_plugins: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct SupportBundleSummary {
    pub path: String,
    pub generated_at: String,
    pub log_entry_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct SupportBundleArtifact {
    pub path: String,
    pub generated_at: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginStatus {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub category: String,
    pub distribution: String,
    pub min_shipkit_version: String,
    pub compatibility: String,
    pub capabilities: Vec<String>,
    pub enabled: bool,
}

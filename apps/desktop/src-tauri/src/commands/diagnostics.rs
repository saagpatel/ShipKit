use std::path::PathBuf;

use serde_json::json;
use shipkit_core::logger::read_log_entries;
use shipkit_core::{Settings, SettingsBackend};
use tauri::State;

use crate::api::{AppOverview, CommandError, SupportBundleArtifact, SupportBundleSummary};
use crate::plugins::load_plugin_statuses;
use crate::preferences::DesktopSettings;
use crate::state::AppState;

fn timestamp_string() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn support_bundle_artifact(
    path: std::path::PathBuf,
) -> Result<SupportBundleArtifact, CommandError> {
    let metadata = std::fs::metadata(&path)
        .map_err(|err| CommandError::from_display("support.metadata_failed", err))?;
    let generated_at = metadata
        .modified()
        .map(chrono::DateTime::<chrono::Utc>::from)
        .map(|time| time.to_rfc3339())
        .map_err(|err| CommandError::from_display("support.timestamp_failed", err))?;

    Ok(SupportBundleArtifact {
        path: path.display().to_string(),
        generated_at,
        size_bytes: metadata.len(),
    })
}

fn support_bundle_path_for_read(
    support_dir: &std::path::Path,
    requested_path: &str,
) -> Result<PathBuf, CommandError> {
    let base_dir = std::fs::canonicalize(support_dir)
        .map_err(|err| CommandError::from_display("support.directory_failed", err))?;
    let bundle_path = std::fs::canonicalize(requested_path)
        .map_err(|err| CommandError::from_display("support.read_failed", err))?;

    if !bundle_path.starts_with(&base_dir) {
        return Err(CommandError::new(
            "support.restore_forbidden_path",
            "Support bundle must come from the local support directory.",
            Some(bundle_path.display().to_string()),
        ));
    }

    Ok(bundle_path)
}

fn desktop_settings_from_bundle_payload(payload: &str) -> Result<DesktopSettings, CommandError> {
    let parsed: serde_json::Value = serde_json::from_str(payload).map_err(|err| {
        CommandError::new(
            "support.restore_invalid_bundle",
            "Support bundle could not be read.",
            Some(err.to_string()),
        )
    })?;
    let desktop_preferences = parsed.get("desktop_preferences").cloned().ok_or_else(|| {
        CommandError::new(
            "support.restore_missing_preferences",
            "Support bundle does not include desktop preferences.",
            None,
        )
    })?;

    DesktopSettings::from_value(desktop_preferences).map_err(|reason| {
        CommandError::new(
            "support.restore_invalid_preferences",
            "Support bundle desktop preferences are invalid.",
            Some(reason),
        )
    })
}

pub(crate) fn restore_desktop_settings_from_path(
    support_dir: &std::path::Path,
    settings_store: &dyn SettingsBackend,
    path: &str,
) -> Result<DesktopSettings, CommandError> {
    std::fs::create_dir_all(support_dir)
        .map_err(|err| CommandError::from_display("support.directory_failed", err))?;

    let bundle_path = support_bundle_path_for_read(support_dir, path)?;
    let payload = std::fs::read_to_string(&bundle_path)
        .map_err(|err| CommandError::from_display("support.read_failed", err))?;
    let settings = desktop_settings_from_bundle_payload(&payload)?;

    settings
        .save(settings_store)
        .map_err(|err| CommandError::from_display("support.restore_save_failed", err))?;

    DesktopSettings::load(settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| CommandError::from_display("support.restore_reload_failed", err))
}

#[tauri::command]
pub fn get_app_overview(state: State<'_, AppState>) -> Result<AppOverview, CommandError> {
    let theme = state
        .theme_engine
        .read()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    let migrations = state
        .migrations
        .lock()
        .map_err(|err| CommandError::from_display("migration.lock_failed", err))?;
    let statuses = migrations
        .status()
        .map_err(|err| CommandError::from_display("migration.status_failed", err))?;

    let pending_migrations = statuses.iter().filter(|status| !status.applied).count();
    let applied_migrations = statuses.iter().filter(|status| status.applied).count();
    let plugin_statuses = load_plugin_statuses(&state.settings_store)
        .map_err(|err| CommandError::from_display("plugins.list_failed", err))?;
    let enabled_plugins = plugin_statuses
        .iter()
        .filter(|plugin| plugin.enabled)
        .count();
    let available_plugins = plugin_statuses.len();

    Ok(AppOverview {
        app_name: "ShipKit Desktop".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        platform: std::env::consts::OS.into(),
        data_dir: state.paths.data_dir.display().to_string(),
        database_path: state.paths.database_path.display().to_string(),
        log_dir: state.paths.log_dir.display().to_string(),
        support_dir: state.paths.support_dir.display().to_string(),
        active_theme: theme.active().name.clone(),
        pending_migrations,
        applied_migrations,
        enabled_plugins,
        available_plugins,
    })
}

#[tauri::command]
pub fn export_support_bundle(
    state: State<'_, AppState>,
) -> Result<SupportBundleSummary, CommandError> {
    std::fs::create_dir_all(&state.paths.support_dir)
        .map_err(|err| CommandError::from_display("support.directory_failed", err))?;

    let theme = state
        .theme_engine
        .read()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    let migrations = state
        .migrations
        .lock()
        .map_err(|err| CommandError::from_display("migration.lock_failed", err))?;
    let statuses = migrations
        .status()
        .map_err(|err| CommandError::from_display("migration.status_failed", err))?;
    let logs = read_log_entries(state.logger.log_dir(), 50, None)
        .map_err(|err| CommandError::from_display("support.log_read_failed", err))?;
    let desktop_preferences = DesktopSettings::load(&state.settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| CommandError::from_display("support.preferences_failed", err))?;
    let plugins = load_plugin_statuses(&state.settings_store)
        .map_err(|err| CommandError::from_display("support.plugins_failed", err))?;

    let generated_at = timestamp_string();
    let filename = format!(
        "support-bundle-{}.json",
        generated_at.replace([':', '.'], "-")
    );
    let bundle_path: PathBuf = state.paths.support_dir.join(filename);

    let payload = json!({
        "generated_at": generated_at,
        "app": {
            "name": "ShipKit Desktop",
            "version": env!("CARGO_PKG_VERSION"),
            "platform": std::env::consts::OS,
        },
        "paths": {
            "data_dir": state.paths.data_dir.display().to_string(),
            "database_path": state.paths.database_path.display().to_string(),
            "log_dir": state.paths.log_dir.display().to_string(),
            "support_dir": state.paths.support_dir.display().to_string(),
        },
        "desktop_preferences": desktop_preferences,
        "plugins": plugins,
        "theme": theme.active(),
        "migrations": statuses,
        "recent_logs": logs,
    });

    std::fs::write(
        &bundle_path,
        serde_json::to_string_pretty(&payload)
            .map_err(|err| CommandError::from_display("support.serialize_failed", err))?,
    )
    .map_err(|err| CommandError::from_display("support.write_failed", err))?;

    Ok(SupportBundleSummary {
        path: bundle_path.display().to_string(),
        generated_at,
        log_entry_count: payload["recent_logs"]
            .as_array()
            .map_or(0, |logs| logs.len()),
    })
}

#[tauri::command]
pub fn list_support_bundles(
    state: State<'_, AppState>,
) -> Result<Vec<SupportBundleArtifact>, CommandError> {
    std::fs::create_dir_all(&state.paths.support_dir)
        .map_err(|err| CommandError::from_display("support.directory_failed", err))?;

    let mut entries: Vec<_> = std::fs::read_dir(&state.paths.support_dir)
        .map_err(|err| CommandError::from_display("support.list_failed", err))?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .collect();
    entries.sort();
    entries.reverse();

    entries.into_iter().map(support_bundle_artifact).collect()
}

#[tauri::command]
pub fn clear_support_bundles(state: State<'_, AppState>) -> Result<usize, CommandError> {
    std::fs::create_dir_all(&state.paths.support_dir)
        .map_err(|err| CommandError::from_display("support.directory_failed", err))?;

    let mut removed = 0;
    for entry in std::fs::read_dir(&state.paths.support_dir)
        .map_err(|err| CommandError::from_display("support.list_failed", err))?
        .filter_map(|entry| entry.ok())
    {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "json") {
            std::fs::remove_file(&path)
                .map_err(|err| CommandError::from_display("support.clear_failed", err))?;
            removed += 1;
        }
    }

    Ok(removed)
}

#[tauri::command]
pub fn restore_desktop_settings_from_bundle(
    state: State<'_, AppState>,
    path: String,
) -> Result<DesktopSettings, CommandError> {
    restore_desktop_settings_from_path(&state.paths.support_dir, &state.settings_store, &path)
}

#[cfg(test)]
mod tests {
    use super::desktop_settings_from_bundle_payload;

    #[test]
    fn bundle_payload_restores_desktop_preferences() {
        let settings = desktop_settings_from_bundle_payload(
            r#"{
              "generated_at":"2026-03-10T00:00:00Z",
              "desktop_preferences":{
                "startup_route":"logs",
                "default_settings_namespace":"ops",
                "default_log_level":"WARN",
                "confirm_before_rollback":false
              }
            }"#,
        )
        .expect("bundle settings");

        assert_eq!(settings.startup_route, "logs");
        assert_eq!(settings.default_settings_namespace, "ops");
        assert_eq!(settings.default_log_level, "WARN");
        assert!(!settings.confirm_before_rollback);
    }

    #[test]
    fn bundle_payload_requires_desktop_preferences() {
        let error = desktop_settings_from_bundle_payload(
            r#"{
              "generated_at":"2026-03-10T00:00:00Z"
            }"#,
        )
        .expect_err("missing preferences should fail");

        assert_eq!(error.code, "support.restore_missing_preferences");
    }
}

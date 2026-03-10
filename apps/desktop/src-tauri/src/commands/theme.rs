use crate::api::CommandError;
use shipkit_core::{SettingsBackend, ThemeDefinition};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn get_theme(state: State<'_, AppState>) -> Result<ThemeDefinition, CommandError> {
    let engine = state
        .theme_engine
        .read()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    Ok(engine.active().clone())
}

#[tauri::command]
pub fn set_theme(
    state: State<'_, AppState>,
    name: String,
) -> Result<ThemeDefinition, CommandError> {
    let mut engine = state
        .theme_engine
        .write()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    let theme = engine
        .set_active(&name)
        .map_err(|err| CommandError::from_display("theme.set_failed", err))?;
    let result = theme.clone();

    // Persist theme selection
    state
        .settings_store
        .set("shipkit_internal", "active_theme", serde_json::json!(name))
        .map_err(|err| CommandError::from_display("theme.persist_failed", err))?;

    Ok(result)
}

#[tauri::command]
pub fn list_themes(state: State<'_, AppState>) -> Result<Vec<ThemeDefinition>, CommandError> {
    let engine = state
        .theme_engine
        .read()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    Ok(engine.list().to_vec())
}

#[tauri::command]
pub fn get_css_variables(state: State<'_, AppState>) -> Result<String, CommandError> {
    let engine = state
        .theme_engine
        .read()
        .map_err(|err| CommandError::from_display("theme.lock_failed", err))?;
    Ok(engine.generate_css())
}

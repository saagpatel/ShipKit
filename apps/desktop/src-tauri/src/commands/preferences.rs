use shipkit_core::{Settings, SettingsBackend};
use tauri::State;

use crate::api::CommandError;
use crate::preferences::DesktopSettings;
use crate::state::AppState;

#[tauri::command]
pub fn get_desktop_settings(state: State<'_, AppState>) -> Result<DesktopSettings, CommandError> {
    DesktopSettings::load(&state.settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| CommandError::from_display("preferences.load_failed", err))
}

#[tauri::command]
pub fn save_desktop_settings(
    state: State<'_, AppState>,
    settings: DesktopSettings,
) -> Result<DesktopSettings, CommandError> {
    let settings = settings.normalize();
    settings
        .save(&state.settings_store)
        .map_err(|err| CommandError::from_display("preferences.save_failed", err))?;

    DesktopSettings::load(&state.settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| CommandError::from_display("preferences.reload_failed", err))
}

#[tauri::command]
pub fn reset_desktop_settings(state: State<'_, AppState>) -> Result<DesktopSettings, CommandError> {
    let existing = state
        .settings_store
        .get_all(DesktopSettings::namespace())
        .map_err(|err| CommandError::from_display("preferences.list_failed", err))?;

    for key in existing.keys() {
        state
            .settings_store
            .delete(DesktopSettings::namespace(), key)
            .map_err(|err| CommandError::from_display("preferences.reset_failed", err))?;
    }

    let defaults = DesktopSettings::default();
    defaults
        .save(&state.settings_store)
        .map_err(|err| CommandError::from_display("preferences.reset_failed", err))?;

    Ok(defaults)
}

#[tauri::command]
pub fn export_desktop_settings(state: State<'_, AppState>) -> Result<String, CommandError> {
    DesktopSettings::load(&state.settings_store)
        .map(DesktopSettings::normalize)
        .map_err(|err| CommandError::from_display("preferences.export_load_failed", err))?
        .to_pretty_json()
        .map_err(|err| CommandError::from_display("preferences.export_serialize_failed", err))
}

#[tauri::command]
pub fn import_desktop_settings(
    state: State<'_, AppState>,
    payload: String,
) -> Result<DesktopSettings, CommandError> {
    let settings = DesktopSettings::from_json(&payload).map_err(|reason| {
        CommandError::new(
            "preferences.import_invalid_payload",
            "Desktop settings import failed.",
            Some(reason),
        )
    })?;

    settings
        .save(&state.settings_store)
        .map_err(|err| CommandError::from_display("preferences.import_save_failed", err))?;

    Ok(settings)
}

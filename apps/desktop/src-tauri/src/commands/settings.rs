use crate::api::CommandError;
use std::collections::HashMap;

use serde_json::Value;
use shipkit_core::SettingsBackend;
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn get_setting(
    state: State<'_, AppState>,
    namespace: String,
    key: String,
) -> Result<Option<Value>, CommandError> {
    state
        .settings_store
        .get(&namespace, &key)
        .map_err(|err| CommandError::from_display("settings.get_failed", err))
}

#[tauri::command]
pub fn set_setting(
    state: State<'_, AppState>,
    namespace: String,
    key: String,
    value: Value,
) -> Result<(), CommandError> {
    state
        .settings_store
        .set(&namespace, &key, value)
        .map_err(|err| CommandError::from_display("settings.set_failed", err))
}

#[tauri::command]
pub fn get_all_settings(
    state: State<'_, AppState>,
    namespace: String,
) -> Result<HashMap<String, Value>, CommandError> {
    state
        .settings_store
        .get_all(&namespace)
        .map_err(|err| CommandError::from_display("settings.list_failed", err))
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>, namespace: String) -> Result<Value, CommandError> {
    let all = state
        .settings_store
        .get_all(&namespace)
        .map_err(|err| CommandError::from_display("settings.load_failed", err))?;
    Ok(Value::Object(all.into_iter().collect()))
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    namespace: String,
    settings: Value,
) -> Result<(), CommandError> {
    if let Value::Object(map) = settings {
        for (key, val) in map {
            state
                .settings_store
                .set(&namespace, &key, val)
                .map_err(|err| CommandError::from_display("settings.save_failed", err))?;
        }
        Ok(())
    } else {
        Err(CommandError::new(
            "settings.invalid_payload",
            "settings must be a JSON object",
            None,
        ))
    }
}

use tauri::State;

use crate::api::{CommandError, PluginStatus};
use crate::plugins::{load_plugin_statuses, set_plugin_enabled};
use crate::state::AppState;

#[tauri::command]
pub fn list_plugins(state: State<'_, AppState>) -> Result<Vec<PluginStatus>, CommandError> {
    load_plugin_statuses(&state.settings_store)
        .map_err(|err| CommandError::from_display("plugins.list_failed", err))
}

#[tauri::command]
pub fn set_plugin_enabled_state(
    state: State<'_, AppState>,
    plugin_id: String,
    enabled: bool,
) -> Result<Vec<PluginStatus>, CommandError> {
    set_plugin_enabled(&state.settings_store, &plugin_id, enabled).map_err(|err| {
        CommandError::new(
            "plugins.set_enabled_failed",
            "Plugin state update failed.",
            Some(err),
        )
    })
}

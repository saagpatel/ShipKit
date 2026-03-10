use crate::api::CommandError;
use shipkit_core::logger::{self, LogEntry};
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn get_log_entries(
    state: State<'_, AppState>,
    count: Option<usize>,
    level: Option<String>,
) -> Result<Vec<LogEntry>, CommandError> {
    logger::read_log_entries(
        state.logger.log_dir(),
        count.unwrap_or(100),
        level.as_deref(),
    )
    .map_err(|err| CommandError::from_display("logger.read_failed", err))
}

use crate::api::CommandError;
use shipkit_core::MigrationStatus;
use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn migration_status(state: State<'_, AppState>) -> Result<Vec<MigrationStatus>, CommandError> {
    let engine = state
        .migrations
        .lock()
        .map_err(|err| CommandError::from_display("migration.lock_failed", err))?;
    engine
        .status()
        .map_err(|err| CommandError::from_display("migration.status_failed", err))
}

#[tauri::command]
pub fn apply_migrations(state: State<'_, AppState>) -> Result<Vec<MigrationStatus>, CommandError> {
    let mut engine = state
        .migrations
        .lock()
        .map_err(|err| CommandError::from_display("migration.lock_failed", err))?;
    engine
        .apply_pending()
        .map_err(|err| CommandError::from_display("migration.apply_failed", err))
}

#[tauri::command]
pub fn rollback_migration(
    state: State<'_, AppState>,
) -> Result<Option<MigrationStatus>, CommandError> {
    let mut engine = state
        .migrations
        .lock()
        .map_err(|err| CommandError::from_display("migration.lock_failed", err))?;
    engine
        .rollback_last()
        .map_err(|err| CommandError::from_display("migration.rollback_failed", err))
}

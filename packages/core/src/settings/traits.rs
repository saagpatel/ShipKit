//! Traits for type-safe settings management.

use crate::error::Result;

/// Backend trait for settings storage.
///
/// SQLite implementation is provided by [`super::SqliteSettingsStore`].
/// Users can implement custom backends (file-based, in-memory, encrypted, etc.).
pub trait SettingsBackend: Send + Sync {
    /// Get a single setting value.
    fn get(&self, namespace: &str, key: &str) -> Result<Option<serde_json::Value>>;

    /// Set a single setting value.
    fn set(&self, namespace: &str, key: &str, value: serde_json::Value) -> Result<()>;

    /// Get all settings in a namespace.
    fn get_all(
        &self,
        namespace: &str,
    ) -> Result<std::collections::HashMap<String, serde_json::Value>>;

    /// Delete a single setting.
    fn delete(&self, namespace: &str, key: &str) -> Result<()>;
}

/// Trait for type-safe settings structs.
///
/// Derive this with `#[derive(Settings)]` from `shipkit-macros`.
pub trait Settings: Sized + serde::Serialize + serde::de::DeserializeOwned {
    /// Namespace prefix for storage (e.g., "appearance").
    fn namespace() -> &'static str;

    /// Returns `(field_name, default_value_as_json)` for each field.
    fn field_defaults() -> &'static [(&'static str, &'static str)];

    /// Load from store, filling any missing fields with defaults.
    fn load(store: &dyn SettingsBackend) -> Result<Self>;

    /// Save all fields to store.
    fn save(&self, store: &dyn SettingsBackend) -> Result<()>;

    /// Get one field's value.
    fn get_field(store: &dyn SettingsBackend, field: &str) -> Result<serde_json::Value>;

    /// Set one field's value.
    fn set_field(store: &dyn SettingsBackend, field: &str, value: serde_json::Value) -> Result<()>;
}

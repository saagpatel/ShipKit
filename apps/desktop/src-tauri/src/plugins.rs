use serde::{Deserialize, Serialize};
use shipkit_core::{Settings, SettingsBackend};

use crate::api::PluginStatus;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub category: String,
    pub distribution: String,
    pub min_shipkit_version: String,
    pub compatibility: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Settings, Default)]
#[settings(namespace = "plugin_preferences")]
pub struct PluginPreferences {
    #[settings(default = "")]
    pub enabled_ids_csv: String,
}

impl PluginPreferences {
    pub fn enabled_ids(&self) -> Vec<String> {
        self.enabled_ids_csv
            .split(',')
            .filter_map(|value| {
                let normalized = value.trim();
                if normalized.is_empty() {
                    None
                } else {
                    Some(normalized.to_string())
                }
            })
            .collect()
    }

    pub fn with_enabled_ids(ids: &[String]) -> Self {
        let mut normalized = ids
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(String::from)
            .collect::<Vec<_>>();
        normalized.sort();
        normalized.dedup();

        Self {
            enabled_ids_csv: normalized.join(","),
        }
    }
}

const CATALOG: &str = include_str!("../plugin_catalog/catalog.json");

pub fn catalog() -> Result<Vec<PluginManifest>, String> {
    serde_json::from_str(CATALOG).map_err(|err| err.to_string())
}

pub fn load_plugin_statuses(store: &impl SettingsBackend) -> Result<Vec<PluginStatus>, String> {
    let manifests = catalog()?;
    let preferences = PluginPreferences::load(store).unwrap_or_default();
    let enabled_ids = preferences.enabled_ids();

    Ok(manifests
        .into_iter()
        .map(|plugin| PluginStatus {
            enabled: enabled_ids.contains(&plugin.id),
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            description: plugin.description,
            category: plugin.category,
            distribution: plugin.distribution,
            min_shipkit_version: plugin.min_shipkit_version,
            compatibility: plugin.compatibility,
            capabilities: plugin.capabilities,
        })
        .collect())
}

pub fn set_plugin_enabled(
    store: &impl SettingsBackend,
    plugin_id: &str,
    enabled: bool,
) -> Result<Vec<PluginStatus>, String> {
    let manifests = catalog()?;
    if !manifests.iter().any(|plugin| plugin.id == plugin_id) {
        return Err(format!("unknown plugin id: {plugin_id}"));
    }

    let preferences = PluginPreferences::load(store).unwrap_or_default();
    let mut enabled_ids = preferences.enabled_ids();

    if enabled {
        if !enabled_ids.contains(&plugin_id.to_string()) {
            enabled_ids.push(plugin_id.to_string());
        }
    } else {
        enabled_ids.retain(|id| id != plugin_id);
    }

    PluginPreferences::with_enabled_ids(&enabled_ids)
        .save(store)
        .map_err(|err| err.to_string())?;

    load_plugin_statuses(store)
}

#[cfg(test)]
mod tests {
    use super::{catalog, load_plugin_statuses, set_plugin_enabled};
    use shipkit_core::{ConnectionPool, SqliteSettingsStore};

    #[test]
    fn catalog_loads_curated_plugins() {
        let manifests = catalog().expect("catalog");
        assert!(!manifests.is_empty());
        assert!(
            manifests
                .iter()
                .all(|plugin| plugin.distribution == "curated-signed")
        );
    }

    #[test]
    fn enabling_plugin_updates_statuses() {
        let store =
            SqliteSettingsStore::new(ConnectionPool::in_memory().expect("pool")).expect("store");

        let first_plugin_id = catalog()
            .expect("catalog")
            .first()
            .expect("plugin")
            .id
            .clone();

        let statuses = set_plugin_enabled(&store, &first_plugin_id, true).expect("enable");
        assert!(
            statuses
                .iter()
                .find(|plugin| plugin.id == first_plugin_id)
                .expect("status")
                .enabled
        );

        let reloaded = load_plugin_statuses(&store).expect("reload");
        assert!(
            reloaded
                .iter()
                .find(|plugin| plugin.id == first_plugin_id)
                .expect("status")
                .enabled
        );
    }
}

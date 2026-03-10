use serde::{Deserialize, Serialize};
use shipkit_core::Settings;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Settings)]
#[settings(namespace = "desktop_preferences")]
pub struct DesktopSettings {
    #[settings(default = "home")]
    pub startup_route: String,
    #[settings(default = "demo")]
    pub default_settings_namespace: String,
    #[settings(default = "all")]
    pub default_log_level: String,
    #[settings(default = true)]
    pub confirm_before_rollback: bool,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            startup_route: "home".into(),
            default_settings_namespace: "demo".into(),
            default_log_level: "all".into(),
            confirm_before_rollback: true,
        }
    }
}

impl DesktopSettings {
    pub fn normalize(mut self) -> Self {
        if !matches!(
            self.startup_route.as_str(),
            "home"
                | "database"
                | "settings"
                | "theme"
                | "logs"
                | "diagnostics"
                | "updates"
                | "plugins"
        ) {
            self.startup_route = "home".into();
        }

        if !matches!(
            self.default_log_level.as_str(),
            "all" | "INFO" | "WARN" | "ERROR" | "DEBUG" | "TRACE"
        ) {
            self.default_log_level = "all".into();
        }

        let namespace = self.default_settings_namespace.trim();
        self.default_settings_namespace = if namespace.is_empty() {
            "demo".into()
        } else {
            namespace.into()
        };

        self
    }

    pub fn to_pretty_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn from_value(parsed: serde_json::Value) -> Result<Self, String> {
        let object = parsed
            .as_object()
            .ok_or_else(|| "desktop settings import payload must be a JSON object".to_string())?;

        let mut merged = serde_json::to_value(Self::default()).map_err(|err| err.to_string())?;
        let target = merged
            .as_object_mut()
            .ok_or_else(|| "desktop settings defaults must serialize to an object".to_string())?;

        for (key, value) in object {
            target.insert(key.clone(), value.clone());
        }

        serde_json::from_value::<Self>(merged)
            .map(Self::normalize)
            .map_err(|err| err.to_string())
    }

    pub fn from_json(payload: &str) -> Result<Self, String> {
        let parsed: serde_json::Value =
            serde_json::from_str(payload).map_err(|err| err.to_string())?;
        Self::from_value(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::DesktopSettings;
    use shipkit_core::{ConnectionPool, Settings, SqliteSettingsStore};

    #[test]
    fn import_json_merges_defaults() {
        let imported =
            DesktopSettings::from_json(r#"{"startup_route":"logs"}"#).expect("import settings");

        assert_eq!(imported.startup_route, "logs");
        assert_eq!(imported.default_settings_namespace, "demo");
        assert_eq!(imported.default_log_level, "all");
        assert!(imported.confirm_before_rollback);
    }

    #[test]
    fn normalize_invalid_values() {
        let imported = DesktopSettings::from_json(
            r#"{
              "startup_route":"weird",
              "default_settings_namespace":"   ",
              "default_log_level":"LOUD",
              "confirm_before_rollback":false
            }"#,
        )
        .expect("import settings");

        assert_eq!(imported.startup_route, "home");
        assert_eq!(imported.default_settings_namespace, "demo");
        assert_eq!(imported.default_log_level, "all");
        assert!(!imported.confirm_before_rollback);
    }

    #[test]
    fn pretty_json_roundtrip_is_canonical() {
        let imported = DesktopSettings::from_json(
            r#"{
              "startup_route":"weird",
              "default_settings_namespace":"ops",
              "confirm_before_rollback":false
            }"#,
        )
        .expect("import settings");

        let payload = imported.to_pretty_json().expect("serialize settings");
        let parsed: serde_json::Value = serde_json::from_str(&payload).expect("parse payload");

        assert_eq!(
            parsed,
            serde_json::json!({
                "startup_route": "home",
                "default_settings_namespace": "ops",
                "default_log_level": "all",
                "confirm_before_rollback": false
            })
        );
    }

    #[test]
    fn save_and_load_roundtrip_preserves_normalized_values() {
        let store =
            SqliteSettingsStore::new(ConnectionPool::in_memory().expect("pool")).expect("store");
        let imported = DesktopSettings::from_json(
            r#"{
              "startup_route":"logs",
              "default_settings_namespace":"workspace",
              "default_log_level":"WARN",
              "confirm_before_rollback":false
            }"#,
        )
        .expect("import settings");

        imported.save(&store).expect("save settings");

        let loaded = DesktopSettings::load(&store)
            .expect("load settings")
            .normalize();

        assert_eq!(loaded.startup_route, "logs");
        assert_eq!(loaded.default_settings_namespace, "workspace");
        assert_eq!(loaded.default_log_level, "WARN");
        assert!(!loaded.confirm_before_rollback);
    }
}

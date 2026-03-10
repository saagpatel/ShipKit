//! SQLite-backed settings store.

use std::collections::HashMap;

use crate::db::ConnectionPool;
use crate::error::Result;
use crate::settings::traits::SettingsBackend;

/// SQLite implementation of [`SettingsBackend`].
///
/// Creates its own `_shipkit_settings` table on construction.
pub struct SqliteSettingsStore {
    pool: ConnectionPool,
}

impl SqliteSettingsStore {
    /// Create a new store, creating the settings table if needed.
    pub fn new(pool: ConnectionPool) -> Result<Self> {
        let conn = pool.get()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _shipkit_settings (
                namespace TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (namespace, key)
            );",
        )?;
        Ok(Self { pool })
    }
}

impl SettingsBackend for SqliteSettingsStore {
    fn get(&self, namespace: &str, key: &str) -> Result<Option<serde_json::Value>> {
        let conn = self.pool.get()?;
        let mut stmt =
            conn.prepare("SELECT value FROM _shipkit_settings WHERE namespace = ?1 AND key = ?2")?;
        let result = stmt.query_row(rusqlite::params![namespace, key], |row| {
            row.get::<_, String>(0)
        });

        match result {
            Ok(json_str) => Ok(Some(serde_json::from_str(&json_str)?)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    fn set(&self, namespace: &str, key: &str, value: serde_json::Value) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "INSERT OR REPLACE INTO _shipkit_settings (namespace, key, value, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'))",
            rusqlite::params![namespace, key, serde_json::to_string(&value)?],
        )?;
        Ok(())
    }

    fn get_all(&self, namespace: &str) -> Result<HashMap<String, serde_json::Value>> {
        let conn = self.pool.get()?;
        let mut stmt =
            conn.prepare("SELECT key, value FROM _shipkit_settings WHERE namespace = ?1")?;
        let rows = stmt.query_map(rusqlite::params![namespace], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut map = HashMap::new();
        for row in rows {
            let (key, json_str) = row?;
            map.insert(key, serde_json::from_str(&json_str)?);
        }
        Ok(map)
    }

    fn delete(&self, namespace: &str, key: &str) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute(
            "DELETE FROM _shipkit_settings WHERE namespace = ?1 AND key = ?2",
            rusqlite::params![namespace, key],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::ConnectionPool;

    fn test_store() -> SqliteSettingsStore {
        let pool = ConnectionPool::in_memory().expect("pool");
        SqliteSettingsStore::new(pool).expect("store")
    }

    #[test]
    fn set_and_get() {
        let store = test_store();
        store
            .set("app", "name", serde_json::json!("ShipKit"))
            .expect("set");
        let val = store.get("app", "name").expect("get");
        assert_eq!(val, Some(serde_json::json!("ShipKit")));
    }

    #[test]
    fn get_all_values() {
        let store = test_store();
        store.set("ns", "a", serde_json::json!(1)).expect("set");
        store.set("ns", "b", serde_json::json!(2)).expect("set");
        store.set("ns", "c", serde_json::json!(3)).expect("set");

        let all = store.get_all("ns").expect("get_all");
        assert_eq!(all.len(), 3);
        assert_eq!(all["a"], serde_json::json!(1));
    }

    #[test]
    fn namespace_isolation() {
        let store = test_store();
        store
            .set("ns1", "key", serde_json::json!("a"))
            .expect("set");
        store
            .set("ns2", "key", serde_json::json!("b"))
            .expect("set");

        assert_eq!(
            store.get("ns1", "key").expect("get"),
            Some(serde_json::json!("a"))
        );
        assert_eq!(
            store.get("ns2", "key").expect("get"),
            Some(serde_json::json!("b"))
        );
    }

    #[test]
    fn overwrite() {
        let store = test_store();
        store.set("ns", "key", serde_json::json!(1)).expect("set");
        store.set("ns", "key", serde_json::json!(2)).expect("set");
        assert_eq!(
            store.get("ns", "key").expect("get"),
            Some(serde_json::json!(2))
        );
    }

    #[test]
    fn delete_value() {
        let store = test_store();
        store.set("ns", "key", serde_json::json!(1)).expect("set");
        store.delete("ns", "key").expect("delete");
        assert_eq!(store.get("ns", "key").expect("get"), None);
    }
}

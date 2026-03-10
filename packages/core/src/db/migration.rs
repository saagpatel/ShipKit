//! Database migration engine with checksum verification.

use std::collections::HashMap;
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::db::pool::ConnectionPool;
use crate::error::{Result, ShipKitError};

/// A single database migration.
pub struct Migration {
    pub version: i64,
    pub name: String,
    pub up_sql: String,
    pub down_sql: Option<String>,
}

/// Status of a migration (applied or pending).
#[derive(Debug, Clone, serde::Serialize)]
pub struct MigrationStatus {
    pub version: i64,
    pub name: String,
    pub applied: bool,
    pub applied_at: Option<String>,
}

/// Manages schema migrations with ordering, checksums, and rollback.
pub struct MigrationEngine {
    pool: ConnectionPool,
    migrations: Vec<Migration>,
}

impl MigrationEngine {
    /// Create a new engine. Does not create the tracking table yet.
    pub fn new(pool: ConnectionPool) -> Self {
        Self {
            pool,
            migrations: Vec::new(),
        }
    }

    /// Register a migration. Returns `&mut Self` for chaining.
    pub fn register(&mut self, migration: Migration) -> &mut Self {
        self.migrations.push(migration);
        self.migrations.sort_by_key(|m| m.version);
        self
    }

    /// Load migrations from a directory of `.sql` files.
    ///
    /// Files must be named `{NNN}_{name}.sql` where NNN is a numeric version.
    /// If a file contains a line `-- DOWN` by itself, everything after it is the
    /// down migration.
    pub fn register_from_dir(&mut self, dir: impl AsRef<Path>) -> Result<&mut Self> {
        let dir = dir.as_ref();
        let mut entries: Vec<_> = std::fs::read_dir(dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "sql"))
            .collect();
        entries.sort_by_key(|e| e.file_name());

        for entry in entries {
            let filename = entry.file_name();
            let filename = filename.to_string_lossy();

            let (version_str, name) = filename
                .strip_suffix(".sql")
                .and_then(|s| s.split_once('_'))
                .ok_or_else(|| {
                    ShipKitError::Migration(format!(
                        "invalid migration filename: {filename} (expected NNN_name.sql)"
                    ))
                })?;

            let version: i64 = version_str.parse().map_err(|_| {
                ShipKitError::Migration(format!(
                    "invalid version number in migration filename: {filename}"
                ))
            })?;

            let content = std::fs::read_to_string(entry.path())?;
            let (up_sql, down_sql) = if let Some(idx) = content.find("\n-- DOWN\n") {
                (
                    content[..idx].to_string(),
                    Some(content[idx + "\n-- DOWN\n".len()..].to_string()),
                )
            } else {
                (content, None)
            };

            self.migrations.push(Migration {
                version,
                name: name.to_string(),
                up_sql,
                down_sql,
            });
        }

        self.migrations.sort_by_key(|m| m.version);
        Ok(self)
    }

    /// Apply all pending migrations. Returns status of all migrations.
    pub fn apply_pending(&mut self) -> Result<Vec<MigrationStatus>> {
        self.ensure_tracking_table()?;
        let applied = self.get_applied()?;

        for migration in &self.migrations {
            if let Some(existing_checksum) = applied.get(&migration.version) {
                let current_checksum = Self::checksum(&migration.up_sql);
                if *existing_checksum != current_checksum {
                    return Err(ShipKitError::Migration(format!(
                        "checksum mismatch for migration {}: {}",
                        migration.version, migration.name
                    )));
                }
                continue; // already applied
            }

            let conn = self.pool.get()?;
            let tx = conn.unchecked_transaction()?;
            match tx.execute_batch(&migration.up_sql) {
                Ok(()) => {
                    tx.execute(
                        "INSERT INTO _shipkit_migrations (version, name, checksum) VALUES (?1, ?2, ?3)",
                        rusqlite::params![
                            migration.version,
                            migration.name,
                            Self::checksum(&migration.up_sql),
                        ],
                    )?;
                    tx.commit()?;
                }
                Err(e) => {
                    // Transaction rolls back on drop
                    return Err(ShipKitError::Migration(format!(
                        "migration {} ({}) failed: {e}",
                        migration.version, migration.name
                    )));
                }
            }
        }

        self.status()
    }

    /// Rollback the most recently applied migration.
    pub fn rollback_last(&mut self) -> Result<Option<MigrationStatus>> {
        self.ensure_tracking_table()?;
        let applied = self.get_applied()?;

        // Find the highest applied version
        let last_version = applied.keys().max().copied();
        let Some(last_version) = last_version else {
            return Ok(None);
        };

        let migration = self
            .migrations
            .iter()
            .find(|m| m.version == last_version)
            .ok_or_else(|| {
                ShipKitError::Migration(format!(
                    "migration {last_version} is applied but not registered"
                ))
            })?;

        let down_sql = migration.down_sql.as_ref().ok_or_else(|| {
            ShipKitError::Migration(format!(
                "migration {} ({}) has no down SQL",
                migration.version, migration.name
            ))
        })?;

        let conn = self.pool.get()?;
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(down_sql)?;
        tx.execute(
            "DELETE FROM _shipkit_migrations WHERE version = ?1",
            rusqlite::params![last_version],
        )?;
        tx.commit()?;

        Ok(Some(MigrationStatus {
            version: migration.version,
            name: migration.name.clone(),
            applied: false,
            applied_at: None,
        }))
    }

    /// Get the status of all registered migrations.
    pub fn status(&self) -> Result<Vec<MigrationStatus>> {
        self.ensure_tracking_table()?;
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("SELECT version, applied_at FROM _shipkit_migrations")?;
        let applied: HashMap<i64, String> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(self
            .migrations
            .iter()
            .map(|m| MigrationStatus {
                version: m.version,
                name: m.name.clone(),
                applied: applied.contains_key(&m.version),
                applied_at: applied.get(&m.version).cloned(),
            })
            .collect())
    }

    fn ensure_tracking_table(&self) -> Result<()> {
        let conn = self.pool.get()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _shipkit_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;
        Ok(())
    }

    fn get_applied(&self) -> Result<HashMap<i64, String>> {
        let conn = self.pool.get()?;
        let mut stmt = conn.prepare("SELECT version, checksum FROM _shipkit_migrations")?;
        let map: HashMap<i64, String> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(map)
    }

    fn checksum(sql: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(sql.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_pool() -> ConnectionPool {
        ConnectionPool::in_memory().expect("in-memory pool")
    }

    #[test]
    fn apply_single_migration() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool.clone());
        engine.register(Migration {
            version: 1,
            name: "create_users".into(),
            up_sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);".into(),
            down_sql: Some("DROP TABLE users;".into()),
        });

        let statuses = engine.apply_pending().expect("apply");
        assert_eq!(statuses.len(), 1);
        assert!(statuses[0].applied);

        // Verify table exists
        let conn = pool.get().expect("conn");
        conn.execute("INSERT INTO users (name) VALUES ('test')", [])
            .expect("insert into created table");
    }

    #[test]
    fn apply_multiple_migrations() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool.clone());
        engine
            .register(Migration {
                version: 1,
                name: "create_users".into(),
                up_sql: "CREATE TABLE users (id INTEGER PRIMARY KEY);".into(),
                down_sql: Some("DROP TABLE users;".into()),
            })
            .register(Migration {
                version: 2,
                name: "create_posts".into(),
                up_sql: "CREATE TABLE posts (id INTEGER PRIMARY KEY);".into(),
                down_sql: Some("DROP TABLE posts;".into()),
            })
            .register(Migration {
                version: 3,
                name: "create_comments".into(),
                up_sql: "CREATE TABLE comments (id INTEGER PRIMARY KEY);".into(),
                down_sql: Some("DROP TABLE comments;".into()),
            });

        let statuses = engine.apply_pending().expect("apply");
        assert_eq!(statuses.len(), 3);
        assert!(statuses.iter().all(|s| s.applied));
    }

    #[test]
    fn idempotent_apply() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register(Migration {
            version: 1,
            name: "create_t".into(),
            up_sql: "CREATE TABLE t (id INTEGER PRIMARY KEY);".into(),
            down_sql: None,
        });

        engine.apply_pending().expect("first apply");
        let statuses = engine.apply_pending().expect("second apply");
        assert_eq!(statuses.len(), 1);
        assert!(statuses[0].applied);
    }

    #[test]
    fn rollback_last() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool.clone());
        engine
            .register(Migration {
                version: 1,
                name: "create_a".into(),
                up_sql: "CREATE TABLE a (id INTEGER PRIMARY KEY);".into(),
                down_sql: Some("DROP TABLE a;".into()),
            })
            .register(Migration {
                version: 2,
                name: "create_b".into(),
                up_sql: "CREATE TABLE b (id INTEGER PRIMARY KEY);".into(),
                down_sql: Some("DROP TABLE b;".into()),
            });

        engine.apply_pending().expect("apply");

        let rolled_back = engine.rollback_last().expect("rollback");
        assert!(rolled_back.is_some());
        assert_eq!(rolled_back.as_ref().map(|s| s.version), Some(2));

        let statuses = engine.status().expect("status");
        assert!(statuses[0].applied);
        assert!(!statuses[1].applied);

        // Verify table b is gone
        let conn = pool.get().expect("conn");
        let err = conn.execute("INSERT INTO b (id) VALUES (1)", []);
        assert!(err.is_err());
    }

    #[test]
    fn rollback_without_down_sql() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register(Migration {
            version: 1,
            name: "create_t".into(),
            up_sql: "CREATE TABLE t (id INTEGER PRIMARY KEY);".into(),
            down_sql: None,
        });

        engine.apply_pending().expect("apply");

        let result = engine.rollback_last();
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("no down SQL"));
    }

    #[test]
    fn transaction_rollback_on_bad_sql() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register(Migration {
            version: 1,
            name: "bad_migration".into(),
            up_sql: "THIS IS NOT VALID SQL;".into(),
            down_sql: None,
        });

        let result = engine.apply_pending();
        assert!(result.is_err());

        // Verify migration was NOT recorded
        let statuses = engine.status().expect("status");
        assert!(!statuses[0].applied);
    }

    #[test]
    fn checksum_mismatch() {
        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register(Migration {
            version: 1,
            name: "create_t".into(),
            up_sql: "CREATE TABLE t (id INTEGER PRIMARY KEY);".into(),
            down_sql: None,
        });
        engine.apply_pending().expect("first apply");

        // Now register same version with different SQL
        engine.migrations.clear();
        engine.register(Migration {
            version: 1,
            name: "create_t".into(),
            up_sql: "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT);".into(),
            down_sql: None,
        });

        let result = engine.apply_pending();
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("checksum mismatch"));
    }

    #[test]
    fn file_based_loading() {
        let tmp = TempDir::new().expect("tmp dir");

        std::fs::write(
            tmp.path().join("001_create_users.sql"),
            "CREATE TABLE users (id INTEGER PRIMARY KEY);",
        )
        .expect("write file");

        std::fs::write(
            tmp.path().join("002_create_posts.sql"),
            "CREATE TABLE posts (id INTEGER PRIMARY KEY);",
        )
        .expect("write file");

        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register_from_dir(tmp.path()).expect("load dir");

        assert_eq!(engine.migrations.len(), 2);
        assert_eq!(engine.migrations[0].version, 1);
        assert_eq!(engine.migrations[0].name, "create_users");
        assert_eq!(engine.migrations[1].version, 2);
    }

    #[test]
    fn file_based_with_down_section() {
        let tmp = TempDir::new().expect("tmp dir");

        std::fs::write(
            tmp.path().join("001_create_users.sql"),
            "CREATE TABLE users (id INTEGER PRIMARY KEY);\n-- DOWN\nDROP TABLE users;",
        )
        .expect("write file");

        let pool = test_pool();
        let mut engine = MigrationEngine::new(pool);
        engine.register_from_dir(tmp.path()).expect("load dir");

        assert_eq!(engine.migrations.len(), 1);
        assert!(engine.migrations[0].down_sql.is_some());
        assert_eq!(
            engine.migrations[0].down_sql.as_deref(),
            Some("DROP TABLE users;")
        );
    }
}

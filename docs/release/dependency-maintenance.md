# Dependency Maintenance

ShipKit keeps Rust dependency updates small, but paired crates may need coordinated changes when upstream APIs move together.

- `sha2` 0.11 returns a digest array that is rendered to migration checksums by iterating bytes and formatting each byte as lowercase hexadecimal.
- SQLite crates must stay aligned so only one `libsqlite3-sys` package links the native `sqlite3` library.

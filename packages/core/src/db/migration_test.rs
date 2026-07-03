use super::migration::MigrationEngine;

#[test]
fn checksum_outputs_lowercase_hex_digest() {
    let checksum = MigrationEngine::checksum("CREATE TABLE test (id INTEGER);");

    assert_eq!(checksum.len(), 64);
    assert!(checksum.chars().all(|ch| ch.is_ascii_hexdigit()));
    assert_eq!(checksum, checksum.to_ascii_lowercase());
}

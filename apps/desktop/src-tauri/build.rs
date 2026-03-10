fn main() {
    if let Err(error) = tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "migration_status",
            "apply_migrations",
            "rollback_migration",
            "get_setting",
            "set_setting",
            "get_all_settings",
            "load_settings",
            "save_settings",
            "get_desktop_settings",
            "save_desktop_settings",
            "reset_desktop_settings",
            "export_desktop_settings",
            "import_desktop_settings",
            "list_plugins",
            "set_plugin_enabled_state",
            "get_theme",
            "set_theme",
            "list_themes",
            "get_css_variables",
            "get_log_entries",
            "get_app_overview",
            "export_support_bundle",
            "list_support_bundles",
            "clear_support_bundles",
            "restore_desktop_settings_from_bundle",
        ]),
    )) {
        eprintln!("failed to run tauri build script: {error}");
        std::process::exit(1);
    }
}

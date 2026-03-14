import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { getAppOverview, getDesktopSettings } from "./lib/invoke";

vi.mock("./lib/invoke", () => ({
  migrationStatus: vi.fn().mockResolvedValue([]),
  applyMigrations: vi.fn().mockResolvedValue([]),
  rollbackMigration: vi.fn().mockResolvedValue(null),
  formatCommandError: vi.fn((error: unknown) => {
    if (error && typeof error === "object") {
      const candidate = error as { code?: string; message?: string };
      if (candidate.message && candidate.code) {
        return `${candidate.message} (${candidate.code})`;
      }
    }

    return String(error);
  }),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getAllSettings: vi.fn().mockResolvedValue({}),
  loadSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getDesktopSettings: vi.fn().mockResolvedValue({
    startup_route: "home",
    default_settings_namespace: "demo",
    default_log_level: "all",
    confirm_before_rollback: true,
  }),
  saveDesktopSettings: vi.fn().mockResolvedValue({
    startup_route: "home",
    default_settings_namespace: "demo",
    default_log_level: "all",
    confirm_before_rollback: true,
  }),
  resetDesktopSettings: vi.fn().mockResolvedValue({
    startup_route: "home",
    default_settings_namespace: "demo",
    default_log_level: "all",
    confirm_before_rollback: true,
  }),
  exportDesktopSettings: vi.fn().mockResolvedValue(
    JSON.stringify({
      startup_route: "home",
      default_settings_namespace: "demo",
      default_log_level: "all",
      confirm_before_rollback: true,
    }),
  ),
  importDesktopSettings: vi.fn().mockResolvedValue({
    startup_route: "home",
    default_settings_namespace: "demo",
    default_log_level: "all",
    confirm_before_rollback: true,
  }),
  getTheme: vi.fn().mockResolvedValue({ name: "ocean", mode: "dark", variables: {} }),
  setTheme: vi.fn().mockResolvedValue({ name: "ocean", mode: "dark", variables: {} }),
  listThemes: vi.fn().mockResolvedValue([{ name: "ocean", mode: "dark", variables: {} }]),
  getCssVariables: vi.fn().mockResolvedValue(":root { --sk-accent: #4e84ff; }"),
  getLogEntries: vi.fn().mockResolvedValue([]),
  getAppOverview: vi.fn().mockResolvedValue({
    app_name: "ShipKit Desktop",
    version: "0.1.0",
    platform: "macos",
    data_dir: "/tmp/shipkit",
    database_path: "/tmp/shipkit/data.db",
    log_dir: "/tmp/shipkit/logs",
    support_dir: "/tmp/shipkit/support",
    active_theme: "dark",
    pending_migrations: 1,
    applied_migrations: 2,
    enabled_plugins: 1,
    available_plugins: 3,
  }),
  exportSupportBundle: vi.fn().mockResolvedValue({
    path: "/tmp/shipkit/support/support-bundle.json",
    generated_at: "2026-03-10T00:00:00Z",
    log_entry_count: 8,
  }),
  listSupportBundles: vi.fn().mockResolvedValue([
    {
      path: "/tmp/shipkit/support/support-bundle.json",
      generated_at: "2026-03-10T00:00:00Z",
      size_bytes: 1024,
    },
  ]),
  clearSupportBundles: vi.fn().mockResolvedValue(1),
  restoreDesktopSettingsFromBundle: vi.fn().mockResolvedValue({
    startup_route: "logs",
    default_settings_namespace: "ops",
    default_log_level: "WARN",
    confirm_before_rollback: false,
  }),
  listPlugins: vi.fn().mockResolvedValue([
    {
      id: "shipkit.release-brief",
      name: "Release Brief",
      version: "1.0.0",
      description: "Creates a concise release brief from local metadata.",
      category: "release",
      distribution: "curated-signed",
      min_shipkit_version: "0.1.0",
      compatibility: ">=0.1.0",
      capabilities: ["release", "notes"],
      enabled: true,
    },
    {
      id: "shipkit.runtime-snapshot",
      name: "Runtime Snapshot",
      version: "1.0.0",
      description: "Captures runtime state for local debugging.",
      category: "diagnostics",
      distribution: "curated-signed",
      min_shipkit_version: "0.1.0",
      compatibility: ">=0.1.0",
      capabilities: ["diagnostics"],
      enabled: false,
    },
  ]),
  setPluginEnabledState: vi.fn().mockResolvedValue([]),
}));

vi.mock("./lib/updater", () => ({
  getUpdateBuildDefaults: vi.fn(() => ({
    channel: "canary",
    host: "github-releases",
    repository: "example/shipkit",
    manifestUrl: "https://github.com/example/shipkit/releases/latest/download/latest.json",
  })),
  checkForUpdates: vi.fn().mockResolvedValue({
    update: null,
    summary: null,
  }),
  downloadAndInstallUpdate: vi.fn().mockResolvedValue(undefined),
  relaunchAfterUpdate: vi.fn().mockResolvedValue(undefined),
}));

describe("App shell", () => {
  const initialHash = window.location.hash;

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/home";
  });

  afterEach(() => {
    cleanup();
    window.location.hash = initialHash;
  });

  it("renders the home workspace by default", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText(/monitor runtime health/i)).toBeInTheDocument();
  });

  it("uses desktop preferences when no hash route is provided", async () => {
    vi.mocked(getDesktopSettings).mockResolvedValueOnce({
      startup_route: "diagnostics",
      default_settings_namespace: "demo",
      default_log_level: "all",
      confirm_before_rollback: true,
    });
    window.location.hash = "";

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Diagnostics" }),
    ).toBeInTheDocument();
  });

  it("navigates between workspace sections", async () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: /primary/i });

    fireEvent.click(within(navigation).getByRole("button", { name: /settings/i }));
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: /logs/i }));
    expect(await screen.findByRole("heading", { name: "Logs" })).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: /updates/i }));
    expect(await screen.findByRole("heading", { name: "Updates" })).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: /plugins/i }));
    expect(await screen.findByRole("heading", { name: "Plugins" })).toBeInTheDocument();
  });

  it("opens diagnostics and exports a support bundle", async () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: /primary/i });
    const diagnosticsNavButton = within(navigation).getByRole("button", {
      name: /^diagnostics\b/i,
    });

    fireEvent.click(diagnosticsNavButton);

    expect(
      await screen.findByRole("heading", { name: "Diagnostics" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("/tmp/shipkit/support")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("main")).getByRole("button", {
        name: /^export support bundle$/i,
      }),
    );

    expect(
      await screen.findByText(/support bundle exported to/i),
    ).toBeInTheDocument();
  });

  it("shows a diagnostics error state when overview loading fails", async () => {
    vi.mocked(getAppOverview).mockRejectedValueOnce({
      code: "support.overview_failed",
      message: "Overview unavailable",
      details: "test",
    });

    render(<App />);

    const navigation = screen.getByRole("navigation", { name: /primary/i });
    const diagnosticsNavButton = within(navigation).getByRole("button", {
      name: /^diagnostics\b/i,
    });

    fireEvent.click(diagnosticsNavButton);

    expect(
      await screen.findByText("Overview unavailable (support.overview_failed)"),
    ).toBeInTheDocument();
  });
});

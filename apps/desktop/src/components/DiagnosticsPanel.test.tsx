import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSupportBundles,
  exportSupportBundle,
  getAppOverview,
  listSupportBundles,
  restoreDesktopSettingsFromBundle,
} from "../lib/invoke";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

const initialOverview = {
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
};

const refreshedOverview = {
  ...initialOverview,
  support_dir: "/tmp/shipkit/support-v2",
  active_theme: "ocean",
  enabled_plugins: 2,
};

const initialArtifact = {
  path: "/tmp/shipkit/support/support-bundle.json",
  generated_at: "2026-03-10T00:00:00Z",
  size_bytes: 1024,
};

const refreshedArtifact = {
  path: "/tmp/shipkit/support-v2/support-bundle-2.json",
  generated_at: "2026-03-10T00:10:00Z",
  size_bytes: 2048,
};

let currentOverview = { ...initialOverview };
let currentArtifacts = [initialArtifact];

vi.mock("../lib/invoke", () => ({
  formatCommandError: vi.fn((error: unknown) => {
    if (error && typeof error === "object") {
      const candidate = error as { code?: string; message?: string };
      if (candidate.message && candidate.code) {
        return `${candidate.message} (${candidate.code})`;
      }
    }

    return String(error);
  }),
  getAppOverview: vi.fn().mockImplementation(() => Promise.resolve({ ...currentOverview })),
  exportSupportBundle: vi.fn().mockImplementation(() => {
    currentOverview = { ...refreshedOverview };
    currentArtifacts = [{ ...refreshedArtifact }];
    return Promise.resolve({
      path: refreshedArtifact.path,
      generated_at: refreshedArtifact.generated_at,
      log_entry_count: 8,
      enabled_plugin_names: ["Release Brief", "Runtime Snapshot"],
    });
  }),
  listSupportBundles: vi.fn().mockImplementation(() =>
    Promise.resolve(currentArtifacts.map((artifact) => ({ ...artifact }))),
  ),
  clearSupportBundles: vi.fn().mockImplementation(() => {
    currentArtifacts = [];
    return Promise.resolve(1);
  }),
  restoreDesktopSettingsFromBundle: vi.fn().mockResolvedValue({
    startup_route: "logs",
    default_settings_namespace: "ops",
    default_log_level: "WARN",
    confirm_before_rollback: false,
  }),
}));

describe("DiagnosticsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOverview = { ...initialOverview };
    currentArtifacts = [{ ...initialArtifact }];
  });

  afterEach(() => {
    cleanup();
  });

  it("loads support bundle history and clears bundles", async () => {
    render(<DiagnosticsPanel />);

    expect(
      await screen.findByText("/tmp/shipkit/support/support-bundle.json"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear support bundles/i }));

    expect(clearSupportBundles).toHaveBeenCalled();
    expect(await screen.findByText(/cleared 1 support bundle/i)).toBeInTheDocument();
  });

  it("refreshes overview and recovery history after exporting a support bundle", async () => {
    currentArtifacts = [];
    render(<DiagnosticsPanel />);

    expect(await screen.findByText("/tmp/shipkit/support")).toBeInTheDocument();
    expect(screen.getByText(/no support bundles have been exported yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /export support bundle/i }));

    expect(exportSupportBundle).toHaveBeenCalled();
    expect(
      await screen.findByText(/support bundle exported with 8 recent log entries/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/enabled plugins: release brief, runtime snapshot/i),
    ).toBeInTheDocument();
    expect(await screen.findByText("/tmp/shipkit/support-v2")).toBeInTheDocument();
    expect(
      await screen.findAllByText("/tmp/shipkit/support-v2/support-bundle-2.json"),
    ).toHaveLength(2);
    expect(await screen.findByText("ocean")).toBeInTheDocument();
    expect(
      await screen.findByText("2 curated plugin(s) enabled in this workspace."),
    ).toBeInTheDocument();
    expect(vi.mocked(getAppOverview)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listSupportBundles)).toHaveBeenCalledTimes(2);
  });

  it("keeps recovery history visible when clearing support bundles fails", async () => {
    vi.mocked(clearSupportBundles).mockRejectedValueOnce({
      code: "support.clear_failed",
      message: "Support bundles could not be cleared.",
      details: "filesystem busy",
    });

    render(<DiagnosticsPanel />);

    expect(
      await screen.findByText("/tmp/shipkit/support/support-bundle.json"),
    ).toBeInTheDocument();

    const clearButton = screen.getByRole("button", { name: /clear support bundles/i });
    fireEvent.click(clearButton);

    expect(clearSupportBundles).toHaveBeenCalled();
    expect(
      await screen.findByText("Support bundles could not be cleared. (support.clear_failed)"),
    ).toBeInTheDocument();
    expect(screen.getByText("/tmp/shipkit/support/support-bundle.json")).toBeInTheDocument();
    await waitFor(() => expect(clearButton).not.toBeDisabled());
  });

  it("restores desktop preferences from a support bundle artifact", async () => {
    const updateSpy = vi.fn();
    window.addEventListener("shipkit:desktop-settings-updated", updateSpy);

    render(<DiagnosticsPanel />);

    expect(
      await screen.findByText("/tmp/shipkit/support/support-bundle.json"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restore preferences/i }));

    expect(restoreDesktopSettingsFromBundle).toHaveBeenCalledWith(
      "/tmp/shipkit/support/support-bundle.json",
    );
    expect(
      await screen.findByText(
        /restored desktop preferences from \/tmp\/shipkit\/support\/support-bundle\.json/i,
      ),
    ).toBeInTheDocument();
    expect(updateSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener("shipkit:desktop-settings-updated", updateSpy);
  });

  it("shows a loading-safe refresh state while overview data is being read", async () => {
    let resolveOverview!: (value: typeof currentOverview) => void;
    vi.mocked(getAppOverview).mockImplementationOnce(
      () =>
        new Promise<typeof currentOverview>((resolve) => {
          resolveOverview = resolve;
        }),
    );

    render(<DiagnosticsPanel />);

    expect(await screen.findByRole("button", { name: /refreshing/i })).toBeDisabled();

    resolveOverview({ ...initialOverview });
    expect(await screen.findByText("/tmp/shipkit/support")).toBeInTheDocument();
  });
});

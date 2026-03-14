import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdatesPanel } from "./UpdatesPanel";
import { getAppOverview } from "../lib/invoke";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  getUpdateBuildDefaults,
  inspectConfiguredFeed,
  relaunchAfterUpdate,
} from "../lib/updater";

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
  getAppOverview: vi.fn().mockResolvedValue({
    app_name: "ShipKit Desktop",
    version: "0.1.0",
    platform: "darwin",
    data_dir: "/tmp/shipkit",
    database_path: "/tmp/shipkit/data.db",
    log_dir: "/tmp/shipkit/logs",
    support_dir: "/tmp/shipkit/support",
    active_theme: "dark",
    pending_migrations: 0,
    applied_migrations: 2,
    enabled_plugins: 1,
    available_plugins: 3,
  }),
}));

vi.mock("../lib/updater", () => ({
  getUpdateBuildDefaults: vi.fn(() => ({
    channel: "canary",
    host: "github-releases",
    repository: "example/shipkit",
    manifestUrl: "https://github.com/example/shipkit/releases/latest/download/latest.json",
  })),
  checkForUpdates: vi.fn(),
  downloadAndInstallUpdate: vi.fn(),
  inspectConfiguredFeed: vi.fn(),
  relaunchAfterUpdate: vi.fn(),
}));

describe("UpdatesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUpdateBuildDefaults).mockReturnValue({
      channel: "canary",
      host: "github-releases",
      repository: "example/shipkit",
      manifestUrl: "https://github.com/example/shipkit/releases/latest/download/latest.json",
    });
    vi.mocked(getAppOverview).mockResolvedValue({
      app_name: "ShipKit Desktop",
      version: "0.1.0",
      platform: "darwin",
      data_dir: "/tmp/shipkit",
      database_path: "/tmp/shipkit/data.db",
      log_dir: "/tmp/shipkit/logs",
      support_dir: "/tmp/shipkit/support",
      active_theme: "dark",
      pending_migrations: 0,
      applied_migrations: 2,
      enabled_plugins: 1,
      available_plugins: 3,
    });
    vi.mocked(inspectConfiguredFeed).mockResolvedValue({
      endpoint: "https://github.com/example/shipkit/releases/latest/download/latest.json",
      version: "0.2.0",
      pubDate: "2026-03-10T00:00:00Z",
      notes: "Signed canary release",
      artifactUrl: "https://github.com/example/shipkit/releases/download/v0.2.0/ShipKit.zip",
      signaturePresent: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("checks, installs, and restarts when an update is available", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const updateHandle = { close } as never;

    vi.mocked(checkForUpdates).mockResolvedValue({
      update: updateHandle,
      summary: {
        currentVersion: "0.1.0",
        version: "0.2.0",
        date: "2026-03-10",
        body: "New release notes",
      },
    });
    vi.mocked(downloadAndInstallUpdate).mockImplementation(async (_, onProgress) => {
      onProgress?.({
        phase: "started",
        downloadedBytes: 0,
        totalBytes: 100,
        percent: 0,
      });
      onProgress?.({
        phase: "finished",
        downloadedBytes: 100,
        totalBytes: 100,
        percent: 100,
      });
    });
    vi.mocked(relaunchAfterUpdate).mockResolvedValue(undefined);

    render(<UpdatesPanel />);

    fireEvent.click(
      await screen.findByRole("button", { name: /check for updates/i }),
    );

    expect(
      await screen.findByText(/version 0.2.0 is available for download/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/new release notes/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /download and install/i }));

    expect(
      await screen.findByText(/update downloaded and installed/i),
    ).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /restart to apply/i }));

    expect(relaunchAfterUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows a setup error when the update check fails", async () => {
    vi.mocked(checkForUpdates).mockRejectedValue({
      code: "updater.not_configured",
      message: "Updater feed is not configured for this build",
    });

    render(<UpdatesPanel />);

    fireEvent.click(
      await screen.findByRole("button", { name: /check for updates/i }),
    );

    expect(
      await screen.findByText(
        "Updater feed is not configured for this build (updater.not_configured)",
      ),
    ).toBeInTheDocument();
  });

  it("inspects the configured feed endpoint before a live update check", async () => {
    render(<UpdatesPanel />);

    fireEvent.click(
      await screen.findByRole("button", { name: /validate feed endpoint/i }),
    );

    expect(inspectConfiguredFeed).toHaveBeenCalledWith(
      "https://github.com/example/shipkit/releases/latest/download/latest.json",
    );
    expect(
      await screen.findByText(/feed validation found version 0.2.0/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "https://github.com/example/shipkit/releases/latest/download/latest.json",
      ),
    ).toHaveLength(2);
    expect(screen.getByText("Present")).toBeInTheDocument();
  });

  it("shows an unconfigured build hint when no feed is embedded", async () => {
    vi.mocked(getUpdateBuildDefaults).mockReturnValue({
      channel: "canary",
      host: "github-releases",
      repository: null,
      manifestUrl: null,
    });

    render(<UpdatesPanel />);

    expect(await screen.findByText("Not embedded in this build yet")).toBeInTheDocument();
  });
});

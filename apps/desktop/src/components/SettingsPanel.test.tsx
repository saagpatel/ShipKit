import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportDesktopSettings,
  getDesktopSettings,
  importDesktopSettings,
  resetDesktopSettings,
  saveDesktopSettings,
} from "../lib/invoke";
import { DatabasePanel } from "./DatabasePanel";
import { LogPanel } from "./LogPanel";
import { SettingsPanel } from "./SettingsPanel";

const defaultSettings = {
  startup_route: "home",
  default_settings_namespace: "demo",
  default_log_level: "all",
  confirm_before_rollback: true,
};

const alternateSettings = {
  startup_route: "diagnostics",
  default_settings_namespace: "workspace",
  default_log_level: "ERROR",
  confirm_before_rollback: false,
};

let currentSettings = { ...defaultSettings };

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
  getDesktopSettings: vi.fn().mockImplementation(() => Promise.resolve({ ...currentSettings })),
  saveDesktopSettings: vi.fn().mockImplementation((settings) => {
    currentSettings = { ...settings };
    return Promise.resolve({ ...settings });
  }),
  resetDesktopSettings: vi.fn().mockImplementation(() => {
    currentSettings = { ...defaultSettings };
    return Promise.resolve({ ...defaultSettings });
  }),
  exportDesktopSettings: vi.fn().mockImplementation(() =>
    Promise.resolve(JSON.stringify(currentSettings, null, 2)),
  ),
  importDesktopSettings: vi.fn().mockImplementation((payload: string) => {
    const nextSettings = JSON.parse(payload);
    currentSettings = { ...currentSettings, ...nextSettings };
    return Promise.resolve({ ...currentSettings });
  }),
  getSetting: vi.fn().mockResolvedValue(null),
  setSetting: vi.fn().mockResolvedValue(undefined),
  loadSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getDatabaseOverview: vi.fn().mockResolvedValue({
    total_registered: 1,
    applied_count: 1,
    pending_count: 0,
    last_applied_version: 1,
    last_applied_name: "create_notes",
    rollback_available: true,
    rollback_reason: null,
    operation_warning: null,
  }),
  migrationStatus: vi.fn().mockResolvedValue([
    {
      version: 1,
      name: "create_notes",
      applied: true,
      applied_at: "2026-03-10T00:00:00Z",
    },
  ]),
  applyMigrations: vi.fn().mockResolvedValue([]),
  rollbackMigration: vi.fn().mockResolvedValue(null),
  getLogEntries: vi.fn().mockImplementation((_count?: number, level?: string) =>
    Promise.resolve([
      {
        timestamp: "2026-03-10T00:00:00Z",
        level: level ?? "INFO",
        message: `filtered:${level ?? "all"}`,
        target: "shipkit",
        fields: null,
      },
    ]),
  ),
}));

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSettings = { ...defaultSettings };
  });

  afterEach(() => {
    cleanup();
  });

  it("saves typed desktop preferences", async () => {
    render(<SettingsPanel />);

    expect(await screen.findByRole("option", { name: "Plugins" })).toBeInTheDocument();

    fireEvent.change(await screen.findByLabelText(/startup route/i), {
      target: { value: "diagnostics" },
    });
    fireEvent.change(screen.getByLabelText(/default log level/i), {
      target: { value: "ERROR" },
    });
    fireEvent.change(screen.getByLabelText(/default settings namespace/i), {
      target: { value: "workspace" },
    });
    fireEvent.click(screen.getByLabelText(/confirm before rollback/i));
    fireEvent.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(saveDesktopSettings).toHaveBeenCalledWith({
      startup_route: "diagnostics",
      default_settings_namespace: "workspace",
      default_log_level: "ERROR",
      confirm_before_rollback: false,
    });
    expect(await screen.findByText(/desktop preferences saved/i)).toBeInTheDocument();
  });

  it("imports portable desktop settings json", async () => {
    render(<SettingsPanel />);

    fireEvent.change(await screen.findByLabelText(/preferences json/i), {
      target: {
        value: JSON.stringify({
          startup_route: "logs",
          default_settings_namespace: "ops",
          default_log_level: "WARN",
          confirm_before_rollback: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /import json/i }));

    expect(importDesktopSettings).toHaveBeenCalled();
    expect(await screen.findByText(/desktop preferences imported/i)).toBeInTheDocument();
  });

  it("keeps current preferences visible when import fails", async () => {
    const updateSpy = vi.fn();
    window.addEventListener("shipkit:desktop-settings-updated", updateSpy);
    vi.mocked(importDesktopSettings).mockRejectedValueOnce({
      code: "preferences.import_invalid_payload",
      message: "Desktop settings import failed.",
      details: "desktop settings import payload must be a JSON object",
    });

    render(<SettingsPanel />);

    const attemptedPayload = '{"startup_route":"logs"';
    fireEvent.change(await screen.findByLabelText(/preferences json/i), {
      target: { value: attemptedPayload },
    });
    fireEvent.click(screen.getByRole("button", { name: /import json/i }));

    expect(
      await screen.findByText(
        "Desktop settings import failed. (preferences.import_invalid_payload)",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/startup route/i)).toHaveValue("home");
    expect(screen.getByLabelText(/default settings namespace/i)).toHaveValue("demo");
    expect(screen.getByLabelText(/preferences json/i)).toHaveValue(attemptedPayload);
    expect(updateSpy).not.toHaveBeenCalled();

    window.removeEventListener("shipkit:desktop-settings-updated", updateSpy);
  });

  it("refreshes exported desktop settings json", async () => {
    render(<SettingsPanel />);

    fireEvent.click(await screen.findByRole("button", { name: /refresh json/i }));

    expect(exportDesktopSettings).toHaveBeenCalled();
    expect(
      await screen.findByText(/desktop preferences json refreshed/i),
    ).toBeInTheDocument();
  });

  it("propagates reset desktop settings to database and logs listeners", async () => {
    currentSettings = { ...alternateSettings };

    render(
      <>
        <SettingsPanel />
        <DatabasePanel />
        <LogPanel />
      </>,
    );

    expect(await screen.findByText(/rollback confirmation is/i)).toHaveTextContent(
      /disabled/i,
    );
    expect(await screen.findByText("filtered:ERROR")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset to defaults/i }));

    expect(resetDesktopSettings).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText(/rollback confirmation is/i)).toHaveTextContent(/enabled/i),
    );
    expect(await screen.findByText("filtered:all")).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(getDesktopSettings).mock.calls.length).toBeGreaterThan(2),
    );
  });
});

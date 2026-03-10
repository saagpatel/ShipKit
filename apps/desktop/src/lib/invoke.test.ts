import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppCommandError,
  formatCommandError,
  getAppOverview,
  restoreDesktopSettingsFromBundle,
} from "./invoke";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("invoke command normalization", () => {
  beforeEach(() => {
    vi.mocked(tauriInvoke).mockReset();
  });

  it("normalizes structured Tauri command errors", async () => {
    vi.mocked(tauriInvoke).mockRejectedValue({
      code: "theme.lock_failed",
      message: "Theme engine is unavailable",
      details: "poisoned lock",
    });

    await expect(getAppOverview()).rejects.toEqual(
      expect.objectContaining<AppCommandError>({
        name: "AppCommandError",
        code: "theme.lock_failed",
        message: "Theme engine is unavailable",
        details: "poisoned lock",
      }),
    );
  });

  it("degrades plain string command failures into predictable errors", async () => {
    vi.mocked(tauriInvoke).mockRejectedValue("backend exploded");

    await expect(getAppOverview()).rejects.toEqual(
      expect.objectContaining<AppCommandError>({
        name: "AppCommandError",
        code: "command.unknown",
        message: "backend exploded",
        details: "backend exploded",
      }),
    );
    expect(formatCommandError("backend exploded")).toBe(
      "backend exploded (command.unknown)",
    );
  });

  it("passes support bundle restore arguments through invoke", async () => {
    vi.mocked(tauriInvoke).mockResolvedValue({
      startup_route: "logs",
      default_settings_namespace: "ops",
      default_log_level: "WARN",
      confirm_before_rollback: false,
    });

    await restoreDesktopSettingsFromBundle("/tmp/shipkit/support/support-bundle.json");

    expect(tauriInvoke).toHaveBeenCalledWith(
      "restore_desktop_settings_from_bundle",
      { path: "/tmp/shipkit/support/support-bundle.json" },
    );
  });
});

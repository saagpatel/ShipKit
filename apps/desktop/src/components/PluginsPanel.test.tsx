import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listPlugins, setPluginEnabledState } from "../lib/invoke";
import { PluginsPanel } from "./PluginsPanel";

const initialPlugins = [
  {
    id: "shipkit.release-brief",
    name: "Release Brief",
    version: "1.0.0",
    description: "Builds a concise release summary from local metadata.",
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
    description: "Captures local runtime state for debugging.",
    category: "diagnostics",
    distribution: "curated-signed",
    min_shipkit_version: "0.1.0",
    compatibility: ">=0.1.0",
    capabilities: ["diagnostics"],
    enabled: false,
  },
];

let currentPlugins = initialPlugins.map((plugin) => ({ ...plugin }));

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
  listPlugins: vi.fn().mockImplementation(() =>
    Promise.resolve(currentPlugins.map((plugin) => ({ ...plugin }))),
  ),
  setPluginEnabledState: vi.fn().mockImplementation((pluginId: string, enabled: boolean) => {
    currentPlugins = currentPlugins.map((plugin) =>
      plugin.id === pluginId ? { ...plugin, enabled } : { ...plugin },
    );
    return Promise.resolve(currentPlugins.map((plugin) => ({ ...plugin })));
  }),
}));

describe("PluginsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPlugins = initialPlugins.map((plugin) => ({ ...plugin }));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the curated catalog and plugin summary", async () => {
    render(<PluginsPanel />);

    expect(await screen.findByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(
      await screen.findByText(/curated plugin manifests currently bundled/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/current catalog spread across runtime, diagnostics, and release tasks/i),
    ).toBeInTheDocument();
    expect(await screen.findByText("Release Brief 1.0.0")).toBeInTheDocument();
    expect(await screen.findByText("Runtime Snapshot 1.0.0")).toBeInTheDocument();
  });

  it("toggles a curated plugin and announces success", async () => {
    const updateSpy = vi.fn();
    window.addEventListener("shipkit:plugins-updated", updateSpy);

    render(<PluginsPanel />);

    expect(await screen.findByText("Runtime Snapshot 1.0.0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enable plugin/i }));

    expect(setPluginEnabledState).toHaveBeenCalledWith(
      "shipkit.runtime-snapshot",
      true,
    );
    expect(
      await screen.findByText(/runtime snapshot enabled for this desktop workspace/i),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("button", { name: /disable plugin/i })).toHaveLength(2);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener("shipkit:plugins-updated", updateSpy);
  });

  it("shows a structured error when catalog refresh fails", async () => {
    vi.mocked(listPlugins).mockRejectedValueOnce({
      code: "plugins.list_failed",
      message: "Plugin catalog is unavailable.",
      details: "missing catalog",
    });

    render(<PluginsPanel />);

    expect(
      await screen.findByText("Plugin catalog is unavailable. (plugins.list_failed)"),
    ).toBeInTheDocument();
  });
});

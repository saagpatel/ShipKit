import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDatabaseOverview,
  getLogEntries,
  getTheme,
  listPlugins,
} from "../lib/invoke";
import { HomePanel } from "./HomePanel";

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
  getDatabaseOverview: vi.fn().mockResolvedValue({
    total_registered: 2,
    applied_count: 1,
    pending_count: 1,
    last_applied_version: 1,
    last_applied_name: "create_notes",
    rollback_available: true,
    rollback_reason: null,
    operation_warning: "1 migration(s) still need to be applied in this workspace.",
  }),
  getTheme: vi.fn().mockResolvedValue({
    name: "ocean",
    mode: "dark",
    variables: {},
  }),
  getLogEntries: vi.fn().mockResolvedValue([
    {
      timestamp: "2026-03-10T00:00:00Z",
      level: "INFO",
      message: "ShipKit Desktop ready",
      target: "shipkit.desktop",
      fields: null,
    },
  ]),
  listPlugins: vi.fn().mockResolvedValue([
    {
      id: "shipkit.release-brief",
      name: "Release Brief",
      version: "1.0.0",
      description: "Creates a concise release brief from local metadata.",
      category: "release",
      distribution: "curated-signed",
      min_shipkit_version: "0.1.0",
      compatibility: "Ready for current macOS-first release workflows.",
      capabilities: ["release", "notes"],
      enabled: true,
    },
  ]),
}));

describe("HomePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the main local control summary", async () => {
    render(<HomePanel />);

    expect(await screen.findByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(await screen.findByText("Release Brief")).toBeInTheDocument();
    expect(await screen.findByText(/database attention is still needed/i)).toBeInTheDocument();
  });

  it("shows an empty plugin state when the curated catalog is unavailable in the build", async () => {
    vi.mocked(listPlugins).mockResolvedValueOnce([]);

    render(<HomePanel />);

    expect(
      await screen.findByText(/the curated plugin catalog is currently empty/i),
    ).toBeInTheDocument();
  });

  it("shows a structured error when home data loading fails", async () => {
    vi.mocked(getDatabaseOverview).mockRejectedValueOnce({
      code: "migration.overview_failed",
      message: "Home data unavailable.",
      details: "test",
    });

    render(<HomePanel />);

    expect(
      await screen.findByText("Home data unavailable. (migration.overview_failed)"),
    ).toBeInTheDocument();
    expect(getTheme).toHaveBeenCalled();
    expect(getLogEntries).toHaveBeenCalled();
    expect(listPlugins).toHaveBeenCalled();
  });
});

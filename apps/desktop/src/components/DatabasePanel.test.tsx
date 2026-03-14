import type { DatabaseOverview } from "../lib/bindings";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMigrations,
  getDatabaseOverview,
  rollbackMigration,
} from "../lib/invoke";
import { DatabasePanel } from "./DatabasePanel";

const appliedMigration = {
  version: 1,
  name: "create_notes",
  applied: true,
  applied_at: "2026-03-10T00:00:00Z",
};

const pendingMigration = {
  version: 2,
  name: "add_operator_flags",
  applied: false,
  applied_at: null,
};

let currentOverview: DatabaseOverview = {
  total_registered: 2,
  applied_count: 1,
  pending_count: 1,
  last_applied_version: 1,
  last_applied_name: "create_notes",
  rollback_available: true,
  rollback_reason: null,
  operation_warning: "1 migration(s) still need to be applied in this workspace.",
};

let currentMigrations = [{ ...appliedMigration }, { ...pendingMigration }];

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
  getDesktopSettings: vi.fn().mockResolvedValue({
    startup_route: "home",
    default_settings_namespace: "demo",
    default_log_level: "WARN",
    confirm_before_rollback: true,
  }),
  getDatabaseOverview: vi.fn().mockImplementation(() => Promise.resolve({ ...currentOverview })),
  migrationStatus: vi.fn().mockImplementation(() =>
    Promise.resolve(currentMigrations.map((migration) => ({ ...migration }))),
  ),
  applyMigrations: vi.fn().mockImplementation(() => {
    currentMigrations = currentMigrations.map((migration) => ({
      ...migration,
      applied: true,
      applied_at: migration.applied_at ?? "2026-03-10T00:05:00Z",
    }));
    currentOverview = {
      ...currentOverview,
      applied_count: 2,
      pending_count: 0,
      last_applied_version: 2,
      last_applied_name: "add_operator_flags",
      operation_warning: null,
    };
    return Promise.resolve(currentMigrations.map((migration) => ({ ...migration })));
  }),
  rollbackMigration: vi.fn().mockImplementation(() => {
    currentMigrations = currentMigrations.map((migration) =>
      migration.version === 1
        ? { ...migration, applied: false, applied_at: null }
        : { ...migration },
    );
    currentOverview = {
      ...currentOverview,
      applied_count: 0,
      pending_count: 2,
      last_applied_version: null,
      last_applied_name: null,
      rollback_available: false,
      rollback_reason: "No applied migrations are available to roll back.",
      operation_warning: "2 migration(s) still need to be applied in this workspace.",
    };
    return Promise.resolve({
      version: 1,
      name: "create_notes",
      applied: false,
      applied_at: null,
    });
  }),
}));

describe("DatabasePanel", () => {
  const confirmSpy = vi.spyOn(window, "confirm");

  beforeEach(() => {
    vi.clearAllMocks();
    currentOverview = {
      total_registered: 2,
      applied_count: 1,
      pending_count: 1,
      last_applied_version: 1,
      last_applied_name: "create_notes",
      rollback_available: true,
      rollback_reason: null,
      operation_warning: "1 migration(s) still need to be applied in this workspace.",
    };
    currentMigrations = [{ ...appliedMigration }, { ...pendingMigration }];
    confirmSpy.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the migration overview and pending warning", async () => {
    render(<DatabasePanel />);

    expect(await screen.findByRole("heading", { name: "Database" })).toBeInTheDocument();
    expect(await screen.findAllByText("create_notes")).toHaveLength(2);
    expect(
      await screen.findByText(/1 migration\(s\) still need to be applied/i),
    ).toBeInTheDocument();
  });

  it("applies pending migrations and refreshes the overview", async () => {
    render(<DatabasePanel />);

    await screen.findAllByText("add_operator_flags");
    fireEvent.click(screen.getByRole("button", { name: /apply pending/i }));

    expect(applyMigrations).toHaveBeenCalled();
    expect(
      await screen.findByText(/applied 1 pending migration\(s\)/i),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("add_operator_flags")).toHaveLength(2);
    expect(await screen.findByText(/the local schema is already current/i)).toBeInTheDocument();
  });

  it("rolls back the latest migration and disables rollback when none remain", async () => {
    currentMigrations = [{ ...appliedMigration }];
    currentOverview = {
      total_registered: 1,
      applied_count: 1,
      pending_count: 0,
      last_applied_version: 1,
      last_applied_name: "create_notes",
      rollback_available: true,
      rollback_reason: null,
      operation_warning: null,
    };

    render(<DatabasePanel />);

    await screen.findAllByText("create_notes");
    fireEvent.click(screen.getByRole("button", { name: /rollback last/i }));

    expect(rollbackMigration).toHaveBeenCalled();
    expect(await screen.findByText(/rolled back migration create_notes/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /rollback last/i })).toBeDisabled(),
    );
  });

  it("shows a structured error when overview loading fails", async () => {
    vi.mocked(getDatabaseOverview).mockRejectedValueOnce({
      code: "migration.overview_failed",
      message: "Overview unavailable.",
      details: "lock failed",
    });

    render(<DatabasePanel />);

    expect(
      await screen.findByText("Overview unavailable. (migration.overview_failed)"),
    ).toBeInTheDocument();
  });
});

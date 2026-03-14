import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  inspectConfiguredFeed,
  progressFromEvent,
  relaunchAfterUpdate,
} from "./updater";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

describe("updater helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps updater progress into stable UI snapshots", () => {
    const started = progressFromEvent(
      { event: "Started", data: { contentLength: 200 } },
      {
        phase: "idle",
        downloadedBytes: 0,
        totalBytes: null,
        percent: null,
      },
    );

    const downloading = progressFromEvent(
      { event: "Progress", data: { chunkLength: 50 } },
      started,
    );
    const finished = progressFromEvent({ event: "Finished" }, downloading);

    expect(started).toEqual({
      phase: "started",
      downloadedBytes: 0,
      totalBytes: 200,
      percent: 0,
    });
    expect(downloading).toEqual({
      phase: "downloading",
      downloadedBytes: 50,
      totalBytes: 200,
      percent: 25,
    });
    expect(finished).toEqual({
      phase: "finished",
      downloadedBytes: 200,
      totalBytes: 200,
      percent: 100,
    });
  });

  it("returns a summary when a Tauri update is available", async () => {
    vi.mocked(check).mockResolvedValue({
      currentVersion: "0.1.0",
      version: "0.2.0",
      date: "2026-03-10",
      body: "Release notes",
    } as never);

    await expect(checkForUpdates()).resolves.toEqual({
      update: expect.any(Object),
      summary: {
        currentVersion: "0.1.0",
        version: "0.2.0",
        date: "2026-03-10",
        body: "Release notes",
      },
    });
  });

  it("maps missing updater endpoints into a stable not-configured error", async () => {
    vi.mocked(check).mockRejectedValue("Updater does not have any endpoints set.");

    await expect(checkForUpdates()).rejects.toMatchObject({
      code: "updater.not_configured",
      message: "Updater feed is not configured for this build.",
    });
  });

  it("passes install progress through and relaunches safely", async () => {
    const progressSnapshots: number[] = [];
    const updateHandle = {
      downloadAndInstall: vi.fn(async (onProgress?: (event: unknown) => void) => {
        onProgress?.({ event: "Started", data: { contentLength: 100 } });
        onProgress?.({ event: "Progress", data: { chunkLength: 40 } });
        onProgress?.({ event: "Progress", data: { chunkLength: 60 } });
        onProgress?.({ event: "Finished" });
      }),
    } as never;

    await downloadAndInstallUpdate(updateHandle, (progress) => {
      progressSnapshots.push(progress.percent ?? -1);
    });
    await relaunchAfterUpdate();

    expect(progressSnapshots).toEqual([0, 40, 100, 100]);
    expect(relaunch).toHaveBeenCalledTimes(1);
  });

  it("inspects a configured updater feed manifest", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          version: "0.2.0",
          pub_date: "2026-03-10T00:00:00Z",
          notes: "Signed canary release",
          url: "https://example.com/ShipKit.zip",
          signature: "signed-payload",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      inspectConfiguredFeed("https://example.com/latest.json"),
    ).resolves.toEqual({
      endpoint: "https://example.com/latest.json",
      version: "0.2.0",
      pubDate: "2026-03-10T00:00:00Z",
      notes: "Signed canary release",
      artifactUrl: "https://example.com/ShipKit.zip",
      signaturePresent: true,
    });
  });
});

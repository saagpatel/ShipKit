import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update as NativeUpdate,
} from "@tauri-apps/plugin-updater";
import { normalizeCommandError } from "./invoke";
import { AppCommandError } from "./invoke";

export interface UpdateBuildDefaults {
  channel: string;
  host: string;
  repository: string | null;
  manifestUrl: string | null;
}

export interface AvailableUpdateSummary {
  currentVersion: string;
  version: string;
  date: string | null;
  body: string | null;
}

export interface UpdateDownloadProgress {
  phase: "idle" | "started" | "downloading" | "finished";
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

export interface UpdateCheckResult {
  update: NativeUpdate | null;
  summary: AvailableUpdateSummary | null;
}

export interface ConfiguredFeedManifest {
  endpoint: string;
  version: string;
  pubDate: string | null;
  notes: string | null;
  artifactUrl: string | null;
  signaturePresent: boolean;
}

const updaterNotConfiguredMessage = "Updater does not have any endpoints set.";

function normalizeUpdaterError(error: unknown): AppCommandError {
  const normalized = normalizeCommandError(error);
  if (
    normalized.code === "command.unknown" &&
    normalized.message === updaterNotConfiguredMessage
  ) {
    return new AppCommandError({
      code: "updater.not_configured",
      message: "Updater feed is not configured for this build.",
      details: normalized.details ?? normalized.message,
    });
  }

  return normalized;
}

function trimmedEnv(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function getUpdateBuildDefaults(): UpdateBuildDefaults {
  const bridge = window.__SHIPKIT_E2E_BRIDGE__;
  if (bridge) {
    return bridge.getUpdateBuildDefaults();
  }

  const channel = trimmedEnv(import.meta.env.VITE_SHIPKIT_UPDATE_CHANNEL) ?? "canary";
  const host = trimmedEnv(import.meta.env.VITE_SHIPKIT_RELEASE_HOST) ?? "github-releases";
  const repository = trimmedEnv(import.meta.env.VITE_SHIPKIT_RELEASE_REPOSITORY);
  const artifactBaseUrl = trimmedEnv(
    import.meta.env.VITE_SHIPKIT_RELEASE_ARTIFACT_BASE_URL,
  );
  const explicitEndpoint = trimmedEnv(
    import.meta.env.VITE_SHIPKIT_TAURI_UPDATER_ENDPOINT,
  );

  const manifestUrl = explicitEndpoint
    ? explicitEndpoint
    : artifactBaseUrl
      ? joinUrl(artifactBaseUrl, "latest.json")
      : host === "github-releases" && repository && channel === "stable"
        ? `https://github.com/${repository}/releases/latest/download/latest.json`
        : null;

  return {
    channel,
    host,
    repository,
    manifestUrl,
  };
}

function toSummary(update: NativeUpdate): AvailableUpdateSummary {
  return {
    currentVersion: update.currentVersion,
    version: update.version,
    date: update.date ?? null,
    body: update.body ?? null,
  };
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {
    const bridge = window.__SHIPKIT_E2E_BRIDGE__;
    if (bridge) {
      return await bridge.checkForUpdates();
    }

    const update = await check();
    return {
      update,
      summary: update ? toSummary(update) : null,
    };
  } catch (error) {
    throw normalizeUpdaterError(error);
  }
}

export async function inspectConfiguredFeed(
  manifestUrl: string | null,
): Promise<ConfiguredFeedManifest> {
  const bridge = window.__SHIPKIT_E2E_BRIDGE__;
  if (bridge) {
    return bridge.inspectConfiguredFeed(manifestUrl);
  }

  if (!manifestUrl) {
    throw normalizeCommandError({
      code: "updater.feed_not_configured",
      message: "No embedded updater feed is configured for this build.",
      details: "Set a release updater endpoint or artifact base URL before validating the feed.",
    });
  }

  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw {
        code: "updater.feed_request_failed",
        message: `Updater feed request failed with status ${response.status}.`,
        details: manifestUrl,
      };
    }

    const payload = (await response.json()) as {
      version?: unknown;
      pub_date?: unknown;
      notes?: unknown;
      url?: unknown;
      signature?: unknown;
    };

    if (typeof payload.version !== "string" || !payload.version.trim()) {
      throw {
        code: "updater.feed_invalid_payload",
        message: "Updater feed payload is missing a valid version.",
        details: manifestUrl,
      };
    }

    return {
      endpoint: manifestUrl,
      version: payload.version,
      pubDate: typeof payload.pub_date === "string" ? payload.pub_date : null,
      notes: typeof payload.notes === "string" ? payload.notes : null,
      artifactUrl: typeof payload.url === "string" ? payload.url : null,
      signaturePresent:
        typeof payload.signature === "string" && payload.signature.trim().length > 0,
    };
  } catch (error) {
    throw normalizeUpdaterError(error);
  }
}

export function progressFromEvent(
  event: DownloadEvent,
  previous: UpdateDownloadProgress,
): UpdateDownloadProgress {
  switch (event.event) {
    case "Started": {
      const totalBytes = event.data.contentLength ?? null;
      return {
        phase: "started",
        downloadedBytes: 0,
        totalBytes,
        percent: totalBytes && totalBytes > 0 ? 0 : null,
      };
    }
    case "Progress": {
      const downloadedBytes = previous.downloadedBytes + event.data.chunkLength;
      const totalBytes = previous.totalBytes;
      return {
        phase: "downloading",
        downloadedBytes,
        totalBytes,
        percent:
          totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
            : null,
      };
    }
    case "Finished":
      return {
        phase: "finished",
        downloadedBytes: previous.totalBytes ?? previous.downloadedBytes,
        totalBytes: previous.totalBytes,
        percent: 100,
      };
  }
}

export async function downloadAndInstallUpdate(
  update: NativeUpdate,
  onProgress?: (progress: UpdateDownloadProgress) => void,
): Promise<void> {
  const bridge = window.__SHIPKIT_E2E_BRIDGE__;
  if (bridge) {
    return bridge.downloadAndInstallUpdate(update, onProgress);
  }

  let snapshot: UpdateDownloadProgress = {
    phase: "idle",
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
  };

  try {
    await update.downloadAndInstall((event) => {
      snapshot = progressFromEvent(event, snapshot);
      onProgress?.(snapshot);
    });
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

export async function relaunchAfterUpdate(): Promise<void> {
  try {
    const bridge = window.__SHIPKIT_E2E_BRIDGE__;
    if (bridge) {
      await bridge.relaunchAfterUpdate();
      return;
    }

    await relaunch();
  } catch (error) {
    throw normalizeCommandError(error);
  }
}

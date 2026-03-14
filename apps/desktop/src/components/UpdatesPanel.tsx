import { useEffect, useMemo, useState } from "react";
import type { AppOverview } from "../lib/bindings";
import { formatCommandError, getAppOverview } from "../lib/invoke";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  getUpdateBuildDefaults,
  inspectConfiguredFeed,
  relaunchAfterUpdate,
  type AvailableUpdateSummary,
  type ConfiguredFeedManifest,
  type UpdateDownloadProgress,
} from "../lib/updater";
import type { Update as NativeUpdate } from "@tauri-apps/plugin-updater";

const idleProgress: UpdateDownloadProgress = {
  phase: "idle",
  downloadedBytes: 0,
  totalBytes: null,
  percent: null,
};

export function UpdatesPanel() {
  const [overview, setOverview] = useState<AppOverview | null>(null);
  const [availableUpdate, setAvailableUpdate] =
    useState<AvailableUpdateSummary | null>(null);
  const [feedManifest, setFeedManifest] = useState<ConfiguredFeedManifest | null>(null);
  const [updateHandle, setUpdateHandle] = useState<NativeUpdate | null>(null);
  const [downloadProgress, setDownloadProgress] =
    useState<UpdateDownloadProgress>(idleProgress);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInspectingFeed, setIsInspectingFeed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isReadyToRestart, setIsReadyToRestart] = useState(false);

  const buildDefaults = useMemo(() => getUpdateBuildDefaults(), []);

  useEffect(() => {
    getAppOverview()
      .then(setOverview)
      .catch((nextError: unknown) => setError(formatCommandError(nextError)));
  }, []);

  useEffect(() => {
    return () => {
      if (updateHandle) {
        void updateHandle.close().catch(() => undefined);
      }
    };
  }, [updateHandle]);

  const replaceUpdateHandle = (nextHandle: NativeUpdate | null) => {
    setUpdateHandle(nextHandle);
  };

  const handleCheck = () => {
    setIsChecking(true);
    setError(null);
    setStatus(null);
    setIsReadyToRestart(false);
    setDownloadProgress(idleProgress);

    checkForUpdates()
      .then(({ update, summary }) => {
        replaceUpdateHandle(update);
        setAvailableUpdate(summary);

        if (!summary) {
          setStatus("No newer signed update is currently available for this build.");
          return;
        }

        setStatus(
          `Version ${summary.version} is available for download. Review the notes and install when ready.`,
        );
      })
      .catch((nextError: unknown) => {
        replaceUpdateHandle(null);
        setAvailableUpdate(null);
        setError(formatCommandError(nextError));
      })
      .finally(() => setIsChecking(false));
  };

  const handleInspectFeed = () => {
    setIsInspectingFeed(true);
    setError(null);
    setStatus(null);

    inspectConfiguredFeed(buildDefaults.manifestUrl)
      .then((manifest) => {
        setFeedManifest(manifest);
        setStatus(
          `Feed validation found version ${manifest.version} at the configured updater endpoint.`,
        );
      })
      .catch((nextError: unknown) => {
        setFeedManifest(null);
        setError(formatCommandError(nextError));
      })
      .finally(() => setIsInspectingFeed(false));
  };

  const handleInstall = () => {
    if (!updateHandle) {
      return;
    }

    setIsInstalling(true);
    setError(null);
    setStatus(null);
    setDownloadProgress(idleProgress);

    downloadAndInstallUpdate(updateHandle, setDownloadProgress)
      .then(() => {
        replaceUpdateHandle(null);
        setIsReadyToRestart(true);
        setStatus("Update downloaded and installed. Restart ShipKit to apply it.");
      })
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsInstalling(false));
  };

  const handleRestart = () => {
    setIsRestarting(true);
    setError(null);

    relaunchAfterUpdate()
      .catch((nextError: unknown) => setError(formatCommandError(nextError)))
      .finally(() => setIsRestarting(false));
  };

  const feedLabel = buildDefaults.manifestUrl ?? "Not embedded in this build yet";

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Release control</p>
          <h2>Updates</h2>
          <p className="page-copy">
            Check the release feed, install newer builds, and relaunch safely.
          </p>
        </div>
      </header>

      {error ? <p className="callout callout-error">{error}</p> : null}
      {status ? <p className="callout callout-success">{status}</p> : null}

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Current version</span>
          <strong>{overview?.version ?? "Loading..."}</strong>
          <p>{overview ? overview.app_name : "Reading app metadata."}</p>
        </article>
        <article className="status-card">
          <span className="status-label">Platform</span>
          <strong>{overview?.platform ?? "Loading..."}</strong>
          <p>Updater validation is strongest on macOS today.</p>
        </article>
        <article className="status-card">
          <span className="status-label">Default channel</span>
          <strong>{buildDefaults.channel}</strong>
          <p>
            {buildDefaults.host === "github-releases"
              ? "GitHub Releases-backed feed by default."
              : `Feed host: ${buildDefaults.host}`}
          </p>
        </article>
      </div>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Signed feed</p>
            <h3>Check for a newer release</h3>
          </div>
          <div className="panel-actions">
            <button
              className="panel-button"
              disabled={isInspectingFeed}
              onClick={handleInspectFeed}
              type="button"
            >
              {isInspectingFeed ? "Validating Feed..." : "Validate Feed Endpoint"}
            </button>
            <button
              className="panel-button"
              disabled={isChecking}
              onClick={handleCheck}
              type="button"
            >
              {isChecking ? "Checking..." : "Check for Updates"}
            </button>
            <button
              className="panel-button is-active"
              disabled={!availableUpdate || isInstalling}
              onClick={handleInstall}
              type="button"
            >
              {isInstalling ? "Installing..." : "Download and Install"}
            </button>
            <button
              className="panel-button"
              disabled={!isReadyToRestart || isRestarting}
              onClick={handleRestart}
              type="button"
            >
              {isRestarting ? "Restarting..." : "Restart to Apply"}
            </button>
          </div>
        </div>

        <div className="field-grid">
          <div className="detail-card">
            <span className="status-label">Planned feed</span>
            <p>{feedLabel}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Repository</span>
            <p>{buildDefaults.repository ?? "Not embedded in this build"}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Feed validation</span>
            <p>
              {feedManifest
                ? `Version ${feedManifest.version} discovered`
                : "No validation run yet"}
            </p>
          </div>
        </div>

        <div className="panel-note">
          <p>
            Local dev builds may report setup errors until a real signed feed is embedded.
          </p>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Feed inspection</p>
            <h3>Configured manifest details</h3>
          </div>
        </div>

        {!feedManifest ? (
          <p className="panel-muted">
            Validate the configured feed to inspect the embedded manifest first.
          </p>
        ) : (
          <div className="field-grid">
            <div className="detail-card">
              <span className="status-label">Manifest endpoint</span>
              <p>{feedManifest.endpoint}</p>
            </div>
            <div className="detail-card">
              <span className="status-label">Target version</span>
              <p>{feedManifest.version}</p>
            </div>
            <div className="detail-card">
              <span className="status-label">Published date</span>
              <p>{feedManifest.pubDate ?? "Not provided"}</p>
            </div>
            <div className="detail-card">
              <span className="status-label">Artifact URL</span>
              <p>{feedManifest.artifactUrl ?? "Not provided"}</p>
            </div>
            <div className="detail-card">
              <span className="status-label">Signature</span>
              <p>{feedManifest.signaturePresent ? "Present" : "Missing"}</p>
            </div>
          </div>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Candidate</p>
            <h3>Available update details</h3>
          </div>
        </div>

        {!availableUpdate ? (
          <p className="panel-muted">
            No update details yet. Run a feed check to populate this panel.
          </p>
        ) : (
          <>
            <div className="field-grid">
              <div className="detail-card">
                <span className="status-label">Target version</span>
                <p>
                  {availableUpdate.version} (current: {availableUpdate.currentVersion})
                </p>
              </div>
              <div className="detail-card">
                <span className="status-label">Published date</span>
                <p>{availableUpdate.date ?? "No published date provided."}</p>
              </div>
            </div>

            <div className="panel-note">
              <p>
                {availableUpdate.body
                  ? "Release notes from the feed:"
                  : "No release notes were attached to this update."}
              </p>
            </div>

            {availableUpdate.body ? (
              <pre className="panel-pre">{availableUpdate.body}</pre>
            ) : null}
          </>
        )}
      </section>

      <section className="panel-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Install progress</p>
            <h3>Download state</h3>
          </div>
        </div>

        <div className="field-grid">
          <div className="detail-card">
            <span className="status-label">Phase</span>
            <p>{downloadProgress.phase}</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Progress</span>
            <p>
              {downloadProgress.percent !== null
                ? `${downloadProgress.percent}%`
                : "Waiting for package metadata"}
            </p>
          </div>
          <div className="detail-card">
            <span className="status-label">Downloaded</span>
            <p>{downloadProgress.downloadedBytes} bytes</p>
          </div>
          <div className="detail-card">
            <span className="status-label">Expected total</span>
            <p>
              {downloadProgress.totalBytes !== null
                ? `${downloadProgress.totalBytes} bytes`
                : "Unknown"}
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}

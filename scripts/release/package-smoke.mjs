import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const packageSmokeExitMs = Number(process.env.SHIPKIT_PACKAGE_SMOKE_EXIT_MS ?? "1500");
const packageSmokeTimeoutMs = Number(process.env.SHIPKIT_PACKAGE_SMOKE_TIMEOUT_MS ?? "10000");
const packageSmokeLaunchRetries = Number(process.env.SHIPKIT_PACKAGE_SMOKE_LAUNCH_RETRIES ?? "3");
const releaseChannel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
const tauriOverlayPath = path.join(
  process.cwd(),
  ".release-results",
  "tauri-release-overlay.json",
);

function candidateMacBundleRoots() {
  const roots = [];
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.cwd(), process.env.CARGO_TARGET_DIR)
    : path.join(process.cwd(), "target", "codex");

  roots.push(path.join(targetDir, "debug", "bundle", "macos"));
  roots.push(path.join(process.cwd(), "apps", "desktop", "src-tauri", "target", "debug", "bundle", "macos"));
  roots.push(
    path.join(
      process.env.HOME ?? "",
      "Library",
      "Caches",
      "Codex",
      "build",
      "rust",
      "ShipKit",
      "debug",
      "bundle",
      "macos",
    ),
  );

  return [...new Set(roots)];
}

function findBuiltMacApp() {
  for (const bundleRoot of candidateMacBundleRoots()) {
    if (!fs.existsSync(bundleRoot)) {
      continue;
    }

    const entries = fs
      .readdirSync(bundleRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
      .map((entry) => path.join(bundleRoot, entry.name));

    if (entries.length === 0) {
      continue;
    }

    entries.sort((left, right) => {
      const leftStat = fs.statSync(left);
      const rightStat = fs.statSync(right);
      return rightStat.mtimeMs - leftStat.mtimeMs;
    });

    return entries[0];
  }

  throw new Error(
    `macOS app bundle directory not found in any expected location: ${candidateMacBundleRoots().join(", ")}`,
  );
}

async function launchPackagedMacApp(appBundlePath, smokeDataDir) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      "open",
      [
        "-W",
        appBundlePath,
        "--args",
        "--shipkit-data-dir",
        smokeDataDir,
        "--shipkit-smoke-exit-after-ms",
        String(packageSmokeExitMs),
        "--shipkit-smoke-scenario",
        "restore-support-bundle",
      ],
      {
      env: {
        ...process.env,
        CI: "1",
      },
      stdio: "inherit",
      },
    );

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `packaged app did not exit within ${packageSmokeTimeoutMs}ms: ${appBundlePath}`,
        ),
      );
    }, packageSmokeTimeoutMs);

    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.once("exit", (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(
        new Error(
          `packaged app exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"})`,
        ),
      );
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchPackagedMacAppWithRetry(appBundlePath, smokeDataDir) {
  let lastError = null;
  for (let attempt = 1; attempt <= packageSmokeLaunchRetries; attempt += 1) {
    try {
      await launchPackagedMacApp(appBundlePath, smokeDataDir);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === packageSmokeLaunchRetries) {
        break;
      }

      console.warn(
        `packaged app launch attempt ${attempt} failed; retrying (${error instanceof Error ? error.message : String(error)})`,
      );
      await sleep(750);
    }
  }

  throw lastError ?? new Error("packaged app smoke failed without an error payload");
}

function stageMacAppArtifact(appBundlePath) {
  const artifactRoot = path.join(process.cwd(), ".release-results", "artifacts");
  fs.mkdirSync(artifactRoot, { recursive: true });

  const sanitizedBundleName = path.basename(appBundlePath, ".app").replace(/\s+/g, "-");
  const stagedArtifactPath = path.join(
    artifactRoot,
    `${sanitizedBundleName}-${releaseChannel}-${process.platform}.zip`,
  );

  const result = spawnSync(
    "ditto",
    ["-c", "-k", "--sequesterRsrc", "--keepParent", appBundlePath, stagedArtifactPath],
    { stdio: "inherit" },
  );

  if ((result.status ?? 1) !== 0) {
    throw new Error(`failed to stage packaged macOS artifact at ${stagedArtifactPath}`);
  }

  return stagedArtifactPath;
}

function copyMacAppBundle(appBundlePath) {
  const smokeRoot = fs.mkdtempSync(path.join(process.cwd(), ".release-results", "package-app-"));
  const copiedAppPath = path.join(smokeRoot, path.basename(appBundlePath));
  const result = spawnSync("ditto", [appBundlePath, copiedAppPath], { stdio: "inherit" });

  if ((result.status ?? 1) !== 0) {
    throw new Error(`failed to copy packaged macOS app into isolated smoke dir at ${copiedAppPath}`);
  }

  return copiedAppPath;
}

const npmExecPath = process.env.npm_execpath;
if (!npmExecPath) {
  console.error("npm_execpath is not set; run this script through pnpm.");
  process.exit(1);
}

const overlayResult = spawnSync(
  process.execPath,
  ["scripts/release/generate-tauri-updater-config.mjs"],
  {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  },
);

if ((overlayResult.status ?? 1) !== 0) {
  process.stderr.write(overlayResult.stderr ?? "");
  process.stdout.write(overlayResult.stdout ?? "");
  process.exit(overlayResult.status ?? 1);
}

const args =
  process.platform === "darwin"
    ? [
        npmExecPath,
        "--dir",
        "apps/desktop",
        "tauri",
        "build",
        "--debug",
        "--bundles",
        "app",
        "--no-sign",
        "--config",
        tauriOverlayPath,
        "--ci",
      ]
    : [
        npmExecPath,
        "--dir",
        "apps/desktop",
        "tauri",
        "build",
        "--debug",
        "--no-bundle",
        "--config",
        tauriOverlayPath,
        "--ci",
      ];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

if (process.platform === "darwin") {
  try {
    fs.mkdirSync(path.join(process.cwd(), ".release-results"), { recursive: true });
    const appBundlePath = findBuiltMacApp();
    const isolatedAppBundlePath = copyMacAppBundle(appBundlePath);
    console.log(`Launching packaged app smoke for ${isolatedAppBundlePath}`);
    const smokeDataDir = fs.mkdtempSync(
      path.join(process.cwd(), ".release-results", "package-smoke-"),
    );
    await launchPackagedMacAppWithRetry(isolatedAppBundlePath, smokeDataDir);
    const stagedArtifactPath = stageMacAppArtifact(isolatedAppBundlePath);

    const manifestResult = spawnSync(
      process.execPath,
      ["scripts/release/generate-release-manifest.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SHIPKIT_RELEASE_CHANNEL: releaseChannel,
          SHIPKIT_STAGED_ARTIFACT_PATH: stagedArtifactPath,
        },
        stdio: "inherit",
      },
    );
    if ((manifestResult.status ?? 1) !== 0) {
      process.exit(manifestResult.status ?? 1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

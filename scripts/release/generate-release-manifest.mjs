import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const releaseConfigPath = path.join(repoRoot, "release", "channels.json");
const outputDir = path.join(repoRoot, ".release-results");
const cargoTomlPath = path.join(repoRoot, "Cargo.toml");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readWorkspaceVersion() {
  const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  const match = cargoToml.match(/\[workspace\.package\][\s\S]*?version = "([^"]+)"/);
  if (!match) {
    throw new Error(`unable to determine workspace version from ${cargoTomlPath}`);
  }

  return match[1];
}

function ensureKnownChannel(channel) {
  const config = readJson(releaseConfigPath);
  const known = new Set(config.channels.map((entry) => entry.name));
  if (!known.has(channel)) {
    throw new Error(`unknown release channel "${channel}" in ${releaseConfigPath}`);
  }

  return config;
}

function candidateMacBundleRoots() {
  const roots = [];
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(repoRoot, process.env.CARGO_TARGET_DIR)
    : path.join(repoRoot, "target", "codex");

  roots.push(path.join(targetDir, "debug", "bundle", "macos"));
  roots.push(path.join(repoRoot, "apps", "desktop", "src-tauri", "target", "debug", "bundle", "macos"));
  roots.push(
    path.join(
      os.homedir(),
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

function findMacAppBundle() {
  for (const bundleRoot of candidateMacBundleRoots()) {
    if (!fs.existsSync(bundleRoot)) {
      continue;
    }

    const appBundles = fs
      .readdirSync(bundleRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(".app"))
      .map((entry) => path.join(bundleRoot, entry.name));

    if (appBundles.length === 0) {
      continue;
    }

    appBundles.sort((left, right) => {
      const leftStat = fs.statSync(left);
      const rightStat = fs.statSync(right);
      return rightStat.mtimeMs - leftStat.mtimeMs;
    });

    return appBundles[0];
  }

  throw new Error(
    `macOS bundle root not found in any expected location: ${candidateMacBundleRoots().join(", ")}`,
  );
}

function findExecutablePath(appBundlePath) {
  const executableDir = path.join(appBundlePath, "Contents", "MacOS");
  const executable = fs
    .readdirSync(executableDir, { withFileTypes: true })
    .find((entry) => entry.isFile());

  if (!executable) {
    throw new Error(`no executable found inside ${executableDir}`);
  }

  return path.join(executableDir, executable.name);
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function directorySizeBytes(dirPath) {
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += directorySizeBytes(nextPath);
    } else if (entry.isFile()) {
      total += fs.statSync(nextPath).size;
    }
  }

  return total;
}

function bundleIdentifierForMacApp(appBundlePath) {
  const infoPlist = path.join(appBundlePath, "Contents", "Info.plist");
  const result = spawnSync("plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    "-o",
    "-",
    infoPlist,
  ]);

  if ((result.status ?? 1) !== 0) {
    return null;
  }

  return result.stdout.toString().trim() || null;
}

function fileSizeBytes(filePath) {
  return fs.statSync(filePath).size;
}

function buildManifest() {
  const channel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
  ensureKnownChannel(channel);

  const version = readWorkspaceVersion();
  const appBundlePath = findMacAppBundle();
  const executablePath = findExecutablePath(appBundlePath);
  const bundleSizeBytes = directorySizeBytes(appBundlePath);
  const executableSha256 = sha256(executablePath);
  const bundleIdentifier = bundleIdentifierForMacApp(appBundlePath);
  const stagedArtifactPath = process.env.SHIPKIT_STAGED_ARTIFACT_PATH?.trim() || null;
  const artifactPath = stagedArtifactPath ?? appBundlePath;
  const artifactSizeBytes = stagedArtifactPath
    ? fileSizeBytes(stagedArtifactPath)
    : bundleSizeBytes;
  const artifactSha256 = stagedArtifactPath ? sha256(stagedArtifactPath) : null;
  const manifest = {
    generated_at: new Date().toISOString(),
    version,
    channel,
    platform: process.platform,
    artifact_kind: stagedArtifactPath ? "macos-app-zip" : "macos-app",
    artifact_path: artifactPath,
    artifact_sha256: artifactSha256,
    bundle_path: appBundlePath,
    executable_path: executablePath,
    executable_sha256: executableSha256,
    artifact_size_bytes: artifactSizeBytes,
    bundle_size_bytes: bundleSizeBytes,
    bundle_identifier: bundleIdentifier,
    signing_state: "unsigned-debug-smoke",
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `release-manifest-${channel}-${process.platform}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`Wrote release manifest to ${outputPath}`);
}

buildManifest();

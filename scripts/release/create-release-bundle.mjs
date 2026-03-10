import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function manifestPathFor(channel, platform) {
  return path.join(outputDir, `release-manifest-${channel}-${platform}.json`);
}

function updaterPathFor(channel, platform) {
  return path.join(outputDir, `updater-scaffold-${channel}-${platform}.json`);
}

function releaseTag(version, channel) {
  return channel === "stable" ? `v${version}` : `v${version}-${channel}`;
}

function gitValue(args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if ((result.status ?? 1) !== 0) {
    return null;
  }

  const value = result.stdout.trim();
  return value || null;
}

function defaultReleaseNotes(manifest, updaterMetadata) {
  return `# ShipKit ${manifest.version} (${manifest.channel})\n\n- Platform: ${manifest.platform}\n- Release tag: ${updaterMetadata.distribution.release_tag ?? releaseTag(manifest.version, manifest.channel)}\n- Signing state: ${updaterMetadata.signing_state}\n- Updater state: ${updaterMetadata.readiness_state}\n\n## Notes\n\n- Release notes pending final product summary.\n`;
}

function copyFile(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
}

const channel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
const platform = process.env.SHIPKIT_RELEASE_PLATFORM ?? process.platform;
const requireSignature = process.env.SHIPKIT_REQUIRE_UPDATER_SIGNATURE === "1";

const manifestPath = manifestPathFor(channel, platform);
const updaterPath = updaterPathFor(channel, platform);

if (!fs.existsSync(manifestPath)) {
  throw new Error(`release manifest not found at ${manifestPath}`);
}

if (!fs.existsSync(updaterPath)) {
  throw new Error(`updater metadata not found at ${updaterPath}`);
}

const manifest = readJson(manifestPath);
const updaterMetadata = readJson(updaterPath);

if (requireSignature && !updaterMetadata.updater?.signature_present) {
  throw new Error("release bundle requires a signed updater metadata file");
}

const bundleDir = path.join(outputDir, "publish", channel, manifest.version, platform);
fs.rmSync(bundleDir, { recursive: true, force: true });
fs.mkdirSync(bundleDir, { recursive: true });

const artifactFilename = path.basename(manifest.artifact_path);
const stagedArtifactPath = path.join(bundleDir, artifactFilename);
copyFile(manifest.artifact_path, stagedArtifactPath);

let stagedSignaturePath = null;
if (updaterMetadata.updater?.signature_path && fs.existsSync(updaterMetadata.updater.signature_path)) {
  stagedSignaturePath = path.join(bundleDir, path.basename(updaterMetadata.updater.signature_path));
  copyFile(updaterMetadata.updater.signature_path, stagedSignaturePath);
}

const stagedManifestPath = path.join(bundleDir, "release-manifest.json");
writeJson(stagedManifestPath, manifest);

const stagedUpdaterPath = path.join(bundleDir, "updater-manifest.json");
writeJson(stagedUpdaterPath, updaterMetadata);

const releaseNotesPath = path.join(bundleDir, "RELEASE_NOTES.md");
const customNotesPath = process.env.SHIPKIT_RELEASE_NOTES_PATH?.trim() || null;
if (customNotesPath && fs.existsSync(customNotesPath)) {
  copyFile(customNotesPath, releaseNotesPath);
} else {
  fs.writeFileSync(releaseNotesPath, defaultReleaseNotes(manifest, updaterMetadata));
}

const latestManifest = {
  version: manifest.version,
  notes: fs.readFileSync(releaseNotesPath, "utf8"),
  pub_date: updaterMetadata.pub_date ?? new Date().toISOString(),
  url: updaterMetadata.distribution?.artifact_url ?? null,
  signature: updaterMetadata.updater?.signature ?? null,
};

const latestManifestPath = path.join(bundleDir, "latest.json");
writeJson(latestManifestPath, latestManifest);

const latestChannelManifestPath = path.join(bundleDir, `latest-${channel}.json`);
writeJson(latestChannelManifestPath, latestManifest);

const provenance = {
  generated_at: new Date().toISOString(),
  repo: process.env.SHIPKIT_RELEASE_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || null,
  commit_sha: process.env.GITHUB_SHA?.trim() || gitValue(["rev-parse", "HEAD"]),
  branch: process.env.GITHUB_REF_NAME?.trim() || gitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
  workflow: {
    run_id: process.env.GITHUB_RUN_ID?.trim() || null,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT?.trim() || null,
    workflow_ref: process.env.GITHUB_WORKFLOW_REF?.trim() || null,
  },
  release: {
    channel,
    version: manifest.version,
    platform,
    tag: updaterMetadata.distribution?.release_tag ?? releaseTag(manifest.version, channel),
    host: updaterMetadata.distribution?.host ?? null,
    release_url: updaterMetadata.distribution?.release_url ?? null,
    prerelease: updaterMetadata.distribution?.prerelease ?? channel !== "stable",
  },
  assets: [
    {
      role: "artifact",
      path: stagedArtifactPath,
      size_bytes: fs.statSync(stagedArtifactPath).size,
      sha256: sha256(stagedArtifactPath),
    },
    {
      role: "release-manifest",
      path: stagedManifestPath,
      size_bytes: fs.statSync(stagedManifestPath).size,
      sha256: sha256(stagedManifestPath),
    },
    {
      role: "updater-manifest",
      path: stagedUpdaterPath,
      size_bytes: fs.statSync(stagedUpdaterPath).size,
      sha256: sha256(stagedUpdaterPath),
    },
    {
      role: "release-notes",
      path: releaseNotesPath,
      size_bytes: fs.statSync(releaseNotesPath).size,
      sha256: sha256(releaseNotesPath),
    },
    {
      role: "latest-manifest",
      path: latestManifestPath,
      size_bytes: fs.statSync(latestManifestPath).size,
      sha256: sha256(latestManifestPath),
    },
  ],
};

if (stagedSignaturePath) {
  provenance.assets.push({
    role: "artifact-signature",
    path: stagedSignaturePath,
    size_bytes: fs.statSync(stagedSignaturePath).size,
    sha256: sha256(stagedSignaturePath),
  });
}

const provenancePath = path.join(bundleDir, "provenance.json");
writeJson(provenancePath, provenance);

const latestIndexPath = path.join(outputDir, "publish", channel, `latest-${platform}.json`);
writeJson(latestIndexPath, {
  generated_at: new Date().toISOString(),
  channel,
  platform,
  version: manifest.version,
  tag: provenance.release.tag,
  bundle_dir: bundleDir,
  artifact: path.basename(stagedArtifactPath),
  updater_manifest: path.basename(stagedUpdaterPath),
  latest_manifest: path.basename(latestManifestPath),
  release_notes: path.basename(releaseNotesPath),
});

const summary = {
  generated_at: new Date().toISOString(),
  release_tag: provenance.release.tag,
  release_name: `ShipKit ${manifest.version} (${channel})`,
  prerelease: provenance.release.prerelease,
  bundle_dir: bundleDir,
  artifact_path: stagedArtifactPath,
  signature_path: stagedSignaturePath,
  manifest_path: stagedManifestPath,
  updater_path: stagedUpdaterPath,
  latest_manifest_path: latestManifestPath,
  latest_channel_manifest_path: latestChannelManifestPath,
  notes_path: releaseNotesPath,
  provenance_path: provenancePath,
  upload_assets: [
    stagedArtifactPath,
    stagedManifestPath,
    stagedUpdaterPath,
    latestManifestPath,
    latestChannelManifestPath,
    releaseNotesPath,
    provenancePath,
    ...(stagedSignaturePath ? [stagedSignaturePath] : []),
  ],
};

const summaryPath = path.join(outputDir, `release-bundle-summary-${channel}-${platform}.json`);
writeJson(summaryPath, summary);

console.log(`Wrote release bundle summary to ${summaryPath}`);

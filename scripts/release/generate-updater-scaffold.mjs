import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const outputDir = path.join(repoRoot, ".release-results");
const releaseConfigPath = path.join(repoRoot, "release", "channels.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureKnownChannel(channel) {
  const config = readJson(releaseConfigPath);
  const known = new Set(config.channels.map((entry) => entry.name));
  if (!known.has(channel)) {
    throw new Error(`unknown release channel "${channel}" in ${releaseConfigPath}`);
  }

  return config;
}

function joinUrl(baseUrl, ...parts) {
  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedParts = parts.map((part) => encodeURIComponent(part));
  return `${normalizedBase}/${normalizedParts.join("/")}`;
}

function manifestPathFor(channel, platform) {
  return path.join(outputDir, `release-manifest-${channel}-${platform}.json`);
}

function releaseTag(version, channel) {
  return channel === "stable" ? `v${version}` : `v${version}-${channel}`;
}

function resolveDistribution(manifest) {
  const host = process.env.SHIPKIT_RELEASE_HOST?.trim() || null;
  const repository =
    process.env.SHIPKIT_RELEASE_REPOSITORY?.trim() || process.env.GITHUB_REPOSITORY?.trim() || null;
  const tag = process.env.SHIPKIT_RELEASE_TAG?.trim() || releaseTag(manifest.version, manifest.channel);

  if (host === "github-releases" && repository) {
    const artifactBaseUrl = `https://github.com/${repository}/releases/download/${tag}`;
    return {
      host,
      repository,
      tag,
      prerelease: manifest.channel !== "stable",
      artifactBaseUrl,
      notesBaseUrl: `https://github.com/${repository}/releases/tag/${tag}`,
      releaseUrl: `https://github.com/${repository}/releases/tag/${tag}`,
    };
  }

  return {
    host,
    repository,
    tag,
    prerelease: manifest.channel !== "stable",
    artifactBaseUrl: process.env.SHIPKIT_RELEASE_ARTIFACT_BASE_URL?.trim() || null,
    notesBaseUrl: process.env.SHIPKIT_RELEASE_NOTES_BASE_URL?.trim() || null,
    releaseUrl: null,
  };
}

function resolveUpdaterSigningConfig() {
  return {
    key: process.env.SHIPKIT_UPDATER_PRIVATE_KEY?.trim() || process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() || null,
    keyPath:
      process.env.SHIPKIT_UPDATER_PRIVATE_KEY_PATH?.trim() ||
      process.env.TAURI_SIGNING_PRIVATE_KEY_PATH?.trim() ||
      null,
    password:
      process.env.SHIPKIT_UPDATER_PRIVATE_KEY_PASSWORD?.trim() ||
      process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD?.trim() ||
      null,
  };
}

function signArtifact(artifactPath, signing) {
  if (!signing.key && !signing.keyPath) {
    return {
      signature: null,
      signaturePath: null,
      signed: false,
    };
  }

  const npmExecPath = process.env.npm_execpath;
  if (!npmExecPath) {
    throw new Error("npm_execpath is not set; run updater signing through pnpm.");
  }

  const signaturePath = `${artifactPath}.sig`;
  if (fs.existsSync(signaturePath)) {
    fs.rmSync(signaturePath, { force: true });
  }

  const args = [
    npmExecPath,
    "--dir",
    "apps/desktop",
    "tauri",
    "signer",
    "sign",
    artifactPath,
  ];

  if (signing.keyPath) {
    args.push("--private-key-path", signing.keyPath);
    if (signing.password) {
      args.push("--password", signing.password);
    }
  }

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      CI: "1",
      ...(signing.key ? { TAURI_SIGNING_PRIVATE_KEY: signing.key } : {}),
      ...(signing.password ? { TAURI_SIGNING_PRIVATE_KEY_PASSWORD: signing.password } : {}),
    },
    encoding: "utf8",
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "failed to sign updater artifact");
  }

  if (!fs.existsSync(signaturePath)) {
    throw new Error(`expected updater signature file at ${signaturePath}`);
  }

  return {
    signature: fs.readFileSync(signaturePath, "utf8").trim(),
    signaturePath,
    signed: true,
  };
}

function readinessState(distribution, signaturePresent) {
  if (signaturePresent && distribution.artifactBaseUrl) {
    return "signed-ready-for-publication";
  }

  if (signaturePresent) {
    return "signed-awaiting-publication";
  }

  if (distribution.artifactBaseUrl) {
    return "awaiting-signature";
  }

  return "artifact-metadata-only";
}

function buildUpdaterMetadata(manifest, distribution, signedArtifact) {
  const artifactFilename = path.basename(manifest.artifact_path);
  return {
    generated_at: new Date().toISOString(),
    version: manifest.version,
    notes: process.env.SHIPKIT_RELEASE_NOTES_TEXT?.trim() || null,
    pub_date: new Date().toISOString(),
    url: joinUrl(distribution.artifactBaseUrl, artifactFilename),
    signature: signedArtifact.signature,
    channel: manifest.channel,
    platform: manifest.platform,
    signing_state: manifest.signing_state,
    readiness_state: readinessState(distribution, signedArtifact.signed),
    artifact: {
      kind: manifest.artifact_kind,
      path: manifest.artifact_path,
      filename: artifactFilename,
      size_bytes: manifest.artifact_size_bytes,
      sha256: manifest.artifact_sha256,
      bundle_identifier: manifest.bundle_identifier,
    },
    distribution: {
      host: distribution.host,
      repository: distribution.repository,
      release_tag: distribution.tag,
      release_url: distribution.releaseUrl,
      artifact_base_url: distribution.artifactBaseUrl,
      notes_base_url: distribution.notesBaseUrl,
      artifact_url: joinUrl(distribution.artifactBaseUrl, artifactFilename),
      notes_url: distribution.notesBaseUrl,
      prerelease: distribution.prerelease,
    },
    updater: {
      signature: signedArtifact.signature,
      signature_path: signedArtifact.signaturePath,
      signature_present: signedArtifact.signed,
    },
  };
}

const channel = process.env.SHIPKIT_RELEASE_CHANNEL ?? "canary";
const platform = process.env.SHIPKIT_RELEASE_PLATFORM ?? process.platform;
const requireSignature = process.env.SHIPKIT_REQUIRE_UPDATER_SIGNATURE === "1";
ensureKnownChannel(channel);

const manifestPath = manifestPathFor(channel, platform);
if (!fs.existsSync(manifestPath)) {
  if (platform !== "darwin") {
    fs.mkdirSync(outputDir, { recursive: true });
    const skippedOutputPath = path.join(outputDir, `updater-scaffold-${channel}-${platform}.json`);
    fs.writeFileSync(
      skippedOutputPath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          channel,
          platform,
          updater_state: "skipped-no-release-manifest",
          reason: `release manifest not found at ${manifestPath}`,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Skipped updater scaffold for ${platform}; no release manifest found.`);
    process.exit(0);
  }

  throw new Error(`release manifest not found at ${manifestPath}; run pnpm run package:smoke first`);
}

const manifest = readJson(manifestPath);
const distribution = resolveDistribution(manifest);
const signing = resolveUpdaterSigningConfig();
const signedArtifact = signArtifact(manifest.artifact_path, signing);

if (requireSignature && !signedArtifact.signed) {
  throw new Error("updater signature required but no updater signing key was provided");
}

const metadata = buildUpdaterMetadata(manifest, distribution, signedArtifact);

fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `updater-scaffold-${channel}-${platform}.json`);
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(`Wrote updater scaffold to ${outputPath}`);
